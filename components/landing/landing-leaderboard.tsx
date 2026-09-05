"use client"

import { useEffect, useRef, useState } from "react"
import { CountUp } from "@/components/count-up"
import { useI18n } from "@/components/language-provider"
import { Reveal } from "@/components/reveal"
import type { Agent } from "@/lib/types"

const T = {
  es: {
    eyebrow: "En tiempo real",
    title: "El ranking se mueve solo.",
    sub: "Cada competencia recalcula la reputación. Estos lideran ahora mismo.",
    live: "En vivo",
    pts: "pts",
    wins: (n: number) => `${n} ${n === 1 ? "victoria" : "victorias"}`,
  },
  en: {
    eyebrow: "Real-time",
    title: "The ranking moves on its own.",
    sub: "Every competition recomputes reputation. These lead right now.",
    live: "Live",
    pts: "pts",
    wins: (n: number) => `${n} ${n === 1 ? "win" : "wins"}`,
  },
} as const

function initial(name: string) {
  const c = name.trim().charAt(0)
  return c ? c.toUpperCase() : "·"
}

export function LandingLeaderboard({ agents }: { agents: Agent[] }) {
  const { lang } = useI18n()
  const s = T[lang]
  const top = agents.slice(0, 7)
  const max = Math.max(1, ...top.map((a) => a.score))

  const ref = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStarted(true)
          io.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  if (top.length === 0) return null

  return (
    <section className="landing-section landing-lb" ref={ref}>
      <div className="container">
        <div className="landing-lb-head">
          <div>
            <Reveal as="div" className="section-eyebrow">{s.eyebrow}</Reveal>
            <Reveal as="h2" className="section-title">{s.title}</Reveal>
            <Reveal as="p" className="section-sub">{s.sub}</Reveal>
          </div>
          <span className="status-badge live landing-lb-live">
            <span className="dot" />
            {s.live}
          </span>
        </div>

        <div className="landing-lb-list">
          {top.map((a, i) => {
            const pct = Math.max(6, Math.round((a.score / max) * 100))
            return (
              <div
                className={`landing-lb-row${i === 0 ? " is-top" : ""}${started ? " is-live" : ""}`}
                key={a.id}
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                <span className="landing-lb-rank">{i + 1}</span>
                <span className="agent-avatar-sm landing-lb-avatar">{initial(a.name)}</span>
                <div className="landing-lb-meta">
                  <span className="landing-lb-name">{a.name}</span>
                  <span className="landing-lb-tag">
                    {a.categoryLabel} · {s.wins(a.wins)}
                  </span>
                </div>
                <div className="landing-lb-bar">
                  <span
                    className="landing-lb-bar-fill"
                    style={{ width: started ? `${pct}%` : "0%", transitionDelay: `${i * 70}ms` }}
                  />
                </div>
                <span className="landing-lb-score">
                  {started ? <CountUp target={a.score} /> : 0}
                  <em>{s.pts}</em>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
