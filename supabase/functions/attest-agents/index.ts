// ========================================
// UMBRA — Sello on-chain del Trust Score (Solana)
// ========================================
// Publica en Solana una "atestación" del estado reputacional de un agente: el
// SHA-256 de su snapshot público (score, victorias, competencias, promedio)
// escrito con el programa Memo. Cualquiera puede recalcular el hash desde el
// snapshot guardado y compararlo con el memo de la transacción → reputación
// verificable e independiente de nuestro servidor.
//
// Formato IDÉNTICO a lib/solana.ts (mantener en par): payload canónico con
// claves ordenadas, memo `umbra:v1:<agentId>:<sha256>`.
//
// Llamadores permitidos:
//   (a) el CRON interno (x-cron-secret) → sella los agentes cuyo estado cambió.
//   (b) el DUEÑO del agente o un ADMIN → sella un agente concreto ya.
//
// SOLO DEVNET: no gasta dinero real. La wallet firmante es desechable y su
// llave vive en public.internal_config (RLS sin grants: sólo service_role).

import { createClient } from "npm:@supabase/supabase-js@2"
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "npm:@solana/web3.js@1.98.4"
import { Buffer } from "node:buffer"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
}

const CLUSTER = "devnet"
const RPC = "https://api.devnet.solana.com"
const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
const ATTESTATION_PREFIX = "umbra:v1"
/** Máximo de agentes sellados por pasada del cron (cada uno es una tx). */
const CRON_BATCH = 10
/** Un dueño no puede re-sellar el mismo agente más seguido que esto. */
const USER_COOLDOWN_MS = 10 * 60 * 1000

interface AgentRow {
  id: string
  name: string
  score: number | null
  wins: number | null
  comps_count: number | null
  avg_score: number | string | null
  owner_id: string | null
}

