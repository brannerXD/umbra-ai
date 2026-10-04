// ========================================
// UMBRA — Firma y envío de memos a Solana (sólo Edge Functions)
// ========================================
// La red activa se elige en public.internal_config ('solana_cluster':
// 'devnet' | 'mainnet-beta'), así se cambia sin redesplegar. Cada red tiene su
// propia wallet firmante; las llaves viven en internal_config (RLS sin
// grants → sólo service_role) y nunca en el repositorio:
//   devnet       → 'solana_attester_secret'
//   mainnet-beta → 'solana_attester_secret_mainnet'
//
// En mainnet cada sello cuesta SOL REAL (~0.000005 SOL), así que hay dos
// frenos: una reserva mínima que nunca se gasta y un tope de sellos por hora
// (protege la wallet aunque alguien fuerce muchas emisiones).

import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "npm:@solana/web3.js@1.98.4"
import { Buffer } from "node:buffer"
import { MEMO_PROGRAM_ID } from "./umbra-attestation.ts"

export type Cluster = "devnet" | "mainnet-beta"

const NETWORKS: Record<Cluster, { rpc: string; secretKey: string; minBalance: number; hourlyCap: number }> = {
  devnet: {
    rpc: "https://api.devnet.solana.com",
    secretKey: "solana_attester_secret",
    // ~2 transacciones: devnet es gratis, sólo evitamos fallos por saldo.
    minBalance: 10_000,
    hourlyCap: Number.POSITIVE_INFINITY,
  },
  "mainnet-beta": {
    rpc: "https://api.mainnet-beta.solana.com",
    secretKey: "solana_attester_secret_mainnet",
    // Reserva: mínimo rent-exempt de una cuenta (~0.00065 SOL) + margen. Por
    // debajo de esto Solana rechaza la tx; nunca se toca.
    minBalance: 1_000_000,
    // Tope de sellos (agentes + certificados) por hora en dinero real.
    hourlyCap: 30,
  },
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

export interface Signer {
  keypair: Keypair
  connection: Connection
  wallet: string
  cluster: Cluster
  /** Sellos que aún se pueden publicar en esta hora (Infinity en devnet). */
  budget: number
}

/** Red activa según internal_config (devnet si no está configurada). */
export async function activeCluster(supabase: SupabaseClient): Promise<Cluster> {
  const { data } = await supabase.from("internal_config").select("value").eq("key", "solana_cluster").maybeSingle()
  return data?.value === "mainnet-beta" ? "mainnet-beta" : "devnet"
}

/** Sellos publicados en la última hora en `cluster` (agentes + certificados). */
async function sealsLastHour(supabase: SupabaseClient, cluster: Cluster): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const [a, c] = await Promise.all([
    supabase
      .from("onchain_attestations")
      .select("id", { count: "exact", head: true })
      .eq("cluster", cluster)
      .gte("created_at", since),
    supabase
      .from("certificate_issuances")
      .select("id", { count: "exact", head: true })
      .eq("onchain_cluster", cluster)
      .gte("onchain_at", since),
  ])
  return (a.count ?? 0) + (c.count ?? 0)
}

/**
 * Carga la wallet de la red activa y comprueba saldo y tope horario. Devuelve
 * una Response de error lista para devolver si no se puede sellar.
 */
export async function loadSigner(supabase: SupabaseClient): Promise<Signer | Response> {
  const cluster = await activeCluster(supabase)
  const net = NETWORKS[cluster]

  const { data: cfg } = await supabase.from("internal_config").select("value").eq("key", net.secretKey).maybeSingle()
  if (!cfg?.value) return json({ ok: false, message: `Sello on-chain no configurado (${cluster}).` }, 503)

  let keypair: Keypair
  try {
    keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(cfg.value)))
  } catch {
    return json({ ok: false, message: "Llave de la wallet inválida." }, 500)
  }

  const connection = new Connection(net.rpc, "confirmed")
  const wallet = keypair.publicKey.toBase58()
  const balance = await connection.getBalance(keypair.publicKey).catch(() => 0)
  if (balance < net.minBalance) {
    return json({ ok: false, message: `La wallet de sellado no tiene saldo suficiente en ${cluster}.`, wallet, cluster }, 503)
  }

  let budget = Number.POSITIVE_INFINITY
  if (Number.isFinite(net.hourlyCap)) {
    budget = Math.max(0, net.hourlyCap - (await sealsLastHour(supabase, cluster)))
    // Además, nunca gastar por debajo de la reserva: ~5000 lamports por sello.
    budget = Math.min(budget, Math.floor((balance - net.minBalance) / 5000))
  }
  return { keypair, connection, wallet, cluster, budget }
}

/** Publica un memo firmado por la wallet de Umbra y espera su confirmación. */
export async function sendMemo(signer: Signer, memo: string): Promise<string> {
  if (signer.budget <= 0) throw new Error("Tope de sellos por hora alcanzado.")
  const tx = new Transaction().add(
    new TransactionInstruction({
      keys: [{ pubkey: signer.keypair.publicKey, isSigner: true, isWritable: false }],
      programId: new PublicKey(MEMO_PROGRAM_ID),
      data: Buffer.from(memo, "utf8"),
    }),
  )
  const signature = await sendAndConfirmTransaction(signer.connection, tx, [signer.keypair], { commitment: "confirmed" })
  signer.budget -= 1
  return signature
}

/** ¿La petición trae el secreto del cron interno? */
export async function isCron(supabase: SupabaseClient, req: Request): Promise<boolean> {
  const secret = req.headers.get("x-cron-secret")
  if (!secret) return false
  const { data } = await supabase.rpc("cron_secret_matches", { p_secret: secret })
  return data === true
}
