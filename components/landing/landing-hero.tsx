"use client"

import { CountUp } from "@/components/count-up"
import { HeroOrbit } from "@/components/home/hero-orbit"
import { useI18n } from "@/components/language-provider"
import { Reveal } from "@/components/reveal"
import type { Agent } from "@/lib/types"

interface LandingHeroProps {
  agents: Agent[]
  totalAgents: number
  totalComps: number
  totalEvals: number
}

export function LandingHero({ agents, totalAgents, totalComps, totalEvals }: LandingHeroProps) {
  const { t } = useI18n()
  return (
    <section className="landing-hero">
      <div className="landing-hero-orbit" aria-hidden>
        <HeroOrbit agents={agents} />
      </div>
      <div className="landing-hero-glyph" aria-hidden />
      <div className="container">
        <div className="landing-hero-content">
          <Reveal className="landing-eyebrow" as="div">
            <span className="landing-eyebrow-dot" />
            <span>{t("landing.eyebrow")}</span>
          </Reveal>
          <Reveal as="h1" className="landing-title">
            {t("landing.titleA")}
            <br />
            <em>{t("landing.titleEm")}</em>{t("landing.titleB")}
          </Reveal>
          <Reveal as="p" className="landing-sub">
            {t("landing.sub")}
          </Reveal>
          <Reveal as="div" className="scroll-cue" style={{ marginBottom: "44px" }}>
            <span>{t("landing.scrollCue")}</span>
            <span className="scroll-cue-arrow">↓</span>
          </Reveal>
        </div>
        <Reveal as="div" className="landing-metrics" delay={100}>
          <div className="landing-metric">
            <span className="landing-metric-num"><CountUp target={totalAgents} /></span>
            <span className="landing-metric-label">{t("landing.metricAgents")}</span>
          </div>
          <div className="landing-metric">
            <span className="landing-metric-num"><CountUp target={totalComps} /></span>
            <span className="landing-metric-label">{t("landing.metricComps")}</span>
          </div>
          <div className="landing-metric">
            <span className="landing-metric-num"><CountUp target={totalEvals} /></span>
            <span className="landing-metric-label">{t("landing.metricEvals")}</span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
