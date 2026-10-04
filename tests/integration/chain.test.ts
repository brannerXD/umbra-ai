// Pruebas de INTEGRACIÓN del sello on-chain, contra el entorno real:
// Supabase (sólo con la anon key pública), las Edge Functions y Solana devnet.
// Ejecutar: npm run test:chain   (lee NEXT_PUBLIC_SUPABASE_* de .env.local)
//
// No escriben nada salvo lo que cualquier visitante anónimo podría intentar
// (y comprueban que se le RECHAZA). No crean certificados ni gastan SOL.

import assert from "node:assert/strict"
import { before, describe, it } from "node:test"
import {
  attesterWallet,
  fetchOnchainTx,
  type CertificateRecord,
  type OnchainAttestation,
  verifyCertificate,
  verifyOnchain,
} from "../../lib/solana.ts"

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const skip = !URL_ || !ANON ? "faltan NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY" : false

const H = () => ({ apikey: ANON!, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" })
/** El RPC público de devnet limita ráfagas: espaciamos las consultas. */
const pause = (ms = 350) => new Promise((r) => setTimeout(r, ms))

/**
 * Ejecuta una verificación tolerando el límite del RPC público: "unreachable"
 * es un fallo de RED (se reintenta con espera larga), no de datos. Un
 * "mismatch" nunca se reintenta: es un fallo real.
 */
async function withNetRetry<T extends string>(check: () => Promise<T>): Promise<T> {
  let r = await check()
  for (let i = 0; i < 3 && r === "unreachable"; i++) {
    await pause(4000)
    r = await check()
  }
  return r
}

async function rest<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...H(), ...(init?.headers ?? {}) } })
  const text = await res.text()
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T }
}

