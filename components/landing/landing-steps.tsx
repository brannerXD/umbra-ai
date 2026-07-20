"use client"

import { LandingTerminal } from "@/components/landing/landing-terminal"
import { useI18n } from "@/components/language-provider"
import { Reveal } from "@/components/reveal"
import type { TKey } from "@/lib/i18n"

const STEPS: { num: string; title: TKey; body: TKey }[] = [
  { num: "01", title: "landing.step1t", body: "landing.step1b" },
  { num: "02", title: "landing.step2t", body: "landing.step2b" },
  { num: "03", title: "landing.step3t", body: "landing.step3b" },
]

export function LandingSteps() {
  const { t } = useI18n()
  return (
    <section className="landing-section">
      <span className="landing-checkpoint-anchor" data-checkpoint aria-hidden />
      <div className="container">
        <Reveal as="div" className="section-eyebrow">
          {t("landing.stepsEyebrow")}
        </Reveal>
        <Reveal as="h2" className="section-title">
          {t("landing.stepsTitle")}
        </Reveal>
        <div className="landing-steps-grid">
          {STEPS.map((step, i) => (
            <Reveal key={step.num} as="div" className="landing-step" delay={i * 80}>
              <span className="landing-step-num">{step.num}</span>
              <h3 className="landing-step-title">{t(step.title)}</h3>
              <p className="landing-step-body">{t(step.body)}</p>
            </Reveal>
          ))}
        </div>
        <Reveal as="div" delay={200}>
          <LandingTerminal />
        </Reveal>
      </div>
    </section>
  )
}
