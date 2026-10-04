// ========================================
// UMBRA — CAPA DE BLOCKCHAIN (SOLANA)
// ========================================
// Umbra publica en Solana una "atestación" del Trust Score de un agente: un
// hash SHA-256 del estado reputacional (score, victorias, competencias...) en
// un momento dado. Ese hash queda escrito on-chain vía el programa Memo.
//
// Por qué sirve: cualquiera puede recalcular el hash a partir de los datos
// PÚBLICOS del agente y compararlo con el que está en la cadena. Si coinciden,
// se prueba que ese Trust Score existía en esa fecha y no fue alterado. Es
// reputación verificable e independiente de nuestro servidor.
//
// Este módulo es PURO (sin dependencias externas ni claves): solo define el
// formato canónico, el hash y las URLs del explorador. La FIRMA y el ENVÍO de
// la transacción viven en `scripts/publish-attestation.mjs` (fuera del bundle),
// para no cargar la wallet ni @solana/web3.js en el navegador.

/** Red de Solana a la que apunta la atestación. */
export type SolanaCluster = "devnet" | "mainnet-beta"

/** Cluster activo. Se controla por env; por defecto devnet (gratis, sin riesgo). */
export const SOLANA_CLUSTER: SolanaCluster =
  (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as SolanaCluster) === "mainnet-beta"
    ? "mainnet-beta"
    : "devnet"

/** Programa Memo de la SPL — escribe texto arbitrario en una transacción. */
export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"

/** Prefijo/versión del formato de atestación, para poder evolucionarlo. */
export const ATTESTATION_PREFIX = "umbra:v1"

/** RPC público para leer/escribir en la red elegida. */
export function rpcEndpoint(cluster: SolanaCluster = SOLANA_CLUSTER): string {
  return cluster === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com"
}

// ─── Flags de conexión (todo apagado por defecto) ──────────────────────────
// La blockchain queda "cableada" pero inerte hasta rellenar estas env. Así se
// puede desplegar sin cambiar el comportamiento del sitio en vivo.

/** ¿Mostrar/usar las atestaciones de Trust Score on-chain? */
export function attestationsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SOLANA_ATTESTATIONS === "true"
}

/** ¿Aceptar pagos en stablecoin por Solana (riel híbrido)? */
export function solanaPaymentsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SOLANA_PAYMENTS === "true"
}

/** Wallet que RECIBE los pagos (dirección pública; seguro exponerla). */
export function treasuryAddress(): string | null {
  return process.env.NEXT_PUBLIC_SOLANA_TREASURY?.trim() || null
}

// Mints de USDC oficiales por red. El mint del token de pago es configurable
// (NEXT_PUBLIC_SOLANA_PAY_TOKEN) por si se usa USDG u otra stablecoin.
export const USDC_MINT_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
export const USDC_MINT_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"

/** Mint de la stablecoin de pago para la red activa. */
export function paymentTokenMint(cluster: SolanaCluster = SOLANA_CLUSTER): string {
  const override = process.env.NEXT_PUBLIC_SOLANA_PAY_TOKEN?.trim()
  if (override) return override
  return cluster === "mainnet-beta" ? USDC_MINT_MAINNET : USDC_MINT_DEVNET
}

/** Instantánea reputacional que se sella en la cadena. Solo datos públicos. */
export interface AttestationPayload {
  prefix: typeof ATTESTATION_PREFIX
  agentId: string
  name: string
  score: number
  wins: number
  comps: number
  avgScore: number
  /** ISO-8601 en UTC del momento de la atestación. */
  issuedAt: string
}

