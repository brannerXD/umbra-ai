// ========================================
// UMBRA — CAPA DE BLOCKCHAIN (SOLANA) — lado web
// ========================================
// Umbra sella en Solana (programa Memo) dos cosas:
//   1. El Trust Score de cada agente  → memo `umbra:v1:<agentId>:<sha256>`
//   2. Cada certificado emitido       → memo `umbra:cert:v1:<certId>:<sha256>`
//
// Este módulo VERIFICA esos sellos desde el navegador, sin pasar por Umbra:
// recalcula el hash de los datos públicos y lo compara con el memo leído
// directamente del RPC de Solana. No tiene claves ni dependencias: la FIRMA y
// el ENVÍO viven en las Edge Functions (supabase/functions/attest-*).
//
// El formato canónico y el hash se importan del módulo compartido que usan
// también las Edge Functions: una sola implementación, cero desalineación.

import {
  AGENT_PREFIX,
  MEMO_PROGRAM_ID,
  agentMemo,
  buildAgentPayload,
  buildCertificatePayload,
  canonicalize,
  certMemo,
  sha256Hex,
  type AttestationPayload,
  type CertificatePayload,
} from "../supabase/functions/_shared/umbra-attestation.ts"

export {
  AGENT_PREFIX,
  MEMO_PROGRAM_ID,
  agentMemo,
  buildAgentPayload,
  buildCertificatePayload,
  canonicalize,
  certMemo,
  sha256Hex,
  type AttestationPayload,
  type CertificatePayload,
}

/** Prefijo del sello de Trust Score (compatibilidad con código previo). */
export const ATTESTATION_PREFIX = AGENT_PREFIX

/** Red de Solana a la que apuntan los sellos. */
export type SolanaCluster = "devnet" | "mainnet-beta"

/** Cluster activo. Se controla por env; por defecto devnet (gratis, sin riesgo). */
export const SOLANA_CLUSTER: SolanaCluster =
  (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as SolanaCluster) === "mainnet-beta"
    ? "mainnet-beta"
    : "devnet"

/**
 * Wallets OFICIALES que firman los sellos de Umbra, una por red. Verificar
 * sólo el memo no basta (cualquiera podría escribir el mismo texto desde otra
 * wallet): la transacción además debe estar firmada por la wallet de su red.
 */
export const ATTESTER_WALLETS: Record<SolanaCluster, string> = {
  devnet: "BDsEnYJ525WNMv9t2oBiAf8r3svqvraTcCP52nkAmWZg",
  "mainnet-beta": "6xBKjoTBabB5zrboXweLd6N14T87vcD5aq1mFxGTNutK",
}

/** Wallet oficial de una red. */
export function attesterWallet(cluster: SolanaCluster = SOLANA_CLUSTER): string {
  return ATTESTER_WALLETS[cluster]
}

/** Wallet oficial de devnet (compatibilidad con código y pruebas previas). */
export const UMBRA_ATTESTER_WALLET = ATTESTER_WALLETS.devnet

/** Nombre legible de la red. */
export function clusterLabel(cluster: SolanaCluster | null | undefined): string {
  return cluster === "mainnet-beta" ? "Solana mainnet" : "Solana devnet"
}

/**
 * RPCs públicos para LEER desde el navegador, en orden de preferencia. El RPC
 * oficial de mainnet (api.mainnet-beta.solana.com) responde 403 a cualquier
 * petición con cabecera Origin, o sea, desde un navegador: por eso en mainnet
 * se usa PublicNode (CORS abierto) y el oficial queda como respaldo (sirve
 * fuera del navegador, p. ej. en las pruebas).
 */
export function rpcEndpoints(cluster: SolanaCluster = SOLANA_CLUSTER): string[] {
  return cluster === "mainnet-beta"
    ? ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"]
    : ["https://api.devnet.solana.com"]
}

/** RPC principal para leer de la red elegida. */
export function rpcEndpoint(cluster: SolanaCluster = SOLANA_CLUSTER): string {
  return rpcEndpoints(cluster)[0]
}

// ─── Riel de pagos (inerte por defecto; ver lib/pagos-solana.ts) ───────────

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

// ─── Sellos ────────────────────────────────────────────────────────────────

/** Atajo histórico: hash de un payload de Trust Score. */
export function hashAttestation(payload: AttestationPayload): Promise<string> {
  return sha256Hex(payload)
}

/** Fila de `onchain_attestations` (un sello de Trust Score publicado). */
export interface OnchainAttestation {
  agentId: string
  cluster: SolanaCluster
  payloadHash: string
  signature: string
  wallet: string
  snapshot: AttestationPayload
  issuedAt: string
}

/** Datos públicos de un certificado emitido + su sello (si ya lo tiene). */
export interface CertificateRecord {
  id: string
  agentId: string
  agentName: string
  score: number
  wins: number
  comps: number
  avgScore: number
  format: string
  issuedAt: string
  certHash: string | null
  signature: string | null
  cluster: SolanaCluster | null
  wallet: string | null
  onchainAt: string | null
}

export type VerifyResult = "ok" | "mismatch" | "unreachable"

/** Inyectable en pruebas; en la app es el `fetch` global. */
type Fetcher = typeof fetch

/** Lo que nos interesa de una transacción leída de la cadena. */
export interface OnchainTx {
  /** Texto del memo (null si la tx no tiene instrucción Memo). */
  memo: string | null
  /** Direcciones que firmaron la transacción. */
  signers: string[]
}

