// ========================================
// WEBHOOK — POST /api/pagos/webhook
// ========================================
// La unica puerta por la que una compra pasa a "completada".
//
// Es un endpoint publico, asi que cualquiera puede llamarlo. Por eso NO se
// cree nada de lo que llega en el cuerpo: primero se valida la firma HMAC de
// Mercado Pago y despues se le PREGUNTA a Mercado Pago por el estado real del
// pago. Ni el importe ni el estado se toman del payload.

import { createHmac, timingSafeEqual } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { consultarPago, leerConfigPagos } from "@/lib/pagos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Valida la firma del webhook segun la especificacion de Mercado Pago:
 * plantilla `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` firmada con
 * HMAC-SHA256 usando la clave secreta del webhook.
 */
function firmaValida(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string,
  secreto: string,
): boolean {
  if (!xSignature) return false

  // Formato: "ts=1704908010,v1=618c8534..."
  let ts = ""
  let v1 = ""
  for (const parte of xSignature.split(",")) {
    const [k, v] = parte.split("=").map((s) => s?.trim())
    if (k === "ts") ts = v ?? ""
    if (k === "v1") v1 = v ?? ""
  }
  if (!ts || !v1) return false

  // El orden de los campos es parte de la especificacion: no se puede alterar.
  const plantilla = `id:${dataId};request-id:${xRequestId ?? ""};ts:${ts};`
  const esperado = createHmac("sha256", secreto).update(plantilla).digest("hex")

  // Comparacion en tiempo constante: evita filtrar la firma por temporizacion.
  const a = Buffer.from(esperado, "utf8")
  const b = Buffer.from(v1, "utf8")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  const cfg = leerConfigPagos()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!cfg || !url || !serviceKey) {
    console.error("webhook: pagos o Supabase sin configurar")
    return new Response("no configurado", { status: 503 })
  }

  // Mercado Pago manda el id del pago por query o por cuerpo, segun el evento.
  const qs = new URL(request.url).searchParams
  let dataId = qs.get("data.id") ?? qs.get("id") ?? ""
  let tipo = qs.get("type") ?? qs.get("topic") ?? ""

  try {
    const body = await request.json()
    if (!dataId && body?.data?.id) dataId = String(body.data.id)
    if (!tipo && body?.type) tipo = String(body.type)
  } catch {
    /* algunos avisos llegan sin cuerpo: los datos ya vienen en la query */
  }

  if (!dataId) return new Response("sin id", { status: 400 })

  // ── Firma ─────────────────────────────────────────────────────────────────
  const ok = firmaValida(
    request.headers.get("x-signature"),
    request.headers.get("x-request-id"),
    dataId,
    cfg.webhookSecret,
  )
  if (!ok) {
    console.warn("webhook: firma invalida, se descarta")
    return new Response("firma invalida", { status: 401 })
  }

  // Solo interesan los avisos de pago.
  if (tipo && tipo !== "payment") return new Response("ignorado", { status: 200 })

  // ── Estado real, preguntandole a Mercado Pago ─────────────────────────────
  const pago = await consultarPago(dataId, cfg.accessToken)
  if (!pago) return new Response("no se pudo consultar el pago", { status: 502 })

  const compraId = pago.externalReference
  if (!compraId) return new Response("pago sin referencia", { status: 200 })

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: compra } = await admin
    .from("purchases")
    .select("id, status, amount_cents")
    .eq("id", compraId)
    .maybeSingle()

  if (!compra) {
    console.warn("webhook: la compra referenciada no existe", compraId)
    return new Response("compra desconocida", { status: 200 })
  }

  // Idempotente: Mercado Pago reintenta los avisos.
  if (compra.status === "completada") return new Response("ya procesada", { status: 200 })

  if (pago.status === "approved") {
    // Se comprueba que el importe cobrado sea el que pedimos: evita que un
    // pago por menos dinero desbloquee el producto.
    const cobradoCentavos = pago.amount !== null ? Math.round(pago.amount * 100) : null
    if (cobradoCentavos !== null && compra.amount_cents && cobradoCentavos < compra.amount_cents) {
      console.warn("webhook: importe menor al esperado", { compraId, cobradoCentavos })
      return new Response("importe insuficiente", { status: 200 })
    }

    await admin
      .from("purchases")
      .update({ status: "completada", provider_payment_id: dataId })
      .eq("id", compraId)
      .eq("status", "pendiente") // no pisar una ya procesada
    return new Response("ok", { status: 200 })
  }

  if (pago.status === "refunded" || pago.status === "charged_back") {
    await admin.from("purchases").update({ status: "reembolsada" }).eq("id", compraId)
    return new Response("ok", { status: 200 })
  }

  // rejected / cancelled / in_process: se deja pendiente, MP volvera a avisar.
  await admin.from("purchases").update({ provider_payment_id: dataId }).eq("id", compraId)
  return new Response("ok", { status: 200 })
}

export async function GET() {
  // Mercado Pago comprueba que la URL exista al configurarla.
  return new Response("ok", { status: 200 })
}