async function fn(name: string, body: unknown, headers: Record<string, string> = H(), method = "POST") {
  const res = await fetch(`${URL_}/functions/v1/${name}`, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json: Record<string, unknown> | null = null
  try {
    json = JSON.parse(text)
  } catch {
    /* no JSON */
  }
  return { status: res.status, json }
}

interface AttRow {
  agent_id: string
  cluster: "devnet" | "mainnet-beta"
  payload_hash: string
  signature: string
  wallet: string
  snapshot: OnchainAttestation["snapshot"]
  issued_at: string
}

interface CertRow {
  id: string
  agent_id: string
  agent_name: string
  score: number
  wins: number
  comps_count: number
  avg_score: number
  format: string
  issued_at: string
  cert_hash: string | null
  onchain_signature: string | null
  onchain_cluster: "devnet" | "mainnet-beta" | null
  onchain_wallet: string | null
  onchain_at: string | null
}

const toCert = (r: CertRow): CertificateRecord => ({
  id: r.id,
  agentId: r.agent_id,
  agentName: r.agent_name,
  score: r.score,
  wins: r.wins,
  comps: r.comps_count,
  avgScore: Number(r.avg_score),
  format: r.format,
  issuedAt: r.issued_at,
  certHash: r.cert_hash,
  signature: r.onchain_signature,
  cluster: r.onchain_cluster,
  wallet: r.onchain_wallet,
  onchainAt: r.onchain_at,
})

describe("sellos de Trust Score en Solana", { skip }, () => {
  let rows: AttRow[] = []
  before(async () => {
    rows = (await rest<AttRow[]>("onchain_attestations?select=*&order=issued_at.desc&limit=40")).body
  })

  it("hay sellos publicados", () => {
    assert.ok(rows.length > 0, "no hay filas en onchain_attestations")
  })

  it("TODOS verifican contra la cadena (hash + memo + wallet oficial)", async () => {
    const failed: string[] = []
    for (const r of rows) {
      const res = await withNetRetry(() =>
        verifyOnchain({
          agentId: r.agent_id,
          cluster: r.cluster,
          payloadHash: r.payload_hash,
          signature: r.signature,
          wallet: r.wallet,
          snapshot: r.snapshot,
          issuedAt: r.issued_at,
        }),
      )
      if (res !== "ok") failed.push(`${r.snapshot.name}: ${res}`)
      await pause()
    }
    assert.deepEqual(failed, [])
  })

  it("todos los registró la wallet oficial de su red", () => {
    for (const r of rows) assert.equal(r.wallet, attesterWallet(r.cluster))
  })

  it("un snapshot alterado NO verifica (detección de manipulación con datos reales)", async () => {
    const r = rows[0]
    const res = await verifyOnchain({
      agentId: r.agent_id,
      cluster: r.cluster,
      payloadHash: r.payload_hash,
      signature: r.signature,
      wallet: r.wallet,
      snapshot: { ...r.snapshot, score: r.snapshot.score + 1 },
      issuedAt: r.issued_at,
    })
    assert.equal(res, "mismatch")
  })
})

describe("sellos de certificados en Solana", { skip }, () => {
  let certs: CertRow[] = []
  before(async () => {
    certs = (await rest<CertRow[]>("certificate_issuances?select=*&order=issued_at.desc&limit=40")).body
  })

  it("todos los certificados emitidos tienen su sello on-chain", () => {
    const pending = certs.filter((c) => !c.onchain_signature).map((c) => c.id)
    assert.deepEqual(pending, [], "certificados sin sellar (el cron debería sellarlos en < 1 h)")
  })

  it("TODOS verifican contra la cadena (hash recalculado + memo + wallet oficial)", async () => {
    const failed: string[] = []
    for (const c of certs.filter((x) => x.onchain_signature)) {
      let r = await verifyCertificate(toCert(c))
      for (let i = 0; i < 3 && r.result === "unreachable"; i++) {
        await pause(4000)
        r = await verifyCertificate(toCert(c))
      }
      if (r.result !== "ok") failed.push(`${c.id}: ${r.result} (hash=${r.hashMatches} signer=${r.signerOk})`)
      await pause()
    }
    assert.deepEqual(failed, [])
  })

  it("la transacción la firmó la wallet oficial de Umbra", async () => {
    const c = certs.find((x) => x.onchain_signature)!
    const cluster = c.onchain_cluster ?? "devnet"
    const tx = await fetchOnchainTx(c.onchain_signature!, cluster)
    assert.ok(tx, "no se pudo leer la tx")
    assert.ok(tx.signers.includes(attesterWallet(cluster)))
  })

  it("un certificado alterado NO verifica", async () => {
    const c = certs.find((x) => x.onchain_signature)!
    const r = await verifyCertificate({ ...toCert(c), agentName: c.agent_name + " (falso)" })
    assert.equal(r.result, "mismatch")
  })
})

describe("seguridad de las Edge Functions", { skip }, () => {
  const noAuth = { "Content-Type": "application/json" }

  it("attest-agents sin credenciales → 401", async () => {
    assert.equal((await fn("attest-agents", {}, noAuth)).status, 401)
  })

  it("attest-agents con la anon key (sin usuario) → 401", async () => {
    assert.equal((await fn("attest-agents", { agentId: "5088abce-4855-4303-938e-4219c06dfa7c" })).status, 401)
  })

  it("attest-agents con un secreto de cron falso → 401", async () => {
    const r = await fn("attest-agents", {}, { ...H(), "x-cron-secret": "secreto-falso" })
    assert.equal(r.status, 401)
  })

  it("attest-certificate rechaza métodos que no son POST", async () => {
    assert.equal((await fn("attest-certificate", null, H(), "GET")).status, 405)
  })

  it("attest-certificate rechaza IDs inválidos (400) e inexistentes (404)", async () => {
    assert.equal((await fn("attest-certificate", { certId: "1; drop table" })).status, 400)
    assert.equal((await fn("attest-certificate", {})).status, 400)
    assert.equal(
      (await fn("attest-certificate", { certId: "00000000-0000-4000-8000-000000000000" })).status,
      404,
    )
  })

  it("attest-certificate es idempotente: un certificado sellado devuelve SU sello, sin crear otro", async () => {
    const { body } = await rest<CertRow[]>(
      "certificate_issuances?select=id,cert_hash,onchain_signature&onchain_signature=not.is.null&limit=1",
    )
    const c = body[0]
    const r = await fn("attest-certificate", { certId: c.id })
    assert.equal(r.status, 200)
    const res = (r.json?.results as { status: string; signature: string; hash: string }[])[0]
    assert.equal(res.status, "existente")
    assert.equal(res.signature, c.onchain_signature)
    assert.equal(res.hash, c.cert_hash)
  })
})

describe("permisos de la base (anon)", { skip }, () => {
  it("no puede insertar sellos falsos en onchain_attestations", async () => {
    const r = await rest("onchain_attestations", {
      method: "POST",
      body: JSON.stringify({
        agent_id: "5088abce-4855-4303-938e-4219c06dfa7c",
        payload_hash: "0".repeat(64),
        signature: "falsa",
        wallet: "falsa",
        snapshot: {},
      }),
    })
    assert.ok(r.status === 401 || r.status === 403, `status ${r.status}`)
  })

  it("no puede alterar el hash ni la firma de un certificado", async () => {
    const { body } = await rest<CertRow[]>("certificate_issuances?select=id,cert_hash&cert_hash=not.is.null&limit=1")
    const c = body[0]
    const r = await rest(`certificate_issuances?id=eq.${c.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ cert_hash: "f".repeat(64) }),
    })
    assert.ok(r.status === 401 || r.status === 403, `status ${r.status}`)
    const after = await rest<CertRow[]>(`certificate_issuances?select=cert_hash&id=eq.${c.id}`)
    assert.equal(after.body[0].cert_hash, c.cert_hash, "el hash cambió")
  })

  it("no puede leer la llave de la wallet (internal_config)", async () => {
    const r = await rest<unknown[]>("internal_config?select=*")
    const leaked = Array.isArray(r.body) && r.body.length > 0
    assert.equal(leaked, false, "internal_config es legible por anon")
  })
})

describe("salud del sitio en producción", { skip }, () => {
  const SITE = process.env.UMBRA_SITE_URL ?? "https://umbra-agents.vercel.app"

  it("/api/health: la llave secreta de Supabase funciona y la wallet responde", async (t) => {
    const res = await fetch(`${SITE}/api/health`)
    if (res.status === 404) return t.skip("ruta aún no desplegada")
    const h = (await res.json()) as {
      ok: boolean
      supabaseSecretKey: string
      solana: { cluster: "devnet" | "mainnet-beta"; wallet: string; balanceSol: number | null }
    }
    assert.equal(h.supabaseSecretKey, "ok")
    assert.equal(h.solana.wallet, attesterWallet(h.solana.cluster))
    assert.ok(h.solana.balanceSol !== null && h.solana.balanceSol > 0, "wallet sin saldo")
  })
})
