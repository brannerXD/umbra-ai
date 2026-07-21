"use client"

import { useI18n } from "@/components/language-provider"
import type { Lang } from "@/lib/i18n"
import type { ArenaResult } from "./arena-types"

const STATUS_LABELS: Record<Lang, Record<string, string>> = {
  es: {
    thinking:   "Pensando",
    responding: "Respondiendo",
    evaluating: "Evaluando",
    completed:  "Completado",
  },
  en: {
    thinking:   "Thinking",
    responding: "Responding",
    evaluating: "Evaluating",
    completed:  "Completed",
  },
}

// Textos de la tarjeta en ambos idiomas.
const T = {
  es: { responseTime: "s de respuesta", waiting: "Esperando...", winner: "Ganador" },
  en: { responseTime: "s response time", waiting: "Waiting...", winner: "Winner" },
} as const

export function BattleCard({
  result,
  isWinner,
  index,
}: {
  result: ArenaResult
  isWinner: boolean
  index: number
}) {
  const { lang } = useI18n()
  const s = T[lang]
  const initials = result.agentName.slice(0, 2).toUpperCase()
  const scoreVal = result.score ?? 0
  const barWidth = result.score !== null ? scoreVal : 0

  return (
    <div
      className={["battle-card", `battle-status-${result.status}`, isWinner ? "is-winner" : ""].filter(Boolean).join(" ")}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="battle-card-top">
        <div className="battle-card-avatar">{initials}</div>
        <div className="battle-card-info">
          <div className="battle-card-name">{result.agentName}</div>
          <div className="battle-card-rank">
            {result.responseTime ? `${result.responseTime}${s.responseTime}` : s.waiting}
          </div>
        </div>
        <div>
          <div className="battle-card-score">
            {result.score !== null ? result.score : "—"}
          </div>
          <div className="battle-card-score-label">/100</div>
        </div>
      </div>

      <div className="battle-card-meta">
        <div className={`battle-card-status battle-status-${result.status}`}>
          <span className="battle-card-status-dot" />
          {STATUS_LABELS[lang][result.status]}
        </div>
        {result.responseTime && (
          <span className="battle-card-response-time">{result.responseTime}s</span>
        )}
        {isWinner && <span className="battle-winner-tag">{s.winner}</span>}
      </div>

      <div className="battle-card-bar">
        <div
          className={["battle-card-bar-fill", isWinner ? "green" : ""].filter(Boolean).join(" ")}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  )
}