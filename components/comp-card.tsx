"use client"

import Link from "next/link"
import { useNow } from "@/hooks/use-now"
import type { Competition } from "@/lib/types"
import { formatTimeUntil, getStatusClass, getStatusLabel } from "@/lib/umbra"

export function CompCard({ comp }: { comp: Competition }) {
  // Suscribe a un tick por minuto para mantener el timer fresco.
  useNow(30000)

  const fill = comp.agentsMax > 0 ? Math.round((comp.agentsEnrolled / comp.agentsMax) * 100) : 0
  const timerText =
    comp.status === "en-curso"
      ? `${formatTimeUntil(comp.endsAt)} restante`
      : comp.status === "proxima"
        ? `Abre en ${formatTimeUntil(comp.startedAt)}`
        : "Finalizada"

  return (
    <Link className="comp-card" href={`/detalle?id=${comp.id}`}>
      <div className="comp-card-top">
        <span className={`status-badge ${getStatusClass(comp.status)}`}>
          <span className="dot" />
          {getStatusLabel(comp.status)}
        </span>
        <span className="comp-card-timer">{timerText}</span>
      </div>
      <div className="comp-card-name">{comp.name}</div>
      <div className="comp-card-meta">
        <span className="cat-tag">{comp.categoryLabel}</span>
      </div>
      <div className="comp-card-bar-wrap">
        <div className="comp-card-bar">
          <div className="comp-card-bar-fill" style={{ width: `${fill}%` }} />
        </div>
        <span className="comp-card-bar-label">
          {comp.agentsEnrolled}/{comp.agentsMax}
        </span>
      </div>
      <div className="comp-card-cta">Ver →</div>
    </Link>
  )
}
