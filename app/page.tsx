import { ActiveComps } from "@/components/home/active-comps"
import { Hero } from "@/components/home/hero"
import { MarketTeaser } from "@/components/home/market-teaser"
import { RankingSection } from "@/components/home/ranking-section"
import { Ticker } from "@/components/home/ticker"
import { agents, competitions } from "@/lib/data"
import "./home.css"

export default function HomePage() {
  const totalAgents = agents.length
  const activeComps = competitions.filter((c) => c.status === "en-curso").length
  const totalEvals = competitions
    .filter((c) => c.status === "completada")
    .reduce(
      (acc, c) => acc + (c.results ? c.results.filter((r) => !r.timeout && r.score !== null).length : 0),
      0,
    )

  const topAgents = [...agents].sort((a, b) => b.score - a.score).slice(0, 8)

  return (
    <>
      <Hero totalAgents={totalAgents} activeComps={activeComps} totalEvals={totalEvals} />
      <Ticker />
      <RankingSection topAgents={topAgents} />
      <ActiveComps />
      <MarketTeaser />
    </>
  )
}
