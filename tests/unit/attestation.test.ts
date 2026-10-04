// Pruebas unitarias del sello on-chain (sin red: el RPC de Solana se simula).
// Ejecutar: npm test
//
// Los "vectores dorados" son sellos REALES ya publicados en Solana devnet. Si
// alguien cambia el formato canónico o el hash, estas pruebas fallan, porque
// el cambio invalidaría todos los sellos existentes.

import { createHash } from "node:crypto"
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MEMO_PROGRAM_ID,
  UMBRA_ATTESTER_WALLET,
  ATTESTER_WALLETS,
  agentMemo,
  attesterWallet,
  buildCertificatePayload,
  canonicalize,
  certMemo,
  fetchOnchainTx,
  hashCertificate,
  parseCertificateQuery,
  rpcEndpoints,
  sha256Hex,
  verifyCertificate,
  verifyOnchain,
  type CertificateRecord,
  type OnchainAttestation,
} from "../../lib/solana.ts"

// ── Vectores dorados (producción, Solana devnet) ───────────────────────────

const AGENT_ATT: OnchainAttestation = {
  agentId: "5088abce-4855-4303-938e-4219c06dfa7c",
  cluster: "devnet",
  payloadHash: "eb815fcb080fdc91a42663cc753dc2dc3e5f54b74f4d9c2266f85ef13a342b8c",
  signature: "5bJDWLpEZy1CpQi7DnSuougrfvhAtKR6ifRAj97kBpMHPvtmkjkpFuF381Bi1ud4r1aCew6gn4tt1AEWVknxSeot",
  wallet: UMBRA_ATTESTER_WALLET,
  // Orden de claves tal como lo devuelve jsonb (distinto al original): el hash
  // no debe depender del orden.
  snapshot: {
    name: "Umbra Polymath",
    wins: 19,
    comps: 66,
    score: 304,
    prefix: "umbra:v1",
    agentId: "5088abce-4855-4303-938e-4219c06dfa7c",
    avgScore: 77.76,
    issuedAt: "2026-10-04T22:16:16.711Z",
  } as OnchainAttestation["snapshot"],
  issuedAt: "2026-10-04T22:16:16.711Z",
}

const CERT: CertificateRecord = {
  id: "d4a7ce90-4225-45c2-90e7-1c1b071e8785",
  agentId: "00546beb-f33a-4845-bf17-c40cd5ff58de",
  agentName: "Umbra-pruebas",
  score: 30,
  wins: 3,
  comps: 3,
  avgScore: 76,
  format: "pdf",
  // Postgres devuelve microsegundos: el formato debe truncar a milisegundos.
  issuedAt: "2026-07-22T21:37:49.701163+00:00",
  certHash: "cd844ae89b83b2cc91ab6816a0bbe3bd868366edb2ad5ebc8de8bd80063be802",
  signature: "3oWWNwqJrkDFvf5DezYTuTdUGMSzKigqwY4cHAYbU37PFZuQdEwpyMqSrUwuYnLokYc42gwoY9zdS8CF4SwRbtVx",
  cluster: "devnet",
  wallet: UMBRA_ATTESTER_WALLET,
  onchainAt: null,
}

// ── RPC de Solana simulado ─────────────────────────────────────────────────

interface FakeTx {
  memo: string | null
  signer?: string
}

/** Respuestas en orden; cada llamada consume una. `null` = result vacío. */
function fakeRpc(responses: (FakeTx | null | "http429" | "throw")[]) {
  const calls: unknown[] = []
  const fetcher = (async (_url: string, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)))
    const next = responses.shift() ?? null
    if (next === "throw") throw new Error("red caída")
    if (next === "http429") return new Response("Too Many Requests", { status: 429 })
    if (next === null) return Response.json({ jsonrpc: "2.0", id: 1, result: null })
    const instructions = next.memo === null
      ? [{ programId: "11111111111111111111111111111111", parsed: { type: "transfer" } }]
      : [{ programId: MEMO_PROGRAM_ID, parsed: next.memo }]
    return Response.json({
      jsonrpc: "2.0",
      id: 1,
      result: {
        transaction: {
          message: {
            accountKeys: [{ pubkey: next.signer ?? UMBRA_ATTESTER_WALLET, signer: true, writable: true }],
            instructions,
          },
        },
      },
    })
  }) as typeof fetch
  return { fetcher, calls }
}

