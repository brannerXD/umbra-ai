// ========================================
// CHECKOUT — POST /api/pagos/checkout
// ========================================
// Inicia una compra real. Crea la compra en estado "pendiente" y devuelve la
// URL de Mercado Pago donde el comprador paga.
//
// La compra NUNCA nace completada aqui: solo el webhook, tras verificar la
// firma de Mercado Pago, puede marcarla como pagada.

import { createClient } from "@supabase/supabase-js"
import { MONEDA, aCentavos, leerConfigPagos } from "@/lib/pagos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !serviceKey || !anonKey) {
    return json({ error: "El servicio no esta configurado." }, 503)
  }

  const cfg = leerConfigPagos()
  if (!cfg) {
    return json(
      { error: "Los pagos aun no estan configurados.", codigo: "pagos_no_configurados" },
      503,
    )
  }

  // ── 1. Quien compra ───────────────────────────────────────────────────────
  // El cliente manda su sesion de Supabase; aqui se verifica de verdad.
  const auth = request.headers.get("authorization") ?? ""
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : ""
  if (!token) return json({ error: "Debes iniciar sesion para comprar." }, 401)

  const publico = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data: userData, error: userErr } = await publico.auth.getUser(token)
  const comprador = userData?.user
  if (userErr || !comprador) return json({ error: "Sesion invalida." }, 401)

  // ── 2. Que compra ─────────────────────────────────────────────────────────
  let listingId: string
  let versionId: string | null = null
  try {
    const body = await request.json()
    listingId = String(body?.listingId ?? "")
    versionId = body?.versionId ? String(body.versionId) : null
  } catch {
    return json({ error: "El cuerpo debe ser JSON." }, 400)
  }
  if (!listingId) return json({ error: "Falta el listado a comprar." }, 400)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: listing } = await admin
    .from("marketplace_listings")
    .select("id, listed, price, price_unit, listing_type, agents!inner(name, owner_id, archived)")
    .eq("id", listingId)
    .maybeSingle()

  const agente = listing?.agents as unknown as
    | { name: string; owner_id: string | null; archived: boolean }
    | undefined

  if (!listing?.listed || !agente || agente.archived) {
    return json({ error: "Este agente ya no esta disponible." }, 409)
  }

  // Primera version: solo se cobran los agentes propios (sin repartos a
  // terceros, que exigirian KYC y transferencias).
  const precio = Number(listing.price)
  if (!Number.isFinite(precio) || precio <= 0) {
    return json({ error: "Este listado no tiene un precio valido." }, 409)
  }

  // Mercado Pago Colombia cobra en pesos. No inventamos una tasa de cambio:
  // si el listado esta en dolares, se avisa en vez de cobrar de mas o de menos.
  if (String(listing.price_unit).toUpperCase() !== MONEDA) {
    return json(
      {
        error: `Este listado esta en ${listing.price_unit}. Para cobrarlo, ponle el precio en ${MONEDA}.`,
        codigo: "moneda_no_soportada",
      },
      409,
    )
  }

  // No cobrar dos veces lo mismo.
  const { data: yaComprada } = await admin
    .from("purchases")
    .select("id, status")
    .eq("listing_id", listingId)
    .eq("buyer_id", comprador.id)
    .eq("status", "completada")
    .maybeSingle()
  if (yaComprada) {
    return json({ error: "Ya compraste este agente.", codigo: "ya_comprada" }, 409)
  }

  // ── 3. Compra en pendiente ────────────────────────────────────────────────
  const { data: compra, error: compraErr } = await admin
    .from("purchases")
    .insert({
      listing_id: listingId,
      buyer_id: comprador.id,
      price: precio,
      price_unit: MONEDA,
      version_id: versionId,
      status: "pendiente",
      provider: "mercadopago",
      amount_cents: aCentavos(precio),
      currency: MONEDA,
    })
    .select("id")
    .single()

  if (compraErr || !compra) {
    console.error("checkout: no se pudo crear la compra", compraErr)
    return json({ error: "No se pudo iniciar la compra." }, 500)
  }

  // ── 4. Preferencia de pago en Mercado Pago ────────────────────────────────
  const origen = new URL(request.url).origin
  try {
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        "Content-Type": "application/json",
        // Evita crear preferencias duplicadas si el usuario da doble clic.
        "X-Idempotency-Key": compra.id,
      },
      body: JSON.stringify({
        items: [
          {
            id: listingId,
            title: `Umbra — ${agente.name}`,
            description:
              listing.listing_type === "codigo"
                ? "Codigo fuente completo del agente"
                : "Licencia de acceso por API",
            quantity: 1,
            unit_price: precio,
            currency_id: MONEDA,
          },
        ],
        // La referencia externa es la que vuelve en el webhook: asi sabemos
        // que compra confirmar sin fiarnos de nada que venga del navegador.
        external_reference: compra.id,
        notification_url: `${origen}/api/pagos/webhook`,
        back_urls: {
          success: `${origen}/mis-compras?pago=ok`,
          pending: `${origen}/mis-compras?pago=pendiente`,
          failure: `${origen}/marketplace?pago=fallido`,
        },
        auto_return: "approved",
        statement_descriptor: "UMBRA",
      }),
    })

    const pref = await res.json()
    if (!res.ok || !pref?.init_point) {
      console.error("checkout: MP rechazo la preferencia", res.status, pref?.message)
      // La compra pendiente queda huerfana: se marca para no ensuciar el panel.
      await admin.from("purchases").delete().eq("id", compra.id)
      return json({ error: "No se pudo crear el pago. Intenta de nuevo." }, 502)
    }

    await admin
      .from("purchases")
      .update({ provider_reference: String(pref.id) })
      .eq("id", compra.id)

    return json({ url: pref.init_point, compraId: compra.id }, 200)
  } catch (e) {
    console.error("checkout: fallo al contactar MP", e)
    await admin.from("purchases").delete().eq("id", compra.id)
    return json({ error: "No se pudo contactar la pasarela de pagos." }, 502)
  }
}

export async function GET() {
  return json({ error: "Usa POST." }, 405)
}
