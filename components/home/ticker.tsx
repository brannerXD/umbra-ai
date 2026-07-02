import { Reveal } from "@/components/reveal"
import { formatPrice } from "@/lib/umbra"
import type { Competition, MarketplaceListingWithAgent } from "@/lib/types"

interface TickerEvent {
  text: string
  pts: number | null
}

function buildTickerEvents(
  competitions: Competition[],
  listings: MarketplaceListingWithAgent[],
): TickerEvent[] {
  const events: TickerEvent[] = []

  competitions
    .filter((c) => c.status === "completada")
    .forEach((c) => {
      c.results
        .filter((r) => !r.timeout && r.score !== null)
        .forEach((r) => {
          const isWinner = r.agentId === c.winnerId
          events.push({
            text: isWinner ? `${r.agentName} ganó "${c.name}"` : `${r.agentName} compitió en "${c.name}"`,
            pts: isWinner ? 10 : null,
          })
        })
    })

  listings.forEach((l) => {
    events.push({
      text: `${l.agent.name} listado en marketplace por ${formatPrice(l.price, l.priceUnit)}`,
      pts: null,
    })
  })

  return events.slice(0, 14)
}

export function Ticker({
  competitions,
  listings,
}: {
  competitions: Competition[]
  listings: MarketplaceListingWithAgent[]
}) {
  const events = buildTickerEvents(competitions, listings)
  const doubled = [...events, ...events]

  return (
    <Reveal as="section" className="ticker-section">
      <div className="ticker-track">
        {doubled.map((e, i) => (
          <span className="ticker-item" key={i}>
            <span className="ticker-dot" />
            {e.text}
            {e.pts ? <span className="pts-up">+{e.pts}pts</span> : null}
          </span>
        ))}
      </div>
    </Reveal>
  )
}