// ── Formato canónico y hash ────────────────────────────────────────────────

describe("formato canónico", () => {
  it("ordena las claves: el mismo contenido da el mismo string sin importar el orden", () => {
    assert.equal(canonicalize({ b: 1, a: 2 }), canonicalize({ a: 2, b: 1 }))
    assert.equal(canonicalize({ b: 1, a: 2 }), '{"a":2,"b":1}')
  })

  it("sha256Hex (Web Crypto) coincide con node:crypto", async () => {
    const payload = { z: "ñ ✓ — unicode", n: 77.76, a: [1, 2] }
    const expected = createHash("sha256").update(canonicalize(payload), "utf8").digest("hex")
    assert.equal(await sha256Hex(payload), expected)
  })

  it("reproduce el hash REAL del sello de Trust Score publicado en Solana", async () => {
    assert.equal(await sha256Hex(AGENT_ATT.snapshot), AGENT_ATT.payloadHash)
  })

  it("reproduce el hash REAL de un certificado publicado en Solana", async () => {
    assert.equal(await hashCertificate(CERT), CERT.certHash)
  })

  it("el payload del certificado trunca la fecha a ms y redondea el promedio a 2 decimales", () => {
    const p = buildCertificatePayload({ ...CERT, avgScore: 77.7575757575 })
    assert.equal(p.issuedAt, "2026-07-22T21:37:49.701Z")
    assert.equal(p.avgScore, 77.76)
    assert.equal(p.prefix, "umbra:cert:v1")
  })

  it("los memos tienen el formato documentado", () => {
    assert.equal(agentMemo("A", "h"), "umbra:v1:A:h")
    assert.equal(certMemo("C", "h"), "umbra:cert:v1:C:h")
  })
})

// ── Lectura de la cadena ───────────────────────────────────────────────────

describe("fetchOnchainTx", () => {
  it("devuelve el memo y los firmantes", async () => {
    const { fetcher } = fakeRpc([{ memo: "umbra:v1:x:y" }])
    const tx = await fetchOnchainTx("sig", "devnet", fetcher, 0)
    assert.deepEqual(tx, { memo: "umbra:v1:x:y", signers: [UMBRA_ATTESTER_WALLET] })
  })

  it("pide la tx en jsonParsed y con commitment confirmed", async () => {
    const { fetcher, calls } = fakeRpc([{ memo: "m" }])
    await fetchOnchainTx("SIG123", "devnet", fetcher, 0)
    const body = calls[0] as { method: string; params: [string, { encoding: string; commitment: string }] }
    assert.equal(body.method, "getTransaction")
    assert.equal(body.params[0], "SIG123")
    assert.equal(body.params[1].encoding, "jsonParsed")
    assert.equal(body.params[1].commitment, "confirmed")
  })

  it("reintenta ante límites del RPC (429, result vacío, red caída)", async () => {
    const { fetcher, calls } = fakeRpc(["http429", null, { memo: "ok" }])
    const tx = await fetchOnchainTx("sig", "devnet", fetcher, 0)
    assert.equal(tx?.memo, "ok")
    assert.equal(calls.length, 3)
  })

  it("se rinde tras 3 intentos fallidos", async () => {
    const { fetcher, calls } = fakeRpc(["throw", "http429", null, { memo: "tarde" }])
    assert.equal(await fetchOnchainTx("sig", "devnet", fetcher, 0), null)
    assert.equal(calls.length, 3)
  })

  it("memo null si la transacción no usa el programa Memo", async () => {
    const { fetcher } = fakeRpc([{ memo: null }])
    assert.equal((await fetchOnchainTx("sig", "devnet", fetcher, 0))?.memo, null)
  })
})

