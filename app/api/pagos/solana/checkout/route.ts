// ========================================
// CHECKOUT USDC — POST /api/pagos/solana/checkout
// ========================================
// Inicia una compra pagada en USDC por Solana (Solana Pay). Crea la compra en
// "pendiente" con una REFERENCIA única y devuelve lo que el comprador necesita
// para pagar desde su wallet: URL `solana:` (para QR / enlace), la dirección, el
// monto y el mint.
//
// La compra NUNCA nace completada aqui: solo /api/pagos/solana/estado, tras ver
// el pago en la cadena, puede completarla.

import { aCentavos } from "@/lib/pagos"
import {
  buscarPago,
  baseUnitsADecimal,
  centavosABaseUnits,
  construirUrlSolanaPay,
  generarReferencia,
  leerConfigPagoSolana,
} from "@/lib/pagos-solana"
import { autenticarComprador, completarCompraSolana, json } from "@/lib/pagos-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Monedas de listado que se cobran en USDC (1 USD = 1 USDC). */
const MONEDAS_USDC = new Set(["USD", "USDC"])

export async function POST(request: Request) {
  const cfg = leerConfigPagoSolana()
  if (!cfg) {
    return json(
      { error: "El pago con USDC aun no esta disponible.", codigo: "solana_no_configurado" },
      503,
    )
  }

  const ctx = await autenticarComprador(request)
  if ("respuesta" in ctx) return ctx.respuesta
  const { comprador, admin } = ctx

  let listingId: string
  let versionId: string | null = null
  try {
    const body = await request.json()
    listingId = String(body?.listingId ?? "")
    versionId = body?.versionId ? String(body.versionId) : null
  } catch {
    return json({ error: "El cuerpo debe ser JSON." }, 400)
  }
  if (!listingId) return json({ error: "Falta el listado a comprar." }, 400)

  const { data: listing } = await admin
    .from("marketplace_listings")
    .select("id, listed, price, price_unit, listing_type, agents!inner(name, owner_id, archived)")
    .eq("id", listingId)
    .maybeSingle()

  const agente = listing?.agents as unknown as
    | { name: string; owner_id: string | null; archived: boolean }
    | undefined

  if (!listing?.listed || !agente || agente.archived) {
    return json({ error: "Este agente ya no esta disponible." }, 409)
  }

  // Sin tasa de cambio inventada: solo los listados en dolares se cobran en USDC.
  const unidad = String(listing.price_unit).toUpperCase()
  if (!MONEDAS_USDC.has(unidad)) {
    return json(
      {
        error: `Este listado esta en ${listing.price_unit}. Para pagarlo en USDC, ponle el precio en USD.`,
        codigo: "moneda_no_soportada",
      },
      409,
    )
  }

  const precio = Number(listing.price)
  const centavos = aCentavos(precio)
  if (!Number.isFinite(precio) || !Number.isSafeInteger(centavos) || centavos <= 0) {
    return json({ error: "Este listado no tiene un precio valido." }, 409)
  }
  const montoBase = centavosABaseUnits(centavos)

  // ── Compra previa (la tabla permite una sola por comprador y listado) ──────
  const { data: previa } = await admin
    .from("purchases")
    .select("id, status, provider, provider_reference, amount_cents")
    .eq("listing_id", listingId)
    .eq("buyer_id", comprador.id)
    .maybeSingle()

  if (previa?.status === "completada") {
    return json({ error: "Ya compraste este agente.", codigo: "ya_comprada" }, 409)
  }

  // Si ya habia un pago en curso en este riel, primero se mira si llego: evita
  // descartar una referencia que el comprador ya pago.
  if (
    previa?.status === "pendiente" &&
    previa.provider === "solana" &&
    previa.provider_reference &&
    previa.amount_cents
  ) {
    const hallado = await buscarPago(cfg, {
      minimoBase: centavosABaseUnits(Number(previa.amount_cents)),
      referencia: previa.provider_reference,
    })
    if (hallado.estado === "pagado") {
      await completarCompraSolana(admin, previa.id, hallado.signature)
      return json({ estado: "completada", compraId: previa.id, signature: hallado.signature }, 200)
    }
  }

  // Se reutiliza la referencia si el intento anterior era igual (mismo riel y
  // mismo precio); en otro caso se genera una nueva.
  let compraId: string
  let referencia: string
  if (
    previa?.status === "pendiente" &&
    previa.provider === "solana" &&
    previa.provider_reference &&
    Number(previa.amount_cents) === centavos
  ) {
    compraId = previa.id
    referencia = previa.provider_reference
  } else {
    referencia = generarReferencia()
    const campos = {
      price: precio,
      price_unit: listing.price_unit,
      version_id: versionId,
      status: "pendiente",
      provider: "solana",
      provider_reference: referencia,
      provider_payment_id: null,
      amount_cents: centavos,
      currency: "USDC",
    }
    if (previa) {
      const { error } = await admin
        .from("purchases")
        .update({ ...campos, created_at: new Date().toISOString() })
        .eq("id", previa.id)
        .neq("status", "completada")
      if (error) {
        console.error("solana checkout: no se pudo reiniciar la compra", error)
        return json({ error: "No se pudo iniciar la compra." }, 500)
      }
      compraId = previa.id
    } else {
      const { data: nueva, error } = await admin
        .from("purchases")
        .insert({ listing_id: listingId, buyer_id: comprador.id, ...campos })
        .select("id")
        .single()
      if (error || !nueva) {
        console.error("solana checkout: no se pudo crear la compra", error)
        return json({ error: "No se pudo iniciar la compra." }, 500)
      }
      compraId = nueva.id
    }
  }

  const url = construirUrlSolanaPay({
    destino: cfg.destino,
    mint: cfg.mint,
    montoBase,
    referencia,
    mensaje: `Umbra — ${agente.name}`.slice(0, 80),
    memo: `umbra:pay:${compraId}`,
  })

  return json(
    {
      estado: "pendiente",
      compraId,
      url,
      referencia,
      destino: cfg.destino,
      monto: baseUnitsADecimal(montoBase),
      token: "USDC",
      mint: cfg.mint,
      cluster: cfg.cluster,
    },
    200,
  )
}

export async function GET() {
  return json({ error: "Usa POST." }, 405)
}
