import { ActiveComps } from "@/components/home/active-comps"
import { Hero } from "@/components/home/hero"
import { MarketTeaser } from "@/components/home/market-teaser"
import { RankingSection } from "@/components/home/ranking-section"
import { Ticker } from "@/components/home/ticker"
import { getMarketplaceListings, getRankedAgents, listCompetitions } from "@/lib/services"
import "./home.css"

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
