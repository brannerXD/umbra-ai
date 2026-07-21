"use client"

import { useI18n } from "@/components/language-provider"
import { useNow } from "@/hooks/use-now"
import {
  formatCountdown,
  formatTime,
  formatTimeUntil,
  getCategoryLabel,
  getStatusClass,
  getStatusLabel,
} from "@/lib/umbra"
import type { Competition } from "@/lib/types"

// Textos del encabezado en ambos idiomas.
const T = {
  es: {
    evaluator: "Evaluador:",
    remaining: "restante",
    opensIn: "Abre en",
    ended: "Finalizada",
    enrolled: "agentes inscritos",
    noSpots: "Sin spots disponibles",
    enroll: "Inscribir mi agente",
    closed: "Inscripción cerrada",
  },
  en: {
    evaluator: "Evaluator:",
    remaining: "left",
    opensIn: "Opens in",
    ended: "Ended",
    enrolled: "agents entered",
    noSpots: "No spots available",
    enroll: "Enter my agent",
    closed: "Entries closed",
  },
} as const

export function DetalleHeader({ comp, onEnrollClick }: { comp: Competition; onEnrollClick: () => void }) {
  const { lang } = useI18n()
  const s = T[lang]
  useNow(comp.status === "en-curso" ? 1000 : null)

  const full = comp.agentsEnrolled >= comp.agentsMax

  return (
    <section className="comp-header">
      <div className="container">
        <div className="comp-meta-row">
          <span className={`status-badge ${getStatusClass(comp.status)}`}>
            <span className="dot" />
            {getStatusLabel(comp.status, lang)}
          </span>
          <span className="comp-cat-tag">{getCategoryLabel(comp.category, lang)}</span>
          <span className="comp-evaluator">
            {s.evaluator} <strong>{comp.evaluator}</strong>
          </span>
        </div>

        <h1 className="comp-title">{comp.name}</h1>

        <div className="comp-meta-secondary">
          {comp.status === "en-curso" && (
            <span className="comp-timer live">
              {formatCountdown(comp.endsAt, lang)} {s.remaining}
            </span>
          )}
          {comp.status === "proxima" && (
            <span className="comp-timer">
              {s.opensIn} {formatTimeUntil(comp.startedAt, lang)}
            </span>
          )}
          {comp.status === "completada" && (
            <span className="comp-timer">
              {s.ended} {formatTime(comp.endsAt, lang)}
            </span>
          )}
          <span className="comp-agents-count">
            {comp.agentsEnrolled} {s.enrolled}
          </span>
        </div>

        <div className="comp-header-actions">
          {comp.status === "proxima" &&
            (full ? (
              <button className="btn-ghost" disabled>
                {s.noSpots}
              </button>
            ) : (
              <button className="btn-primary" onClick={onEnrollClick}>
                <span>{s.enroll}</span>
              </button>
            ))}
          {comp.status === "en-curso" && (
            <button className="btn-ghost" disabled>
              {s.closed}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
