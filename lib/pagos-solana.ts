// ========================================
// PAGOS — Riel de USDC en Solana (Solana Pay)
// ========================================
// Segundo riel de cobro, junto a Mercado Pago (lib/pagos.ts): los listados en
// dólares se pagan en USDC y el dinero va DIRECTO a la tesorería (Umbra no
// custodia nada y no maneja ninguna llave para cobrar).
//
// Cómo se confirma un pago (estándar Solana Pay):
//   1. Cada compra recibe una REFERENCIA única: una clave pública aleatoria que
//      el comprador incluye como cuenta de sólo lectura en su transferencia.
//   2. El servidor busca en la cadena las transacciones que mencionan esa
//      referencia (getSignaturesForAddress) y lee la que sea (getTransaction).
//   3. Se acepta sólo si: la transacción terminó sin error, nombra la
//      referencia y a la tesorería le LLEGÓ al menos el monto exacto del mint
//      configurado (se mide con el cambio de saldo de la propia transacción,
//      no con lo que diga el comprador).
//   4. La firma queda guardada con índice único: una misma transacción no puede
//      pagar dos compras.
//
// Sólo servidor (usa node:crypto). No agrega dependencias: habla JSON-RPC con
// `fetch`. Apagado por defecto: ver leerConfigPagoSolana().

import { generateKeyPairSync } from "node:crypto"
import {
  SOLANA_CLUSTER,
  type SolanaCluster,
  paymentTokenMint,
  rpcEndpoints,
  solanaPaymentsEnabled,
  treasuryAddress,
} from "./solana.ts"

/** Decimales del token de pago (USDC = 6). */
export const PAY_DECIMALS = 6

/** Dólares en centavos → unidades mínimas del token (USDC: 1 centavo = 10.000). */
const BASE_POR_CENTAVO = BigInt(10 ** (PAY_DECIMALS - 2))

export function centavosABaseUnits(centavos: number): bigint {
  if (!Number.isSafeInteger(centavos) || centavos <= 0) {
    throw new RangeError("centavosABaseUnits: se esperaba un entero positivo")
  }
  return BigInt(centavos) * BASE_POR_CENTAVO
}

/** Unidades mínimas → texto decimal sin ceros sobrantes (1_500_000 → "1.5"). */
export function baseUnitsADecimal(base: bigint): string {
  const factor = BigInt(10 ** PAY_DECIMALS)
  const entero = base / factor
  const resto = (base % factor).toString().padStart(PAY_DECIMALS, "0").replace(/0+$/, "")
  return resto ? `${entero}.${resto}` : `${entero}`
}

// ─── Base58 (alfabeto de Bitcoin/Solana) ───────────────────────────────────

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

export function base58Encode(bytes: Uint8Array): string {
  let ceros = 0
  while (ceros < bytes.length && bytes[ceros] === 0) ceros++
  let n = 0n
  for (const b of bytes) n = (n << 8n) | BigInt(b)
  let out = ""
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out
    n /= 58n
  }
  return "1".repeat(ceros) + out
}

const DIRECCION_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

/** ¿Parece una dirección de Solana (base58, 32–44 caracteres)? */
export function esDireccionSolana(s: string): boolean {
  return DIRECCION_RE.test(s)
}

/**
 * Referencia única de una compra: una clave pública Ed25519 válida generada al
 * azar (la clave privada se descarta: sólo sirve como etiqueta en la cadena).
 */
export function generarReferencia(): string {
  const { publicKey } = generateKeyPairSync("ed25519")
  const x = publicKey.export({ format: "jwk" }).x
  if (!x) throw new Error("generarReferencia: no se pudo exportar la clave")
  return base58Encode(Buffer.from(x, "base64url"))
}

// ─── Configuración ─────────────────────────────────────────────────────────

export interface ConfigPagoSolana {
  /** Wallet que recibe el dinero (dirección pública). */
  destino: string
  /** Mint del token de pago (USDC). */
  mint: string
  cluster: SolanaCluster
  /** RPCs a consultar, en orden. */
  rpcUrls: string[]
  /** Nivel de confirmación exigido antes de entregar el producto. */
  commitment: "confirmed" | "finalized"
}

/**
 * Lee la configuración. Devuelve null si el riel está apagado o mal configurado
 * para que las rutas respondan "no disponible" en vez de romper.
 *
 * Variables: NEXT_PUBLIC_SOLANA_PAYMENTS=true, NEXT_PUBLIC_SOLANA_TREASURY,
 * NEXT_PUBLIC_SOLANA_CLUSTER, (opcional) NEXT_PUBLIC_SOLANA_PAY_TOKEN y
 * SOLANA_RPC_URL (RPC propio, p. ej. de un proveedor, para no depender del
 * público).
 */
export function leerConfigPagoSolana(): ConfigPagoSolana | null {
  if (!solanaPaymentsEnabled()) return null
  const destino = treasuryAddress()
  if (!destino || !esDireccionSolana(destino)) return null
  const propio = process.env.SOLANA_RPC_URL?.trim()
  return {
    destino,
    mint: paymentTokenMint(),
    cluster: SOLANA_CLUSTER,
    rpcUrls: propio ? [propio, ...rpcEndpoints()] : rpcEndpoints(),
    commitment: process.env.SOLANA_PAY_COMMITMENT === "confirmed" ? "confirmed" : "finalized",
  }
}

// ─── URL Solana Pay ────────────────────────────────────────────────────────

export interface OrdenSolana {
  destino: string
  mint: string
  /** Monto en unidades mínimas del token. */
  montoBase: bigint
  referencia: string
  /** Texto que ve el comprador en su wallet. */
  mensaje: string
  /** Memo opcional que queda escrito en la transacción. */
  memo?: string
}

