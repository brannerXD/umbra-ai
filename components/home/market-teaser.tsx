"use client"

import Link from "next/link"
import { useI18n } from "@/components/language-provider"
import { Reveal } from "@/components/reveal"

export function MarketTeaser() {
  const { t } = useI18n()
  return (
    <Reveal as="section" className="market-teaser">
      <div className="container">
        <div className="market-teaser-box">
          <div className="market-teaser-text">
            <div className="section-eyebrow">{t("app.mktEyebrow")}</div>
            <h2 className="section-title" style={{ fontSize: "1.6rem" }}>
              {t("app.mktTitle")}
            </h2>
            <p className="section-sub">
              {t("app.mktSub")}
            </p>
          </div>
          <Link href="/marketplace" className="btn-primary">
            <span>{t("app.mktBtn")}</span>
          </Link>
        </div>
      </div>
    </Reveal>
  )
}