interface Payload {
  prefix: string
  agentId: string
  name: string
  score: number
  wins: number
  comps: number
  avgScore: number
  issuedAt: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

function buildPayload(a: AgentRow, issuedAt: Date): Payload {
  return {
    prefix: ATTESTATION_PREFIX,
    agentId: a.id,
    name: a.name,
    score: a.score ?? 0,
    wins: a.wins ?? 0,
    comps: a.comps_count ?? 0,
    // Redondeado a 2 decimales: el snapshot pasa por jsonb y debe volver
    // byte-idéntico para que el hash se pueda recalcular en el navegador.
    avgScore: Math.round(Number(a.avg_score ?? 0) * 100) / 100,
    issuedAt: issuedAt.toISOString(),
  }
}

function canonicalize(p: Payload): string {
  const src = p as unknown as Record<string, unknown>
  const obj: Record<string, unknown> = {}
  for (const k of Object.keys(src).sort()) obj[k] = src[k]
  return JSON.stringify(obj)
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** ¿El estado público cambió desde el último sello? */
function changed(a: AgentRow, last: Record<string, unknown> | null): boolean {
  if (!last) return true
  const cur = buildPayload(a, new Date(0))
  return (
    last.score !== cur.score ||
    last.wins !== cur.wins ||
    last.comps !== cur.comps ||
    last.avgScore !== cur.avgScore ||
    last.name !== cur.name
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

  // ── Autorización ─────────────────────────────────────────────────────────
  let mode: "cron" | "user" | null = null
  let uid: string | null = null
  let isAdmin = false

  const cronSecret = req.headers.get("x-cron-secret")
  if (cronSecret) {
    const { data: match } = await supabase.rpc("cron_secret_matches", { p_secret: cronSecret })
    if (match === true) mode = "cron"
  }
  if (!mode) {
    const token = (req.headers.get("Authorization") ?? "").replace(/^[Bb]earer\s+/, "").trim()
    const { data: userData } = await supabase.auth.getUser(token)
    uid = userData?.user?.id ?? null
    if (uid) {
      mode = "user"
      const { data: perfil } = await supabase.from("profiles").select("is_admin").eq("id", uid).maybeSingle()
      isAdmin = perfil?.is_admin === true
    }
  }
  if (!mode) return json({ ok: false, message: "No autorizado." }, 401)

  // ── Wallet firmante (devnet) ─────────────────────────────────────────────
  const { data: cfg } = await supabase
    .from("internal_config")
    .select("value")
    .eq("key", "solana_attester_secret")
    .maybeSingle()
  if (!cfg?.value) return json({ ok: false, message: "Sello on-chain no configurado." }, 503)

  let signer: Keypair
  try {
    signer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(cfg.value)))
  } catch {
    return json({ ok: false, message: "Llave de la wallet inválida." }, 500)
  }

  const connection = new Connection(RPC, "confirmed")
  const balance = await connection.getBalance(signer.publicKey).catch(() => 0)
  if (balance < 10_000) {
    return json(
      { ok: false, message: "La wallet de sellado no tiene SOL de devnet.", wallet: signer.publicKey.toBase58() },
      503,
    )
  }

  // ── Candidatos ───────────────────────────────────────────────────────────
  let agents: AgentRow[] = []
  if (mode === "cron") {
    const { data } = await supabase
      .from("agents")
      .select("id, name, score, wins, comps_count, avg_score, owner_id")
      .eq("archived", false)
      .gt("comps_count", 0)
      .order("score", { ascending: false })
    agents = (data ?? []) as AgentRow[]
  } else {
    let body: { agentId?: string } = {}
    try {
      body = await req.json()
    } catch {
      /* sin cuerpo */
    }
    if (!body.agentId) return json({ ok: false, message: "Falta agentId." }, 400)
    const { data } = await supabase
      .from("agents")
      .select("id, name, score, wins, comps_count, avg_score, owner_id")
      .eq("id", body.agentId)
      .maybeSingle()
    if (!data) return json({ ok: false, message: "Agente no encontrado." }, 404)
    if (data.owner_id !== uid && !isAdmin) return json({ ok: false, message: "Sólo el dueño puede sellar este agente." }, 403)
    agents = [data as AgentRow]
  }

  const results: { agentId: string; status: string; signature?: string }[] = []
  let sealed = 0

  for (const agent of agents) {
    if (mode === "cron" && sealed >= CRON_BATCH) break

    const { data: last } = await supabase
      .from("onchain_attestations")
      .select("snapshot, issued_at")
      .eq("agent_id", agent.id)
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!changed(agent, (last?.snapshot as Record<string, unknown>) ?? null)) {
      results.push({ agentId: agent.id, status: "sin-cambios" })
      continue
    }
    if (mode === "user" && last && Date.now() - new Date(last.issued_at).getTime() < USER_COOLDOWN_MS) {
      results.push({ agentId: agent.id, status: "espera" })
      continue
    }

    const issuedAt = new Date()
    const payload = buildPayload(agent, issuedAt)
    const hash = await sha256Hex(canonicalize(payload))
    const memo = `${ATTESTATION_PREFIX}:${agent.id}:${hash}`

    try {
      const tx = new Transaction().add(
        new TransactionInstruction({
          keys: [{ pubkey: signer.publicKey, isSigner: true, isWritable: false }],
          programId: new PublicKey(MEMO_PROGRAM_ID),
          data: Buffer.from(memo, "utf8"),
        }),
      )
      const signature = await sendAndConfirmTransaction(connection, tx, [signer], { commitment: "confirmed" })

      const { error } = await supabase.from("onchain_attestations").insert({
        agent_id: agent.id,
        cluster: CLUSTER,
        payload_hash: hash,
        signature,
        wallet: signer.publicKey.toBase58(),
        snapshot: payload,
        issued_at: issuedAt.toISOString(),
      })
      if (error) throw new Error(error.message)

      sealed++
      results.push({ agentId: agent.id, status: "sellado", signature })
    } catch (e) {
      console.error("attest-agents:", agent.id, (e as Error).message)
      results.push({ agentId: agent.id, status: "error" })
    }
  }

  return json({ ok: true, cluster: CLUSTER, wallet: signer.publicKey.toBase58(), sealed, results })
})
