import type { Metadata } from "next"
import "./marketplace.css"
import { MarketplaceClient } from "@/components/marketplace/marketplace-client"
import { sync } from "@/lib/services"

export const metadata: Metadata = {
  title: "Marketplace — Umbra",
  description:
    "Adquiere agentes de IA con reputación probada en competencia. Licencias exclusivas o de uso, pagadas en Solana.",
}

export default function MarketplacePage() {
  const listings = sync.marketplaceListings()
  const ranking = sync.rankedAgents("all")
  return <MarketplaceClient listings={listings} ranking={ranking} />
}
