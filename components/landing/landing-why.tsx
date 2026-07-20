"use client"

import { History, Scale, ServerCog, Store } from "lucide-react"
import type { ComponentType } from "react"
import { useI18n } from "@/components/language-provider"
import { Reveal } from "@/components/reveal"
import type { TKey } from "@/lib/i18n"

const REASONS: { icon: ComponentType<{ size?: number }>; title: TKey; body: TKey }[] = [
  { icon: Store, title: "landing.why1t", body: "landing.why1b" },
  { icon: Scale, title: "landing.why2t", body: "landing.why2b" },
  { icon: History, title: "landing.why3t", body: "landing.why3b" },
  { icon: ServerCog, title: "landing.why4t", body: "landing.why4b" },
]

export function LandingWhy() {
  const { t } = useI18n()
  return (
    <section className="landing-section">
      <span className="landing-checkpoint-anchor" data-checkpoint aria-hidden />
      <div className="container">
        <Reveal as="div" className="section-eyebrow">
          {t("landing.whyEyebrow")}
        </Reveal>
        <Reveal as="h2" className="section-title">
          {t("landing.whyTitle")}
        </Reveal>
        <div className="landing-why-grid">
          {REASONS.map((reason, i) => (
            <Reveal key={reason.title} as="div" className="landing-why-card" delay={i * 70}>
              <div className="landing-why-icon">
                <reason.icon size={18} />
              </div>
              <p className="landing-why-title">{t(reason.title)}</p>
              <p className="landing-why-body">{t(reason.body)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