/**
 * Lee una transacción de la cadena (vía RPC público, sin librerías): su memo y
 * sus firmantes. Devuelve `null` si no se pudo leer (no existe o red caída).
 */
export async function fetchOnchainTx(
  signature: string,
  cluster: SolanaCluster = SOLANA_CLUSTER,
  fetcher: Fetcher = fetch,
  retryDelayMs = 1200,
): Promise<OnchainTx | null> {
  // El RPC público limita ráfagas (429 o `result: null` transitorio): se
  // reintenta un par de veces con espera creciente antes de rendirse.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, retryDelayMs * attempt))
    const endpoints = rpcEndpoints(cluster)
    try {
      // Rota entre RPCs en cada reintento.
      const res = await fetcher(endpoints[attempt % endpoints.length], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
        }),
      })
      if (!res.ok) continue
      const data = await res.json()
      const message = data?.result?.transaction?.message
      const ixs: { programId?: string; parsed?: unknown }[] | undefined = message?.instructions
      if (!ixs) continue
      const memoIx = ixs.find((ix) => ix.programId === MEMO_PROGRAM_ID)
      const keys: { pubkey?: string; signer?: boolean }[] = message?.accountKeys ?? []
      return {
        memo: typeof memoIx?.parsed === "string" ? memoIx.parsed : null,
        signers: keys.filter((k) => k.signer && k.pubkey).map((k) => k.pubkey as string),
      }
    } catch {
      /* red caída: reintenta */
    }
  }
  return null
}

/** Sólo el memo de una transacción (null si no se pudo leer o no tiene). */
export async function fetchOnchainMemo(
  signature: string,
  cluster: SolanaCluster = SOLANA_CLUSTER,
  fetcher: Fetcher = fetch,
  retryDelayMs = 1200,
): Promise<string | null> {
  return (await fetchOnchainTx(signature, cluster, fetcher, retryDelayMs))?.memo ?? null
}

/**
 * Verifica un sello de Trust Score: recalcula el hash del snapshot guardado y
 * lo compara con el memo que está escrito EN LA CADENA.
 */
export async function verifyOnchain(
  att: OnchainAttestation,
  fetcher: Fetcher = fetch,
  retryDelayMs?: number,
): Promise<VerifyResult> {
  const tx = await fetchOnchainTx(att.signature, att.cluster, fetcher, retryDelayMs)
  if (tx === null) return "unreachable"
  const hash = await sha256Hex(att.snapshot)
  const signedByUmbra = tx.signers.includes(attesterWallet(att.cluster))
  return signedByUmbra && tx.memo === agentMemo(att.agentId, hash) ? "ok" : "mismatch"
}

/** Hash de un certificado, recalculado desde sus datos PÚBLICOS. */
export function hashCertificate(c: CertificateRecord): Promise<string> {
  return sha256Hex(
    buildCertificatePayload({
      id: c.id,
      agentId: c.agentId,
      agentName: c.agentName,
      score: c.score,
      wins: c.wins,
      comps: c.comps,
      avgScore: c.avgScore,
      format: c.format,
      issuedAt: c.issuedAt,
    }),
  )
}

export interface CertificateCheck {
  /** Hash recalculado desde los datos del certificado. */
  computedHash: string
  /** ¿Coincide con el hash registrado al emitirlo? */
  hashMatches: boolean
  /** Memo leído de Solana (null si no se pudo leer). */
  memo: string | null
  /** ¿La transacción la firmó la wallet oficial de Umbra? (null = sin leer) */
  signerOk: boolean | null
  /** Resultado global. "pending" = aún sin sello on-chain. */
  result: VerifyResult | "pending"
}

/**
 * Verificación completa de un certificado, independiente de Umbra:
 *  1. recalcula el SHA-256 desde los datos públicos del certificado,
 *  2. lo compara con el hash registrado,
 *  3. lee la transacción de Solana: su memo debe ser
 *     `umbra:cert:v1:<certId>:<hash recalculado>` y debe estar firmada por la
 *     wallet oficial de Umbra para esa red (ATTESTER_WALLETS).
 */
export async function verifyCertificate(
  c: CertificateRecord,
  fetcher: Fetcher = fetch,
  retryDelayMs?: number,
): Promise<CertificateCheck> {
  const computedHash = await hashCertificate(c)
  const hashMatches = c.certHash === computedHash
  if (!c.signature) return { computedHash, hashMatches, memo: null, signerOk: null, result: "pending" }
  const tx = await fetchOnchainTx(c.signature, c.cluster ?? SOLANA_CLUSTER, fetcher, retryDelayMs)
  if (tx === null) return { computedHash, hashMatches, memo: null, signerOk: null, result: "unreachable" }
  const signerOk = tx.signers.includes(attesterWallet(c.cluster ?? SOLANA_CLUSTER))
  const ok = hashMatches && signerOk && tx.memo === certMemo(c.id, computedHash)
  return { computedHash, hashMatches, memo: tx.memo, signerOk, result: ok ? "ok" : "mismatch" }
}

/**
 * Interpreta lo que alguien pega para verificar: el ID del certificado (UUID),
 * su hash SHA-256 (64 hex) o una URL que contenga cualquiera de los dos (p. ej.
 * la del código QR). Devuelve null si no reconoce nada.
 */
export function parseCertificateQuery(query: string): { id: string } | { hash: string } | null {
  const q = query.trim()
  const id = q.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]
  if (id) return { id: id.toLowerCase() }
  const hash = q.match(/\b[0-9a-f]{64}\b/i)?.[0]
  if (hash) return { hash: hash.toLowerCase() }
  return null
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
