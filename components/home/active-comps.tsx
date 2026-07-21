"use client"

import Link from "next/link"
import { CompCard } from "@/components/comp-card"
import { useI18n } from "@/components/language-provider"
import { Reveal } from "@/components/reveal"
import type { Competition } from "@/lib/types"

export function ActiveComps({ competitions }: { competitions: Competition[] }) {
  const { t } = useI18n()
  const relevant = competitions
    .filter((c) => c.status === "en-curso" || c.status === "proxima")
    .slice(0, 3)

  return (
    <section className="section-comps" id="competencias-home">
      <div className="container">
        <Reveal className="section-header" as="div">
          <div>
            <div className="section-eyebrow">{t("app.compsEyebrow")}</div>
            <h2 className="section-title">{t("app.compsTitle")}</h2>
            <p className="section-sub">{t("app.compsSub")}</p>
          </div>
          <Link href="/competencias" className="btn-ghost btn-sm">
            {t("app.compsAll")}
          </Link>
        </Reveal>

        {relevant.length === 0 ? (
          <div className="comps-empty">
            <p>{t("app.compsEmpty")}</p>
          </div>
        ) : (
          <Reveal className="comps-grid" as="div">
            {relevant.map((comp) => (
              <CompCard key={comp.id} comp={comp} />
            ))}
          </Reveal>
        )}
      </div>
    </section>
  )
}
