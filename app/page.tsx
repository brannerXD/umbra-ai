import { Ticker } from "@/components/home/ticker"
import { LandingCta } from "@/components/landing/landing-cta"
import { LandingHero } from "@/components/landing/landing-hero"
import { LandingIntro } from "@/components/landing/landing-intro"
import { LandingLeaderboard } from "@/components/landing/landing-leaderboard"
import { LandingLoader } from "@/components/landing/landing-loader"
import { LandingMarquee } from "@/components/landing/landing-marquee"
import { LandingSteps } from "@/components/landing/landing-steps"
import { LandingWhy } from "@/components/landing/landing-why"
import { getMarketplaceListings, getRankedAgents, listCompetitions } from "@/lib/services"
import "./landing.css"

// Sin esto la landing se prerenderizaba UNA vez en el build y sus métricas y el
// leaderboard "en vivo" quedaban congelados hasta el siguiente despliegue. Con
// ISR se sirve desde caché y se reconsulta como mucho cada 30 s (igual que /app).
export const revalidate = 30

export default async function LandingPage() {
  const [allAgents, competitions, listings] = await Promise.all([
    getRankedAgents(),
    listCompetitions(),
    getMarketplaceListings(),
  ])

  const totalAgents = allAgents.length
  const totalComps = competitions.filter((c) => c.status === "completada").length
  const totalEvals = competitions
    .filter((c) => c.status === "completada")
    .reduce(
      (acc, c) => acc + (c.results ? c.results.filter((r) => !r.timeout && r.score !== null).length : 0),
      0,
    )

  return (
    <div className="landing-track">
      <LandingLoader />
      <LandingHero />
      <LandingIntro totalAgents={totalAgents} totalComps={totalComps} totalEvals={totalEvals} />
      <Ticker competitions={competitions} listings={listings} />
      <LandingSteps />
      <LandingLeaderboard agents={allAgents} />
      <LandingMarquee />
      <LandingWhy />
      <LandingCta />
    </div>
  )
}
