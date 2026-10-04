// ========================================
// UMBRA — Sello on-chain de cada CERTIFICADO emitido (Solana)
// ========================================
// Cada certificado (fila de certificate_issuances) recibe su propio sello:
// el SHA-256 de su contenido público (agente, score, victorias, competencias,
// promedio, formato, fecha) escrito en Solana con el programa Memo:
//   umbra:cert:v1:<certId>:<sha256>
// Quien tenga el certificado puede comprobar en /verificar que es auténtico y
// que nadie lo alteró, consultando directamente la cadena.
//
// Llamadores:
//   (a) cualquiera con la anon key, con { certId } → sella ESE certificado.
//       Es seguro exponerlo: los datos salen de la base (no del cuerpo), cada
//       certificado se sella una sola vez (idempotente) y crear certificados ya
//       está limitado por issue_certificate (1 cada 5 min por agente+formato).
//   (b) el CRON interno (x-cron-secret) → sella los que hayan quedado
//       pendientes (p. ej. si la red falló al emitirlos).

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2"
import { buildCertificatePayload, certMemo, sha256Hex } from "../_shared/umbra-attestation.ts"
import { CLUSTER, CORS_HEADERS, isCron, json, loadSigner, sendMemo, type Signer } from "../_shared/solana-signer.ts"

const CRON_BATCH = 20
/** Si otro proceso reclamó el certificado hace menos de esto, se espera. */
const CLAIM_TTL_MS = 2 * 60 * 1000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface CertRow {
  id: string
  agent_id: string
  agent_name: string
  score: number | null
  wins: number | null
  comps_count: number | null
  avg_score: number | string | null
  format: string
  issued_at: string
  cert_hash: string | null
  onchain_signature: string | null
}

const CERT_COLS =
  "id, agent_id, agent_name, score, wins, comps_count, avg_score, format, issued_at, cert_hash, onchain_signature"

type Outcome =
  | { status: "sellado" | "existente"; certId: string; hash: string; signature: string }
  | { status: "pendiente" | "error"; certId: string; message?: string }

function payloadOf(c: CertRow) {
  return buildCertificatePayload({
    id: c.id,
    agentId: c.agent_id,
    agentName: c.agent_name,
    score: c.score ?? 0,
    wins: c.wins ?? 0,
    comps: c.comps_count ?? 0,
    avgScore: Number(c.avg_score ?? 0),
    format: c.format,
    issuedAt: c.issued_at,
  })
}

async function anchor(supabase: SupabaseClient, signer: Signer, cert: CertRow): Promise<Outcome> {
  if (cert.onchain_signature && cert.cert_hash) {
    return { status: "existente", certId: cert.id, hash: cert.cert_hash, signature: cert.onchain_signature }
  }

  // Reclamo atómico: sólo un proceso publica la tx de este certificado.
  const staleBefore = new Date(Date.now() - CLAIM_TTL_MS).toISOString()
  const { data: claimed } = await supabase
    .from("certificate_issuances")
    .update({ onchain_claimed_at: new Date().toISOString() })
    .eq("id", cert.id)
    .is("onchain_signature", null)
    .or(`onchain_claimed_at.is.null,onchain_claimed_at.lt."${staleBefore}"`)
    .select("id")

  if (!claimed || claimed.length === 0) {
    // Otro proceso lo está sellando: esperar su resultado unos segundos.
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      const { data } = await supabase.from("certificate_issuances").select(CERT_COLS).eq("id", cert.id).maybeSingle()
      if (data?.onchain_signature && data.cert_hash) {
        return { status: "existente", certId: cert.id, hash: data.cert_hash, signature: data.onchain_signature }
      }
    }
    return { status: "pendiente", certId: cert.id }
  }

  const payload = payloadOf(cert)
  const hash = await sha256Hex(payload)
  try {
    const signature = await sendMemo(signer, certMemo(cert.id, hash))
    const { error } = await supabase
      .from("certificate_issuances")
      .update({
        cert_hash: hash,
        cert_snapshot: payload,
        onchain_signature: signature,
        onchain_cluster: CLUSTER,
        onchain_wallet: signer.wallet,
        onchain_at: new Date().toISOString(),
      })
      .eq("id", cert.id)
    if (error) throw new Error(error.message)
    return { status: "sellado", certId: cert.id, hash, signature }
  } catch (e) {
    // Libera el reclamo para que el cron lo reintente.
    await supabase.from("certificate_issuances").update({ onchain_claimed_at: null }).eq("id", cert.id)
    console.error("attest-certificate:", cert.id, (e as Error).message)
    return { status: "error", certId: cert.id, message: "No se pudo publicar en Solana." }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })
  if (req.method !== "POST") return json({ ok: false, message: "Método no permitido." }, 405)

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const cron = await isCron(supabase, req)

  let certs: CertRow[] = []
  if (cron) {
    const { data } = await supabase
      .from("certificate_issuances")
      .select(CERT_COLS)
      .is("onchain_signature", null)
      .order("issued_at", { ascending: true })
      .limit(CRON_BATCH)
    certs = (data ?? []) as CertRow[]
    if (certs.length === 0) return json({ ok: true, cluster: CLUSTER, results: [] })
  } else {
    let body: { certId?: unknown } = {}
    try {
      body = await req.json()
    } catch {
      /* sin cuerpo */
    }
    const certId = typeof body.certId === "string" ? body.certId.trim() : ""
    if (!UUID_RE.test(certId)) return json({ ok: false, message: "certId inválido." }, 400)
    const { data } = await supabase.from("certificate_issuances").select(CERT_COLS).eq("id", certId).maybeSingle()
    if (!data) return json({ ok: false, message: "Certificado no encontrado." }, 404)
    const row = data as CertRow
    // Ya sellado: respuesta inmediata, sin tocar la wallet ni la red.
    if (row.onchain_signature && row.cert_hash) {
      return json({
        ok: true,
        cluster: CLUSTER,
        results: [{ status: "existente", certId: row.id, hash: row.cert_hash, signature: row.onchain_signature }],
      })
    }
    certs = [row]
  }

  const signer = await loadSigner(supabase)
  if (signer instanceof Response) return signer

  const results: Outcome[] = []
  for (const cert of certs) results.push(await anchor(supabase, signer, cert))

  const ok = results.every((r) => r.status === "sellado" || r.status === "existente")
  return json({ ok: cron ? true : ok, cluster: CLUSTER, wallet: signer.wallet, results })
})
