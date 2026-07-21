// ========================================
// PROXY DE AGENTES — POST /api/v1/run
// ========================================
// Es lo que compra quien elige la modalidad "Licencia por URL": llama aqui con
// su llave y Umbra reenvia la peticion al endpoint del vendedor. El endpoint
// nunca sale de este servidor, ni en la respuesta ni en los errores.
//
// Contrato:
//   POST /api/v1/run
//   Authorization: Bearer umbra_sk_...
//   { "prompt": "..." }
//   -> 200 { "respuesta": "...", "agente": "...", "ms": 123 }

import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { assertSafeEndpoint } from "@/lib/ssrf"

// Necesita Node: usa node:crypto y resolucion DNS.
export const runtime = "nodejs"
// Nunca cachear: cada llamada se mide y se cobra.
export const dynamic = "force-dynamic"

const AGENT_TIMEOUT_MS = 30_000

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  // Supabase renombro service_role a "secret key" (sb_secret_...). Se aceptan
  // ambos nombres para que da igual como la haya guardado quien despliega.
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !url) {
    console.error("/api/v1/run: falta SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY)")
    return json({ error: "El servicio no esta configurado." }, 503)
  }

  // Cliente con service_role: es el unico que puede leer agents.endpoint y
  // escribir la medicion. Vive solo en el servidor.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // ── 1. Llave ──────────────────────────────────────────────────────────────
  const auth = request.headers.get("authorization") ?? ""
  const key = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : ""
  if (!key.startsWith("umbra_sk_")) {
    return json({ error: "Falta la llave. Usa: Authorization: Bearer umbra_sk_..." }, 401)
  }

  const keyHash = createHash("sha256").update(key).digest("hex")

  const { data: license, error: licErr } = await admin
    .from("agent_licenses")
    .select("id, listing_id, status, calls_count")
    .eq("key_hash", keyHash)
    .maybeSingle()

  // Mismo mensaje para llave inexistente y revocada: no confirmamos cuales
  // llaves existen.
  if (licErr || !license || license.status !== "activa") {
    return json({ error: "Llave invalida o revocada." }, 401)
  }

  // ── 2. Cuerpo ─────────────────────────────────────────────────────────────
  let prompt: unknown
  try {
    prompt = (await request.json())?.prompt
  } catch {
    return json({ error: "El cuerpo debe ser JSON." }, 400)
  }
  if (typeof prompt !== "string" || !prompt.trim()) {
    return json({ error: 'Falta "prompt" (texto no vacio).' }, 400)
  }

  // ── 3. Endpoint del vendedor ──────────────────────────────────────────────
  const { data: listing } = await admin
    .from("marketplace_listings")
    .select("id, listed, agents!inner(name, endpoint, archived)")
    .eq("id", license.listing_id)
    .maybeSingle()

  const agent = listing?.agents as unknown as
    | { name: string; endpoint: string | null; archived: boolean }
    | undefined

  if (!listing?.listed || !agent || agent.archived || !agent.endpoint) {
    return json({ error: "Este agente ya no esta disponible." }, 409)
  }

  try {
    await assertSafeEndpoint(agent.endpoint)
  } catch {
    // No se filtra el motivo: hablaria del endpoint, que es privado.
    return json({ error: "Este agente no esta disponible." }, 409)
  }

  // ── 4. Reenvio ────────────────────────────────────────────────────────────
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS)

  let status = 502
  let ok = false
  let payload: unknown = null

  try {
    const res = await fetch(agent.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
      // Un redirect podria sacarnos de la URL ya validada contra SSRF.
      redirect: "error",
    })
    status = res.status
    const body = await res.json().catch(() => null)
    if (res.ok && body && typeof body.respuesta === "string") {
      ok = true
      payload = body.respuesta
    }
  } catch (err) {
    status = err instanceof Error && err.name === "AbortError" ? 504 : 502
  } finally {
    clearTimeout(timer)
  }

  const ms = Date.now() - started

  // ── 5. Medicion ───────────────────────────────────────────────────────────
  // Se registra siempre, tambien los fallos: sirve para diagnosticar y para
  // demostrarle al vendedor su disponibilidad real.
  await admin.from("api_calls").insert({
    license_id: license.id,
    listing_id: license.listing_id,
    ok,
    status_code: status,
    latency_ms: ms,
  })

  // Solo las llamadas correctas suman al contador facturable.
  if (ok) {
    await admin
      .from("agent_licenses")
      .update({ calls_count: (license.calls_count ?? 0) + 1, last_used_at: new Date().toISOString() })
      .eq("id", license.id)
  }

  if (!ok) {
    return json(
      {
        error:
          status === 504
            ? "El agente no respondio a tiempo."
            : "El agente no devolvio una respuesta valida.",
      },
      status === 504 ? 504 : 502,
    )
  }

  return json({ respuesta: payload, agente: agent.name, ms }, 200)
}

export async function GET() {
  return json({ error: "Usa POST." }, 405)
}
