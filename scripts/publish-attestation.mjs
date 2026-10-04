// ========================================
// UMBRA — Publicar una atestación de Trust Score en Solana
// ========================================
// Publica en la cadena (devnet por defecto) el hash del estado reputacional de
// un agente, usando el programa Memo. Prueba de extremo a extremo de que Umbra
// es compatible con Solana. NO gasta dinero real: devnet usa SOL de airdrop.
//
// Uso:
//   node scripts/publish-attestation.mjs \
//     --agentId <id> --name "<nombre>" --score 92 --wins 5 --comps 20 --avgScore 88
//
// Sin argumentos usa un agente de ejemplo. La wallet de firma es un keypair
// desechable que se guarda en scripts/.devnet-keypair.json (ignorado por git).
// El formato del payload/hash es idéntico al de lib/solana.ts (mantener en par).

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
const ATTESTATION_PREFIX = "umbra:v1"
const CLUSTER = process.env.SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet"
const RPC = CLUSTER === "mainnet-beta" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com"

const __dirname = dirname(fileURLToPath(import.meta.url))
const KEYPAIR_PATH = join(__dirname, ".devnet-keypair.json")

// ── args ────────────────────────────────────────────────────────────────
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const agent = {
  id: arg("agentId", "demo-agent-0001"),
  name: arg("name", "Umbra Codex"),
  score: Number(arg("score", "92")),
  wins: Number(arg("wins", "5")),
  comps: Number(arg("comps", "20")),
  avgScore: Number(arg("avgScore", "88")),
}

// ── mismo formato canónico y hash que lib/solana.ts ──────────────────────
function buildPayload(a, issuedAt) {
  return {
    prefix: ATTESTATION_PREFIX,
    agentId: a.id,
    name: a.name,
    score: a.score,
    wins: a.wins,
    comps: a.comps,
    avgScore: Math.round(a.avgScore * 100) / 100,
    issuedAt: issuedAt.toISOString(),
  }
}
function canonicalize(payload) {
  const keys = Object.keys(payload).sort()
  const obj = {}
  for (const k of keys) obj[k] = payload[k]
  return JSON.stringify(obj)
}
function sha256Hex(str) {
  return createHash("sha256").update(str, "utf8").digest("hex")
}

// ── wallet desechable de devnet ──────────────────────────────────────────
function loadOrCreateKeypair() {
  if (existsSync(KEYPAIR_PATH)) {
    const secret = JSON.parse(readFileSync(KEYPAIR_PATH, "utf8"))
    return Keypair.fromSecretKey(Uint8Array.from(secret))
  }
  const kp = Keypair.generate()
  mkdirSync(dirname(KEYPAIR_PATH), { recursive: true })
  writeFileSync(KEYPAIR_PATH, JSON.stringify(Array.from(kp.secretKey)))
  console.log(`🔑 Nueva wallet devnet creada: ${kp.publicKey.toBase58()}`)
  return kp
}

async function ensureFunds(connection, kp) {
  const bal = await connection.getBalance(kp.publicKey)
  if (bal >= 0.005 * LAMPORTS_PER_SOL) return bal
  console.log("💧 Solicitando airdrop de devnet (0.5 SOL)...")
  try {
    const sig = await connection.requestAirdrop(kp.publicKey, 0.5 * LAMPORTS_PER_SOL)
    await connection.confirmTransaction(sig, "confirmed")
  } catch (e) {
    console.warn(`⚠️  Airdrop falló (devnet suele limitar). ${e.message}`)
  }
  return connection.getBalance(kp.publicKey)
}

async function main() {
  if (CLUSTER === "mainnet-beta") {
    console.error("⛔ Refuse: este script es solo para devnet. mainnet gasta SOL real.")
    process.exit(1)
  }
  console.log(`\n🌑 UMBRA · Atestación de Trust Score → Solana (${CLUSTER})\n`)

  const issuedAt = new Date()
  const payload = buildPayload(agent, issuedAt)
  const canonical = canonicalize(payload)
  const hash = sha256Hex(canonical)
  const memo = `${ATTESTATION_PREFIX}:${agent.id}:${hash}`

  console.log("Agente:      ", agent.name, `(${agent.id})`)
  console.log("Payload:     ", canonical)
  console.log("Hash SHA-256:", hash)
  console.log("Memo on-chain:", memo, "\n")

  const connection = new Connection(RPC, "confirmed")
  const kp = loadOrCreateKeypair()
  console.log("Wallet:      ", kp.publicKey.toBase58())

  const bal = await ensureFunds(connection, kp)
  console.log("Balance:     ", (bal / LAMPORTS_PER_SOL).toFixed(4), "SOL")
  if (bal < 0.001 * LAMPORTS_PER_SOL) {
    console.error("\n⛔ Sin fondos para pagar la tx (airdrop de devnet no disponible ahora).")
    console.error("   Reintenta más tarde o financia la wallet con `solana airdrop 1` en devnet.")
    process.exit(2)
  }

  const ix = new TransactionInstruction({
    keys: [],
    programId: new PublicKey(MEMO_PROGRAM_ID),
    data: Buffer.from(memo, "utf8"),
  })
  const tx = new Transaction().add(ix)

  console.log("\n📡 Enviando transacción...")
  const signature = await sendAndConfirmTransaction(connection, tx, [kp])

  const explorer = `https://explorer.solana.com/tx/${signature}?cluster=${CLUSTER}`
  console.log("\n✅ Atestación publicada on-chain")
  console.log("Firma:    ", signature)
  console.log("Explorer: ", explorer, "\n")

  // Deja constancia local del resultado (para registrar luego en la DB).
  const record = { cluster: CLUSTER, agentId: agent.id, hash, signature, explorer, issuedAt: issuedAt.toISOString(), wallet: kp.publicKey.toBase58() }
  writeFileSync(join(__dirname, "last-attestation.json"), JSON.stringify(record, null, 2))
  console.log("📝 Guardado en scripts/last-attestation.json")
}

main().catch((e) => {
  console.error("\n❌ Error:", e.message)
  process.exit(1)
})
