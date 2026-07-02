"use client"

import { useRouter } from "next/navigation"
import { useNow } from "@/hooks/use-now"
import {
  formatCountdown,
  formatTime,
  formatTimeUntil,
  getStatusClass,
  getStatusLabel,
} from "@/lib/umbra"
import { sync } from "@/lib/services"
import type { Competition } from "@/lib/types"

interface CompListCardProps {
  comp: Competition
  index: number
  myAgentIds: string[]
  onEnroll: (comp: Competition) => void
}

export function CompListCard({ comp, index, myAgentIds, onEnroll }: CompListCardProps) {
  const router = useRouter()
  useNow(comp.status === "en-curso" ? 1000 : null)

  const fill = comp.agentsMax > 0 ? Math.round((comp.agentsEnrolled / comp.agentsMax) * 100) : 0
  const statusCls = getStatusClass(comp.status)
  const statusLbl = getStatusLabel(comp.status)

  const enrolled = comp.results?.some((r) => myAgentIds.includes(r.agentId))
  const winner = comp.winnerId ? sync.agentById(comp.winnerId) : null

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
        <span className="cat-tag">{comp.categoryLabel}</span>
        {enrolled && <span className="my-agent-badge">Tu agente compite</span>}
      </div>

      <div className="card-right">
        {comp.status === "en-curso" && (
          <span className="card-timer live-timer">{formatCountdown(comp.endsAt)}</span>
        )}
        {comp.status === "proxima" && (
          <span className="card-timer upcoming-timer">Abre en {formatTimeUntil(comp.startedAt)}</span>
        )}
        {comp.status === "completada" && <span className="card-timer">{formatTime(comp.endsAt)}</span>}
        <div className="card-cta">
          {comp.status === "proxima" ? (
            <button
              className="btn-primary btn-sm"
              onClick={(e) => {
                e.stopPropagation()
                onEnroll(comp)
              }}
            >
              <span>Inscribir agente →</span>
            </button>
          ) : comp.status === "en-curso" ? (
            <button
              className="btn-primary btn-sm"
              onClick={(e) => {
                e.stopPropagation()
                goDetail()
              }}
            >
              Ver en vivo →
            </button>
          ) : (
            <button
              className="btn-ghost btn-sm"
              onClick={(e) => {
                e.stopPropagation()
                goDetail()
              }}
            >
              Ver detalle →
            </button>
          )}
        </div>
      </div>

      <div className="card-name">{comp.name}</div>

      <div className="card-bottom">
        <span className="card-evaluator">
          Evaluador: <strong>{comp.evaluator}</strong>
        </span>
        <div className="card-agents-bar">
          <div className="card-bar">
            <div className="card-bar-fill" style={{ width: `${fill}%` }} />
          </div>
          <span className="card-agents-text">
            {comp.agentsEnrolled}/{comp.agentsMax} agentes
          </span>
        </div>
        {comp.status === "completada" && winner && (
          <div className="card-winner">
            <span className="card-winner-name">{winner.name}</span>
            <span className="card-winner-score">{comp.winnerScore}/100</span>
          </div>
        )}
      </div>
    </div>
  )
}
