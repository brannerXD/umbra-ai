// ========================================
// PAGOS — Mercado Pago (Colombia)
// ========================================
// Utilidades compartidas por el checkout y el webhook. Solo servidor: aqui se
// usa el Access Token, que nunca debe llegar al navegador.

/** Moneda de Mercado Pago Colombia. */
export const MONEDA = "COP"

export interface ConfigPagos {
  accessToken: string
  webhookSecret: string
}

/**
 * Lee la configuracion de pagos. Devuelve null si falta algo, para que las
 * rutas respondan "pagos no configurados" en vez de romper con un 500 opaco.
 */
export function leerConfigPagos(): ConfigPagos | null {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!accessToken || !webhookSecret) return null
  return { accessToken, webhookSecret }
}

/** ¿Estamos con credenciales de prueba? (las de test empiezan por TEST-) */
export function esModoPrueba(accessToken: string): boolean {
  return accessToken.startsWith("TEST-")
}

/**
 * Mercado Pago cobra en la unidad principal (pesos), no en centavos.
 * Guardamos centavos en la base para no arrastrar decimales binarios.
 */
export function aCentavos(monto: number): number {
  return Math.round(monto * 100)
}

export function deCentavos(centavos: number): number {
  return centavos / 100
}

/** Consulta un pago en Mercado Pago para conocer su estado real. */
export async function consultarPago(
  paymentId: string,
  accessToken: string,
): Promise<{ status: string; externalReference: string | null; amount: number | null } | null> {
  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    })
    if (!res.ok) {
      console.error("consultarPago: MP respondio", res.status)
      return null
    }
    const p = await res.json()
    return {
      status: String(p.status ?? ""),
      externalReference: p.external_reference ? String(p.external_reference) : null,
      amount: typeof p.transaction_amount === "number" ? p.transaction_amount : null,
    }
  } catch (e) {
    console.error("consultarPago fallo", e)
    return null
  }
}
