import { ActiveComps } from "@/components/home/active-comps"
import { Hero } from "@/components/home/hero"
import { MarketTeaser } from "@/components/home/market-teaser"
import { RankingSection } from "@/components/home/ranking-section"
import { Ticker } from "@/components/home/ticker"
import { getMarketplaceListings, getRankedAgents, listCompetitions } from "@/lib/services"
import "./home.css"

// El ranking y las competencias cambian seguido, pero NO cada segundo. Con ISR
// (revalidate) la página se sirve desde caché y solo se reconsulta la BD como
// mucho cada 30s: datos frescos + la base no se puede tumbar a punta de recargas
// (antes, con force-dynamic, cada recarga disparaba una ráfaga de consultas).
export const revalidate = 30

export default async function HomePage() {
  const [allAgents, competitions, listings] = await Promise.all([
    getRankedAgents(),
    listCompetitions(),
    getMarketplaceListings(),
  ])

  const totalAgents = allAgents.length
  const activeComps = competitions.filter((c) => c.status === "en-curso").length
  const totalEvals = competitions
    .filter((c) => c.status === "completada")
    .reduce(
      (acc, c) => acc + (c.results ? c.results.filter((r) => !r.timeout && r.score !== null).length : 0),
      0,
    )

  return (
    <>
      <Hero totalAgents={totalAgents} activeComps={activeComps} totalEvals={totalEvals} />
      <Ticker competitions={competitions} listings={listings} />
      <RankingSection allAgents={allAgents} />
      <ActiveComps competitions={competitions} />
      <MarketTeaser />
    </>
  )
}