/**
 * URL `solana:` (https://docs.solanapay.com/spec) que abre cualquier wallet
 * compatible, o se muestra como QR. Pura: no toca la red.
 */
export function construirUrlSolanaPay(o: OrdenSolana): string {
  const q = [
    `amount=${baseUnitsADecimal(o.montoBase)}`,
    `spl-token=${o.mint}`,
    `reference=${o.referencia}`,
    `label=${encodeURIComponent("Umbra")}`,
    `message=${encodeURIComponent(o.mensaje)}`,
  ]
  if (o.memo) q.push(`memo=${encodeURIComponent(o.memo)}`)
  return `solana:${o.destino}?${q.join("&")}`
}

// ─── Verificación en la cadena ─────────────────────────────────────────────

interface TokenBalance {
  owner?: string
  mint: string
  uiTokenAmount: { amount: string }
}

/** Transacción en el formato de `getTransaction` con encoding jsonParsed. */
export interface TransaccionParseada {
  meta: {
    err: unknown | null
    preTokenBalances?: TokenBalance[]
    postTokenBalances?: TokenBalance[]
  } | null
  transaction: {
    message: { accountKeys: Array<string | { pubkey: string }> }
  }
}

export type MotivoRechazo =
  | "sin_transaccion"
  | "fallida"
  | "sin_referencia"
  | "monto_insuficiente"

export type ResultadoTransferencia =
  | { ok: true; recibido: bigint }
  | { ok: false; motivo: MotivoRechazo; recibido: bigint }

function sumaTokens(lista: TokenBalance[] | undefined, owner: string, mint: string): bigint {
  let total = 0n
  for (const b of lista ?? []) {
    if (b.owner === owner && b.mint === mint) total += BigInt(b.uiTokenAmount.amount)
  }
  return total
}

/**
 * Decide si una transacción es EL pago de una compra. Pura y sin red, para
 * poder probarla a fondo: es la pieza que decide si se entrega un producto.
 */
export function evaluarTransferencia(
  tx: TransaccionParseada | null,
  esperado: { destino: string; mint: string; minimoBase: bigint; referencia: string },
): ResultadoTransferencia {
  if (!tx || !tx.meta) return { ok: false, motivo: "sin_transaccion", recibido: 0n }
  if (tx.meta.err !== null && tx.meta.err !== undefined) {
    return { ok: false, motivo: "fallida", recibido: 0n }
  }
  const claves = tx.transaction.message.accountKeys.map((k) => (typeof k === "string" ? k : k.pubkey))
  if (!claves.includes(esperado.referencia)) {
    return { ok: false, motivo: "sin_referencia", recibido: 0n }
  }
  // Lo que RECIBIÓ la tesorería en esta transacción: saldo final − inicial.
  // Una cuenta de token nueva no aparece en `pre`, así que cuenta como 0.
  const recibido =
    sumaTokens(tx.meta.postTokenBalances, esperado.destino, esperado.mint) -
    sumaTokens(tx.meta.preTokenBalances, esperado.destino, esperado.mint)
  if (recibido < esperado.minimoBase) return { ok: false, motivo: "monto_insuficiente", recibido }
  return { ok: true, recibido }
}

type Fetch = typeof fetch

/** Llamada JSON-RPC que rota de endpoint y reintenta (los RPC públicos limitan). */
async function rpc<T>(
  cfg: Pick<ConfigPagoSolana, "rpcUrls">,
  method: string,
  params: unknown[],
  fetchFn: Fetch,
): Promise<T | null> {
  const intentos = Math.max(3, cfg.rpcUrls.length)
  for (let i = 0; i < intentos; i++) {
    const url = cfg.rpcUrls[i % cfg.rpcUrls.length]
    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const data = await res.json()
        if (!data?.error) return (data?.result ?? null) as T | null
      }
    } catch {
      /* siguiente endpoint */
    }
    await new Promise((r) => setTimeout(r, 250 * (i + 1)))
  }
  return null
}

export type ResultadoBusqueda =
  | { estado: "pagado"; signature: string; recibido: bigint }
  | { estado: "pendiente" }
  /** No se pudo consultar la red: no es lo mismo que "no ha pagado". */
  | { estado: "sin_red" }

/**
 * Busca en la cadena el pago de una compra. Mira las transacciones que
 * mencionan la referencia y devuelve la primera que `evaluarTransferencia`
 * acepte; las que no cumplen (señuelos con montos menores, fallidas) se ignoran.
 */
export async function buscarPago(
  cfg: ConfigPagoSolana,
  esperado: { minimoBase: bigint; referencia: string },
  fetchFn: Fetch = fetch,
): Promise<ResultadoBusqueda> {
  const sigs = await rpc<Array<{ signature: string; err: unknown | null }>>(
    cfg,
    "getSignaturesForAddress",
    [esperado.referencia, { limit: 20, commitment: cfg.commitment }],
    fetchFn,
  )
  if (sigs === null) return { estado: "sin_red" }

  let fallaRed = false
  for (const s of sigs) {
    if (s.err !== null) continue
    const tx = await rpc<TransaccionParseada>(
      cfg,
      "getTransaction",
      [s.signature, { encoding: "jsonParsed", commitment: cfg.commitment, maxSupportedTransactionVersion: 0 }],
      fetchFn,
    )
    if (tx === null) {
      fallaRed = true
      continue
    }
    const r = evaluarTransferencia(tx, {
      destino: cfg.destino,
      mint: cfg.mint,
      minimoBase: esperado.minimoBase,
      referencia: esperado.referencia,
    })
    if (r.ok) return { estado: "pagado", signature: s.signature, recibido: r.recibido }
  }
  return fallaRed ? { estado: "sin_red" } : { estado: "pendiente" }
}
