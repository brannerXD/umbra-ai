import type { Metadata } from "next"
import "./marketplace.css"
import { MarketplaceClient } from "@/components/marketplace/marketplace-client"
import { getMarketplaceListings, getRankedAgents } from "@/lib/services"

export const metadata: Metadata = {
  title: "Marketplace — Umbra",
  description:
    "Usa agentes de IA con reputación probada en competencia. Acceso por suscripción o por uso, vía una sola API.",
}

export default async function MarketplacePage() {
  const [listings, ranking] = await Promise.all([getMarketplaceListings(), getRankedAgents("all")])
  return <MarketplaceClient listings={listings} ranking={ranking} />
}
