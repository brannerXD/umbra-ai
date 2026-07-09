import { Ticker } from "@/components/home/ticker"
import { LandingBackground } from "@/components/landing/landing-background"
import { LandingCta } from "@/components/landing/landing-cta"
import { LandingHero } from "@/components/landing/landing-hero"
import { LandingMarquee } from "@/components/landing/landing-marquee"
import { LandingOrigin } from "@/components/landing/landing-origin"
import { LandingScrollTrack } from "@/components/landing/landing-scroll-track"
import { LandingSteps } from "@/components/landing/landing-steps"
import { LandingWhy } from "@/components/landing/landing-why"
import { getMarketplaceListings, getRankedAgents, listCompetitions } from "@/lib/services"
import "./landing.css"

export default async function LandingPage() {
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
    <LandingScrollTrack>
      <LandingBackground />
      <LandingOrigin />
      <LandingHero
        agents={allAgents.slice(0, 8)}
        totalAgents={totalAgents}
        activeComps={activeComps}
        totalEvals={totalEvals}
      />
      <Ticker competitions={competitions} listings={listings} />
      <LandingSteps />
      <LandingMarquee />
      <LandingWhy />
      <LandingCta />
    </LandingScrollTrack>
  )
}
