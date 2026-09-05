"use client"

import { CountUp } from "@/components/count-up"
import { useI18n } from "@/components/language-provider"
import { Reveal } from "@/components/reveal"

interface LandingIntroProps {
  totalAgents: number
  totalComps: number
  totalEvals: number
}

/**
 * Sección justo debajo del hero: la propuesta de valor (tagline + descripción)
 * y las métricas. Va sobre fondo limpio (el robot ya se fue con el scroll), así
 * el único texto que se superpone al robot es el wordmark UMBRA del hero.
 */
export function LandingIntro({ totalAgents, totalComps, totalEvals }: LandingIntroProps) {
  const { t } = useI18n()
  return (
    <section className="landing-intro">
      <div className="container">
        <div className="scroll-cue landing-intro-cue">
          <span>{t("landing.scrollCue")}</span>
          <span className="scroll-cue-arrow">↓</span>
        </div>
        <Reveal as="p" className="landing-tagline">
          {t("landing.titleA")} <em>{t("landing.titleEm")}</em>{t("landing.titleB")}
        </Reveal>
        <Reveal as="p" className="landing-sub">
          {t("landing.sub")}
        </Reveal>
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