/** Construye el payload canónico a partir de los datos públicos del agente. */
export function buildAttestationPayload(
  agent: {
    id: string
    name: string
    score: number
    wins: number
    comps: number
    avgScore: number
  },
  issuedAt: Date = new Date(),
): AttestationPayload {
  return {
    prefix: ATTESTATION_PREFIX,
    agentId: agent.id,
    name: agent.name,
    score: agent.score,
    wins: agent.wins,
    comps: agent.comps,
    // 2 decimales, igual que la Edge Function `attest-agents` (mantener en par).
    avgScore: Math.round(agent.avgScore * 100) / 100,
    issuedAt: issuedAt.toISOString(),
  }
}

/**
 * Serialización canónica: claves ordenadas alfabéticamente, sin espacios. Es
 * determinista, así que el mismo estado produce siempre el mismo string (y por
 * tanto el mismo hash), pueda recalcularlo quien sea.
 */
export function canonicalize(payload: AttestationPayload): string {
  const keys = Object.keys(payload).sort()
  const obj: Record<string, unknown> = {}
  const src = payload as unknown as Record<string, unknown>
  for (const k of keys) obj[k] = src[k]
  return JSON.stringify(obj)
}

/** SHA-256 (hex) del payload canónico, usando Web Crypto (Node y navegador). */
export async function hashAttestation(payload: AttestationPayload): Promise<string> {
  const data = new TextEncoder().encode(canonicalize(payload))
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/** Texto exacto que se escribe en el memo on-chain: `umbra:v1:<agentId>:<hash>`. */
export function memoString(agentId: string, hash: string): string {
  return `${ATTESTATION_PREFIX}:${agentId}:${hash}`
}

/**
 * Verifica una atestación: recalcula el hash del payload y lo compara con el que
 * quedó en la cadena. `true` => el Trust Score sellado coincide con estos datos.
 */
export async function verifyAttestation(
  payload: AttestationPayload,
  onchainHash: string,
): Promise<boolean> {
  const computed = await hashAttestation(payload)
  return computed === onchainHash.trim().toLowerCase()
}

/** Fila de `onchain_attestations` (un sello publicado). */
export interface OnchainAttestation {
  agentId: string
  cluster: SolanaCluster
  payloadHash: string
  signature: string
  wallet: string
  snapshot: AttestationPayload
  issuedAt: string
}

/**
 * Lee de la cadena el memo de una transacción (vía RPC público, sin librerías).
 * Devuelve el texto del memo o `null` si la tx no existe / no tiene memo.
 */
export async function fetchOnchainMemo(
  signature: string,
  cluster: SolanaCluster = SOLANA_CLUSTER,
): Promise<string | null> {
  try {
    const res = await fetch(rpcEndpoint(cluster), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const ixs: { programId?: string; parsed?: unknown }[] =
      data?.result?.transaction?.message?.instructions ?? []
    const memoIx = ixs.find((ix) => ix.programId === MEMO_PROGRAM_ID)
    return typeof memoIx?.parsed === "string" ? memoIx.parsed : null
  } catch {
    return null
  }
}

/**
 * Verificación completa e independiente de Umbra: recalcula el hash del
 * snapshot guardado y lo compara con el memo que está escrito EN LA CADENA.
 */
export async function verifyOnchain(att: OnchainAttestation): Promise<"ok" | "mismatch" | "unreachable"> {
  const memo = await fetchOnchainMemo(att.signature, att.cluster)
  if (memo === null) return "unreachable"
  const hash = await hashAttestation(att.snapshot)
  return memo === memoString(att.agentId, hash) ? "ok" : "mismatch"
}

/** URL al explorador para una transacción. */
export function explorerTxUrl(signature: string, cluster: SolanaCluster = SOLANA_CLUSTER): string {
  const suffix = cluster === "devnet" ? "?cluster=devnet" : ""
  return `https://explorer.solana.com/tx/${signature}${suffix}`
}

/** URL al explorador para una dirección/cuenta. */
export function explorerAddressUrl(address: string, cluster: SolanaCluster = SOLANA_CLUSTER): string {
  const suffix = cluster === "devnet" ? "?cluster=devnet" : ""
  return `https://explorer.solana.com/address/${address}${suffix}`
}
