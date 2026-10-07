// ========================================
// PAGOS — utilidades de servidor compartidas por las rutas /api/pagos/solana/*
// ========================================
// Solo servidor: usa la llave secreta de Supabase.

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js"
import { supabaseSecretKey } from "@/lib/server-env"

export function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export interface ContextoComprador {
  comprador: User
  admin: SupabaseClient
}

/**
 * Identifica a quien llama con SU sesión de Supabase (Bearer) y devuelve un
 * cliente con privilegios para escribir la compra. Si algo falla devuelve la
 * `respuesta` HTTP lista para enviar.
 */
export async function autenticarComprador(
  request: Request,
): Promise<ContextoComprador | { respuesta: Response }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = supabaseSecretKey()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !serviceKey || !anonKey) {
    return { respuesta: json({ error: "El servicio no esta configurado." }, 503) }
  }

  const auth = request.headers.get("authorization") ?? ""
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : ""
  if (!token) return { respuesta: json({ error: "Debes iniciar sesion para comprar." }, 401) }

  const publico = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await publico.auth.getUser(token)
  if (error || !data.user) return { respuesta: json({ error: "Sesion invalida." }, 401) }

  return {
    comprador: data.user,
    admin: createClient(url, serviceKey, { auth: { persistSession: false } }),
  }
}

export type ResultadoCompletar = "ok" | "ya_completada" | "firma_repetida" | "error"

/**
 * Pasa una compra de pendiente a completada con la firma que la pagó. Es la
 * única puerta del riel Solana hacia "completada". Idempotente, y el índice
 * único de la firma impide que una misma transacción pague dos compras.
 */
export async function completarCompraSolana(
  admin: SupabaseClient,
  compraId: string,
  signature: string,
): Promise<ResultadoCompletar> {
  const { data, error } = await admin
    .from("purchases")
    .update({ status: "completada", provider_payment_id: signature })
    .eq("id", compraId)
    .eq("provider", "solana")
    .eq("status", "pendiente") // no pisar una ya procesada
    .select("id")
  if (error) {
    if (error.code === "23505") return "firma_repetida"
    console.error("completarCompraSolana", error)
    return "error"
  }
  return data && data.length > 0 ? "ok" : "ya_completada"
}
