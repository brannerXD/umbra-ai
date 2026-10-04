// ========================================
// UMBRA — Firma y envío de memos a Solana (sólo Edge Functions)
// ========================================
// SOLO DEVNET: no gasta dinero real. La llave de la wallet firmante vive en
// public.internal_config ('solana_attester_secret'; RLS sin grants → sólo
// service_role) y nunca en el repositorio.

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

export const CLUSTER = "devnet"
const RPC = "https://api.devnet.solana.com"
/** Por debajo de esto (lamports) no se intenta sellar: ~2 transacciones. */
const MIN_BALANCE = 10_000

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
}

/**
 * Carga la wallet firmante y comprueba que tenga fondos. Devuelve una
 * Response de error lista para devolver si algo falla.
 */
export async function loadSigner(supabase: SupabaseClient): Promise<Signer | Response> {
  const { data: cfg } = await supabase
    .from("internal_config")
    .select("value")
    .eq("key", "solana_attester_secret")
    .maybeSingle()
  if (!cfg?.value) return json({ ok: false, message: "Sello on-chain no configurado." }, 503)

  let keypair: Keypair
  try {
    keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(cfg.value)))
  } catch {
    return json({ ok: false, message: "Llave de la wallet inválida." }, 500)
  }

  const connection = new Connection(RPC, "confirmed")
  const wallet = keypair.publicKey.toBase58()
  const balance = await connection.getBalance(keypair.publicKey).catch(() => 0)
  if (balance < MIN_BALANCE) {
    return json({ ok: false, message: "La wallet de sellado no tiene SOL de devnet.", wallet }, 503)
  }
  return { keypair, connection, wallet }
}

/** Publica un memo firmado por la wallet de Umbra y espera su confirmación. */
export async function sendMemo(signer: Signer, memo: string): Promise<string> {
  const tx = new Transaction().add(
    new TransactionInstruction({
      keys: [{ pubkey: signer.keypair.publicKey, isSigner: true, isWritable: false }],
      programId: new PublicKey(MEMO_PROGRAM_ID),
      data: Buffer.from(memo, "utf8"),
    }),
  )
  return await sendAndConfirmTransaction(signer.connection, tx, [signer.keypair], { commitment: "confirmed" })
}

/** ¿La petición trae el secreto del cron interno? */
export async function isCron(supabase: SupabaseClient, req: Request): Promise<boolean> {
  const secret = req.headers.get("x-cron-secret")
  if (!secret) return false
  const { data } = await supabase.rpc("cron_secret_matches", { p_secret: secret })
  return data === true
}