// ── Verificación del sello de Trust Score ──────────────────────────────────

describe("verifyOnchain (Trust Score)", () => {
  const goodMemo = agentMemo(AGENT_ATT.agentId, AGENT_ATT.payloadHash)

  it("ok cuando el memo coincide y lo firmó la wallet oficial", async () => {
    const { fetcher } = fakeRpc([{ memo: goodMemo }])
    assert.equal(await verifyOnchain(AGENT_ATT, fetcher, 0), "ok")
  })

  it("detecta datos alterados (score +1)", async () => {
    const { fetcher } = fakeRpc([{ memo: goodMemo }])
    const tampered = { ...AGENT_ATT, snapshot: { ...AGENT_ATT.snapshot, score: 305 } }
    assert.equal(await verifyOnchain(tampered, fetcher, 0), "mismatch")
  })

  it("rechaza un memo idéntico publicado desde OTRA wallet (suplantación)", async () => {
    const { fetcher } = fakeRpc([{ memo: goodMemo, signer: "AttackerWa11et1111111111111111111111111111" }])
    assert.equal(await verifyOnchain(AGENT_ATT, fetcher, 0), "mismatch")
  })

  it("unreachable si la red no responde", async () => {
    const { fetcher } = fakeRpc(["throw", "throw", "throw"])
    assert.equal(await verifyOnchain(AGENT_ATT, fetcher, 0), "unreachable")
  })
})

// ── Verificación de certificados ───────────────────────────────────────────

describe("verifyCertificate", () => {
  const goodMemo = certMemo(CERT.id, CERT.certHash!)

  it("ok: hash recalculado = registrado = memo on-chain, firmado por Umbra", async () => {
    const { fetcher } = fakeRpc([{ memo: goodMemo }])
    const r = await verifyCertificate(CERT, fetcher, 0)
    assert.equal(r.result, "ok")
    assert.equal(r.hashMatches, true)
    assert.equal(r.signerOk, true)
    assert.equal(r.computedHash, CERT.certHash)
  })

  for (const [campo, cambio] of [
    ["agentName", { agentName: "Otro agente" }],
    ["score", { score: 31 }],
    ["wins", { wins: 4 }],
    ["comps", { comps: 4 }],
    ["avgScore", { avgScore: 76.01 }],
    ["format", { format: "web" }],
    ["issuedAt", { issuedAt: "2026-07-22T21:37:50.000Z" }],
    ["agentId", { agentId: "00000000-0000-4000-8000-000000000000" }],
  ] as const) {
    it(`detecta un certificado alterado (${campo})`, async () => {
      const { fetcher } = fakeRpc([{ memo: goodMemo }])
      const r = await verifyCertificate({ ...CERT, ...cambio }, fetcher, 0)
      assert.equal(r.result, "mismatch")
      assert.equal(r.hashMatches, false)
    })
  }

  it("rechaza el sello de OTRO certificado (memo de otro ID)", async () => {
    const { fetcher } = fakeRpc([{ memo: certMemo("11111111-1111-4111-8111-111111111111", CERT.certHash!) }])
    assert.equal((await verifyCertificate(CERT, fetcher, 0)).result, "mismatch")
  })

  it("rechaza un memo correcto firmado por otra wallet", async () => {
    const { fetcher } = fakeRpc([{ memo: goodMemo, signer: "AttackerWa11et1111111111111111111111111111" }])
    const r = await verifyCertificate(CERT, fetcher, 0)
    assert.equal(r.result, "mismatch")
    assert.equal(r.signerOk, false)
  })

  it("pending si el certificado aún no tiene transacción", async () => {
    const { fetcher, calls } = fakeRpc([])
    const r = await verifyCertificate({ ...CERT, signature: null }, fetcher, 0)
    assert.equal(r.result, "pending")
    assert.equal(calls.length, 0, "no debe consultar la red")
  })

  it("unreachable si Solana no responde", async () => {
    const { fetcher } = fakeRpc(["throw", "throw", "throw"])
    assert.equal((await verifyCertificate(CERT, fetcher, 0)).result, "unreachable")
  })
})

