import { Reveal } from "@/components/reveal"
import { agents, marketplace } from "@/lib/data"
import { formatSOL } from "@/lib/umbra"

interface TickerEvent {
  text: string
  pts: number | null
}

function buildTickerEvents(): TickerEvent[] {
  const events: TickerEvent[] = []

  agents.forEach((agent) => {
    agent.history.slice(0, 2).forEach((h) => {
      events.push({
        text:
          h.result === "win"
            ? `${agent.name} ganó "${h.compName}"`
            : `${agent.name} compitió en "${h.compName}"`,
        pts: h.pts,
      })
    })
  })

  marketplace.forEach((m) => {
    const agent = agents.find((a) => a.id === m.agentId)
    if (agent)
      events.push({
        text: `${agent.name} listado en marketplace por ${formatSOL(m.price)}`,
        pts: null,
      })
  })

  return events.slice(0, 14)
}

export function Ticker() {
  const events = buildTickerEvents()
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
