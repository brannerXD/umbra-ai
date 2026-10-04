// ========================================
// UMBRA — Formato canónico de los sellos on-chain (FUENTE ÚNICA)
// ========================================
// Módulo PURO (sin imports, sin red, sin claves). Lo usan a la vez:
//   - las Edge Functions (Deno) que firman y publican en Solana,
//   - la web (lib/solana.ts) que verifica desde el navegador,
//   - las pruebas (tests/*.test.ts).
// Tener una sola implementación garantiza que el hash que se escribe en la
// cadena es exactamente el que luego se recalcula para verificar.
//
// Dos tipos de sello:
//   1. Trust Score de un agente  → memo `umbra:v1:<agentId>:<sha256>`
//   2. Certificado emitido       → memo `umbra:cert:v1:<certId>:<sha256>`
//
// NO cambiar el formato de un prefijo existente: invalidaría los sellos ya
// publicados. Para evolucionarlo, crear un prefijo nuevo (v2).

export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
export const AGENT_PREFIX = "umbra:v1"
export const CERT_PREFIX = "umbra:cert:v1"

/** Instantánea reputacional de un agente (sello de Trust Score). */
export interface AttestationPayload {
  prefix: typeof AGENT_PREFIX
  agentId: string
  name: string
  score: number
  wins: number
  comps: number
  avgScore: number
  /** ISO-8601 UTC. */
  issuedAt: string
}

/** Contenido de un certificado emitido (sello de certificado). */
export interface CertificatePayload {
  prefix: typeof CERT_PREFIX
  certId: string
  agentId: string
  agentName: string
  score: number
  wins: number
  comps: number
  avgScore: number
  format: string
  /** ISO-8601 UTC (milisegundos). */
  issuedAt: string
}

/** 2 decimales: los números pasan por jsonb/JSON y deben volver idénticos. */
export function round2(n: number): number {
  return Math.round(Number(n) * 100) / 100
}

/** Normaliza cualquier fecha (Date o string de Postgres) a ISO con ms en UTC. */
export function isoUtc(d: Date | string): string {
  return (d instanceof Date ? d : new Date(d)).toISOString()
}

export function buildAgentPayload(
  a: { id: string; name: string; score: number; wins: number; comps: number; avgScore: number },
  issuedAt: Date | string,
): AttestationPayload {
  return {
    prefix: AGENT_PREFIX,
    agentId: a.id,
    name: a.name,
    score: a.score,
    wins: a.wins,
    comps: a.comps,
    avgScore: round2(a.avgScore),
    issuedAt: isoUtc(issuedAt),
  }
}

/**
 * Payload de un certificado a partir de sus columnas PÚBLICAS en
 * `certificate_issuances`. Quien verifica lo recalcula desde esas mismas
 * columnas: si alguien alterara la fila, el hash dejaría de coincidir.
 */
export function buildCertificatePayload(c: {
  id: string
  agentId: string
  agentName: string
  score: number
  wins: number
  comps: number
  avgScore: number
  format: string
  issuedAt: Date | string
}): CertificatePayload {
  return {
    prefix: CERT_PREFIX,
    certId: c.id,
    agentId: c.agentId,
    agentName: c.agentName,
    score: c.score,
    wins: c.wins,
    comps: c.comps,
    avgScore: round2(c.avgScore),
    format: c.format,
    issuedAt: isoUtc(c.issuedAt),
  }
}

/** Serialización canónica: claves en orden alfabético, sin espacios. */
export function canonicalize(payload: object): string {
  const src = payload as Record<string, unknown>
  const obj: Record<string, unknown> = {}
  for (const k of Object.keys(src).sort()) obj[k] = src[k]
  return JSON.stringify(obj)
}

/** SHA-256 (hex) del payload canónico, con Web Crypto (Deno, Node y navegador). */
export async function sha256Hex(payload: object): Promise<string> {
  const data = new TextEncoder().encode(canonicalize(payload))
  const digest = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function agentMemo(agentId: string, hash: string): string {
  return `${AGENT_PREFIX}:${agentId}:${hash}`
}

export function certMemo(certId: string, hash: string): string {
  return `${CERT_PREFIX}:${certId}:${hash}`
}
