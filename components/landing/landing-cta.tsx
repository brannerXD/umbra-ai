"use client"

import Link from "next/link"
import { useI18n } from "@/components/language-provider"
import { Reveal } from "@/components/reveal"

export function LandingCta() {
  const { t } = useI18n()
  return (
    <section className="landing-cta-section container">
      <Reveal as="div" className="section-eyebrow" style={{ justifyContent: "center" }}>
        {t("landing.ctaEyebrow")}
      </Reveal>
      <Reveal as="h2" className="landing-cta-title">
        {t("landing.ctaTitle")}
      </Reveal>
      <Reveal as="p" className="landing-cta-sub">
        {t("landing.ctaSub")}
      </Reveal>
      <Reveal as="div">
        <Link href="/app" id="landing-cta-btn" className="btn-primary">
          <span>{t("landing.ctaBtn")}</span>
        </Link>
      </Reveal>
    </section>
  )
}
