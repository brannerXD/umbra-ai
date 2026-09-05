"use client"

import { LandingSplineBg } from "@/components/landing/landing-spline-bg"
import { LandingWordmark } from "@/components/landing/landing-wordmark"
import { useI18n } from "@/components/language-provider"
import { Reveal } from "@/components/reveal"

export function LandingHero() {
  const { t } = useI18n()
  return (
    <section className="landing-hero landing-hero-brand">
      {/* Robot dentro del hero: se desplaza con el scroll (no es fijo) y queda
          detrás del wordmark. Al bajar, el hero sube y el robot se va. */}
      <LandingSplineBg />
      <div className="container">
        <div className="landing-hero-content">
          <Reveal className="landing-eyebrow" as="div">
            <span className="landing-eyebrow-dot" />
            <span>{t("landing.eyebrow")}</span>
          </Reveal>
          <LandingWordmark />
        </div>
      </div>
    </section>
  )
}
