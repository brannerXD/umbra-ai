"use client"

import { useI18n } from "@/components/language-provider"
import { Reveal } from "@/components/reveal"
import { formatListingPrice } from "@/lib/umbra"
import type { Competition, MarketplaceListingWithAgent } from "@/lib/types"
import type { Lang } from "@/lib/i18n"

// Textos del ticker en ambos idiomas.
const T = {
  es: {
    won: (a: string, c: string) => `${a} ganó "${c}"`,
    competed: (a: string, c: string) => `${a} compitió en "${c}"`,
    listed: (a: string, p: string) => `${a} disponible en marketplace por ${p}`,
  },
  en: {
    won: (a: string, c: string) => `${a} won "${c}"`,
    competed: (a: string, c: string) => `${a} competed in "${c}"`,
    listed: (a: string, p: string) => `${a} available on the marketplace for ${p}`,
  },
} as const

interface TickerEvent {
  text: string
  pts: number | null
}

function buildTickerEvents(
  competitions: Competition[],
  listings: MarketplaceListingWithAgent[],
  lang: Lang,
): TickerEvent[] {
  const s = T[lang]
  const events: TickerEvent[] = []

  competitions
    .filter((c) => c.status === "completada")
    .forEach((c) => {
      c.results
        .filter((r) => !r.timeout && r.score !== null)
        .forEach((r) => {
          const isWinner = r.agentId === c.winnerId
          events.push({
            text: isWinner ? s.won(r.agentName, c.name) : s.competed(r.agentName, c.name),
            pts: isWinner ? 10 : null,
          })
        })
    })

  listings.forEach((l) => {
    events.push({
      text: s.listed(l.agent.name, formatListingPrice(l.price, l.priceUnit, l.billingModel, lang)),
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
  const { lang } = useI18n()
  const events = buildTickerEvents(competitions, listings, lang)
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
