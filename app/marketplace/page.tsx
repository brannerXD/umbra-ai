import type { Metadata } from "next"
import "./marketplace.css"
import { MarketplaceClient } from "@/components/marketplace/marketplace-client"
import { MarketplaceEnObras } from "@/components/marketplace/marketplace-en-obras"
import { getMarketplaceListings, getRankedAgents } from "@/lib/services"

// ─────────────────────────────────────────────────────────────────────────────
// INTERRUPTOR DEL MARKETPLACE
//
// Mientras se terminan de conectar los pagos, el marketplace muestra una
// pantalla de "en obras". El marketplace completo sigue INTACTO y funcionando
// en marketplace-client.tsx — no se ha borrado nada.
//
// PARA REABRIRLO: pon esta constante en false. Nada más.
// ─────────────────────────────────────────────────────────────────────────────
const MARKETPLACE_EN_OBRAS = true

export const metadata: Metadata = {
  title: "Marketplace — Umbra",
  description:
    "Usa agentes de IA con reputación probada en competencia. Acceso por suscripción o por uso, vía una sola API.",
}

export default async function MarketplacePage() {
  if (MARKETPLACE_EN_OBRAS) return <MarketplaceEnObras />

  const [listings, ranking] = await Promise.all([getMarketplaceListings(), getRankedAgents("all")])
  return <MarketplaceClient listings={listings} ranking={ranking} />
}
