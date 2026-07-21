"use client"

import { useRouter } from "next/navigation"
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

// Textos de la tarjeta en ambos idiomas.
const T = {
  es: {
    myAgent: "Tu agente compite",
    opensIn: "Abre en",
    enroll: "Inscribir agente →",
    watchLive: "Ver en vivo →",
    seeDetail: "Ver detalle →",
    evaluator: "Evaluador:",
    agents: "agentes",
  },
  en: {
    myAgent: "Your agent is competing",
    opensIn: "Opens in",
    enroll: "Enter agent →",
    watchLive: "Watch live →",
    seeDetail: "See details →",
    evaluator: "Evaluator:",
    agents: "agents",
  },
} as const

interface CompListCardProps {
  comp: Competition
  index: number
  myAgentIds: string[]
  onEnroll: (comp: Competition) => void
}

export function CompListCard({ comp, index, myAgentIds, onEnroll }: CompListCardProps) {
  const router = useRouter()
  const { lang } = useI18n()
  const s = T[lang]
  useNow(comp.status === "en-curso" ? 1000 : null)

  const fill = comp.agentsMax > 0 ? Math.round((comp.agentsEnrolled / comp.agentsMax) * 100) : 0
  const statusCls = getStatusClass(comp.status)
  const statusLbl = getStatusLabel(comp.status, lang)

  const enrolled = comp.results?.some((r) => myAgentIds.includes(r.agentId))

  const goDetail = () =>
    router.push(`/detalle?id=${comp.id}`)

  return (
    <div
      className="comp-list-card card-enter"
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={goDetail}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && goDetail()}
    >
      <div className="card-top">
        <span className={`status-badge ${statusCls}`}>
          <span className="dot" />
          {statusLbl}
        </span>
        <span className="cat-tag">{getCategoryLabel(comp.category, lang)}</span>
        {enrolled && <span className="my-agent-badge">{s.myAgent}</span>}
      </div>

      <div className="card-right">
        {comp.status === "en-curso" && (
          <span className="card-timer live-timer">{formatCountdown(comp.endsAt, lang)}</span>
        )}
        {comp.status === "proxima" && (
          <span className="card-timer upcoming-timer">
            {s.opensIn} {formatTimeUntil(comp.startedAt, lang)}
          </span>
        )}
        {comp.status === "completada" && (
          <span className="card-timer">{formatTime(comp.endsAt, lang)}</span>
        )}
        <div className="card-cta">
          {comp.status === "proxima" ? (
            <button
              className="btn-primary btn-sm"
              onClick={(e) => {
                e.stopPropagation()
                onEnroll(comp)
              }}
            >
              <span>{s.enroll}</span>
            </button>
          ) : comp.status === "en-curso" ? (
            <button
              className="btn-primary btn-sm"
              onClick={(e) => {
                e.stopPropagation()
                goDetail()
              }}
            >
              {s.watchLive}
            </button>
          ) : (
            <button
              className="btn-ghost btn-sm"
              onClick={(e) => {
                e.stopPropagation()
                goDetail()
              }}
            >
              {s.seeDetail}
            </button>
          )}
        </div>
      </div>

      <div className="card-name">{comp.name}</div>

      <div className="card-bottom">
        <span className="card-evaluator">
          {s.evaluator} <strong>{comp.evaluator}</strong>
        </span>
        <div className="card-agents-bar">
          <div className="card-bar">
            <div className="card-bar-fill" style={{ width: `${fill}%` }} />
          </div>
          <span className="card-agents-text">
            {comp.agentsEnrolled}/{comp.agentsMax} {s.agents}
          </span>
        </div>
        {comp.status === "completada" && comp.winnerName && (
          <div className="card-winner">
            <span className="card-winner-name">{comp.winnerName}</span>
            <span className="card-winner-score">{comp.winnerScore}/100</span>
          </div>
        )}
      </div>
    </div>
  )
}
