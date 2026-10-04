// ========================================
// UMBRA — Sello on-chain del Trust Score (Solana)
// ========================================
// Publica en Solana una "atestación" del estado reputacional de un agente: el
// SHA-256 de su snapshot público (score, victorias, competencias, promedio)
// escrito con el programa Memo. Cualquiera puede recalcular el hash desde el
// snapshot guardado y compararlo con el memo de la transacción → reputación
// verificable e independiente de nuestro servidor.
//
// Formato: ../_shared/umbra-attestation.ts (fuente única, también la usa la web).
//
// Llamadores permitidos:
//   (a) el CRON interno (x-cron-secret) → sella los agentes cuyo estado cambió.
//   (b) el DUEÑO del agente o un ADMIN → sella un agente concreto ya.

import { createClient } from "npm:@supabase/supabase-js@2"
import { agentMemo, buildAgentPayload, sha256Hex } from "../_shared/umbra-attestation.ts"
import { CORS_HEADERS, isCron, json, loadSigner, sendMemo } from "../_shared/solana-signer.ts"

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

const AGENT_COLS = "id, name, score, wins, comps_count, avg_score, owner_id"

function toPayload(a: AgentRow, issuedAt: Date) {
  return buildAgentPayload(
    {
      id: a.id,
      name: a.name,
      score: a.score ?? 0,
      wins: a.wins ?? 0,
      comps: a.comps_count ?? 0,
      avgScore: Number(a.avg_score ?? 0),
    },
    issuedAt,
  )
}

/** ¿El estado público cambió desde el último sello? */
function changed(a: AgentRow, last: Record<string, unknown> | null): boolean {
  if (!last) return true
  const cur = toPayload(a, new Date(0))
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
  let mode: "cron" | "user" | null = (await isCron(supabase, req)) ? "cron" : null
  let uid: string | null = null
  let isAdmin = false
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

  // ── Candidatos ───────────────────────────────────────────────────────────
  let agents: AgentRow[] = []
  if (mode === "cron") {
    const { data } = await supabase
      .from("agents")
      .select(AGENT_COLS)
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
    const { data } = await supabase.from("agents").select(AGENT_COLS).eq("id", body.agentId).maybeSingle()
    if (!data) return json({ ok: false, message: "Agente no encontrado." }, 404)
    if (data.owner_id !== uid && !isAdmin) {
      return json({ ok: false, message: "Sólo el dueño puede sellar este agente." }, 403)
    }
    agents = [data as AgentRow]
  }

  const signer = await loadSigner(supabase)
  if (signer instanceof Response) return signer

  const results: { agentId: string; status: string; signature?: string }[] = []
  let sealed = 0

  for (const agent of agents) {
    if (mode === "cron" && sealed >= CRON_BATCH) break
    if (signer.budget <= 0) {
      // Tope por hora (mainnet) o reserva mínima: el cron sigue la próxima hora.
      results.push({ agentId: agent.id, status: "tope" })
      break
    }

    // Último sello EN LA RED ACTIVA: al pasar de devnet a mainnet, cada agente
    // se sella una vez en la red nueva.
    const { data: last } = await supabase
      .from("onchain_attestations")
      .select("snapshot, issued_at")
      .eq("agent_id", agent.id)
      .eq("cluster", signer.cluster)
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
    const payload = toPayload(agent, issuedAt)
    const hash = await sha256Hex(payload)

    try {
      const signature = await sendMemo(signer, agentMemo(agent.id, hash))
      const { error } = await supabase.from("onchain_attestations").insert({
        agent_id: agent.id,
        cluster: signer.cluster,
        payload_hash: hash,
        signature,
        wallet: signer.wallet,
        snapshot: payload,
        issued_at: payload.issuedAt,
      })
      if (error) throw new Error(error.message)
      sealed++
      results.push({ agentId: agent.id, status: "sellado", signature })
    } catch (e) {
      console.error("attest-agents:", agent.id, (e as Error).message)
      results.push({ agentId: agent.id, status: "error" })
    }
  }

  return json({ ok: true, cluster: signer.cluster, wallet: signer.wallet, sealed, results })
})
