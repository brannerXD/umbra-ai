// ========================================
// ESTADO DEL PAGO USDC — GET /api/pagos/solana/estado?compraId=...
// ========================================
// El navegador consulta esto mientras el comprador paga. El servidor mira la
// cadena y, si encuentra el pago (monto exacto, referencia, sin errores),
// completa la compra. Nada de lo que mande el navegador cuenta como prueba de
// pago: solo la transaccion que el servidor lee del RPC.

import { buscarPago, centavosABaseUnits, leerConfigPagoSolana } from "@/lib/pagos-solana"
import { autenticarComprador, completarCompraSolana, json } from "@/lib/pagos-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const compraId = new URL(request.url).searchParams.get("compraId") ?? ""
  if (!UUID.test(compraId)) return json({ error: "Falta la compra a consultar." }, 400)

  const ctx = await autenticarComprador(request)
  if ("respuesta" in ctx) return ctx.respuesta
  const { comprador, admin } = ctx

  // Solo se puede consultar una compra PROPIA.
  const { data: compra } = await admin
    .from("purchases")
    .select("id, status, provider, provider_reference, provider_payment_id, amount_cents")
    .eq("id", compraId)
    .eq("buyer_id", comprador.id)
    .maybeSingle()

  if (!compra) return json({ error: "Compra no encontrada." }, 404)
  if (compra.provider !== "solana") return json({ error: "Esta compra no es un pago en USDC." }, 400)
  if (compra.status === "completada") {
    return json({ estado: "completada", signature: compra.provider_payment_id }, 200)
  }
  if (compra.status !== "pendiente") return json({ estado: compra.status }, 200)

  const cfg = leerConfigPagoSolana()
  if (!cfg || !compra.provider_reference || !compra.amount_cents) {
    return json({ error: "El pago con USDC no esta disponible.", codigo: "solana_no_configurado" }, 503)
  }

  const hallado = await buscarPago(cfg, {
    minimoBase: centavosABaseUnits(Number(compra.amount_cents)),
    referencia: compra.provider_reference,
  })

  if (hallado.estado === "sin_red") {
    // No es "no pagó": la red no respondio. El navegador vuelve a preguntar.
    return json({ estado: "pendiente", aviso: "red_ocupada" }, 200)
  }
  if (hallado.estado === "pendiente") return json({ estado: "pendiente" }, 200)

  const r = await completarCompraSolana(admin, compra.id, hallado.signature)
  if (r === "firma_repetida") {
    console.warn("solana estado: la firma ya pago otra compra", compra.id)
    return json({ error: "Esa transaccion ya se uso en otra compra.", codigo: "firma_repetida" }, 409)
  }
  if (r === "error") return json({ error: "No se pudo registrar el pago. Reintenta." }, 500)
  return json({ estado: "completada", signature: hallado.signature }, 200)
}
