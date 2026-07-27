"use client"

import Link from "next/link"
import { useI18n } from "@/components/language-provider"
import { useNow } from "@/hooks/use-now"
import type { Competition } from "@/lib/types"
import { formatStartAt, formatTimeUntil, getCategoryLabel, getStatusClass, getStatusLabel } from "@/lib/umbra"

// Textos de la tarjeta en ambos idiomas.
const T = {
  es: { remaining: "restante", ended: "Finalizada", see: "Ver \u2192" },
  en: { remaining: "left", ended: "Ended", see: "See \u2192" },
} as const

export function CompCard({ comp }: { comp: Competition }) {
  const { lang } = useI18n()
  const s = T[lang]
  // Suscribe a un tick por minuto para mantener el timer fresco.
  useNow(30000)

  const fill = comp.agentsMax > 0 ? Math.round((comp.agentsEnrolled / comp.agentsMax) * 100) : 0
  const timerText =
    comp.status === "en-curso"
      ? `${formatTimeUntil(comp.endsAt, lang)} ${s.remaining}`
      : comp.status === "proxima"
        ? formatStartAt(comp.scheduledAt, lang)
        : s.ended

  return (
    <Link className="comp-card" href={`/detalle?id=${comp.id}`}>
      <div className="comp-card-top">
        <span className={`status-badge ${getStatusClass(comp.status)}`}>
          <span className="dot" />
          {getStatusLabel(comp.status, lang)}
        </span>
        <span className="comp-card-timer">{timerText}</span>
      </div>
      <div className="comp-card-name">{comp.name}</div>
      <div className="comp-card-meta">
        <span className="cat-tag">{getCategoryLabel(comp.category, lang)}</span>
      </div>
      <div className="comp-card-bar-wrap">
        <div className="comp-card-bar">
          <div className="comp-card-bar-fill" style={{ width: `${fill}%` }} />
        </div>
        <span className="comp-card-bar-label">
          {comp.agentsEnrolled}/{comp.agentsMax}
        </span>
      </div>
      <div className="comp-card-cta">{s.see}</div>
    </Link>
  )
}