// ── Búsqueda en /verificar ─────────────────────────────────────────────────

describe("parseCertificateQuery", () => {
  const ID = "0890da09-b5f1-4e2d-967e-9794b68309fd"
  const HASH = "9e3fda17f44bcbfeae32fb50beb28d37c308dce1e467f6eeb1f701d590b14da6"

  it("reconoce el ID del certificado", () => {
    assert.deepEqual(parseCertificateQuery(ID), { id: ID })
    assert.deepEqual(parseCertificateQuery(`  ${ID.toUpperCase()}  `), { id: ID })
  })

  it("reconoce el hash SHA-256", () => {
    assert.deepEqual(parseCertificateQuery(HASH), { hash: HASH })
    assert.deepEqual(parseCertificateQuery(HASH.toUpperCase()), { hash: HASH })
  })

  it("extrae el ID de la URL del código QR", () => {
    assert.deepEqual(parseCertificateQuery(`https://umbra-agents.vercel.app/verificar?c=${ID}`), { id: ID })
  })

  it("rechaza datos que no son ni ID ni hash", () => {
    assert.equal(parseCertificateQuery("certificado-falso-123"), null)
    assert.equal(parseCertificateQuery(""), null)
    assert.equal(parseCertificateQuery(HASH.slice(0, 63)), null, "hash incompleto")
    assert.equal(parseCertificateQuery(HASH + "a"), null, "hash con un carácter de más")
  })
})

// ── Dos redes: devnet y mainnet ────────────────────────────────────────────

describe("redes (devnet / mainnet)", () => {
  it("cada red tiene su propia wallet oficial", () => {
    assert.equal(attesterWallet("devnet"), UMBRA_ATTESTER_WALLET)
    assert.notEqual(attesterWallet("mainnet-beta"), attesterWallet("devnet"))
    assert.equal(ATTESTER_WALLETS["mainnet-beta"], "6xBKjoTBabB5zrboXweLd6N14T87vcD5aq1mFxGTNutK")
  })

  it("en mainnet el navegador lee por PublicNode (el RPC oficial bloquea navegadores)", () => {
    assert.equal(rpcEndpoints("mainnet-beta")[0], "https://solana-rpc.publicnode.com")
    assert.ok(rpcEndpoints("mainnet-beta").includes("https://api.mainnet-beta.solana.com"))
    assert.deepEqual(rpcEndpoints("devnet"), ["https://api.devnet.solana.com"])
  })

  it("rota de RPC en cada reintento", async () => {
    const urls: string[] = []
    const fetcher = (async (url: string) => {
      urls.push(url)
      return new Response("busy", { status: 429 })
    }) as unknown as typeof fetch
    await fetchOnchainTx("sig", "mainnet-beta", fetcher, 0)
    assert.deepEqual(urls, [
      "https://solana-rpc.publicnode.com",
      "https://api.mainnet-beta.solana.com",
      "https://solana-rpc.publicnode.com",
    ])
  })

  it("un sello de mainnet firmado con la wallet de DEVNET no verifica", async () => {
    const mainnetCert = { ...CERT, cluster: "mainnet-beta" as const }
    const { fetcher } = fakeRpc([{ memo: certMemo(CERT.id, CERT.certHash!), signer: ATTESTER_WALLETS.devnet }])
    const r = await verifyCertificate(mainnetCert, fetcher, 0)
    assert.equal(r.result, "mismatch")
    assert.equal(r.signerOk, false)
  })

  it("un sello de mainnet firmado con la wallet de mainnet verifica", async () => {
    const mainnetCert = { ...CERT, cluster: "mainnet-beta" as const }
    const { fetcher } = fakeRpc([
      { memo: certMemo(CERT.id, CERT.certHash!), signer: ATTESTER_WALLETS["mainnet-beta"] },
    ])
    assert.equal((await verifyCertificate(mainnetCert, fetcher, 0)).result, "ok")
  })
})
