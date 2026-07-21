"use client"

import { useMemo } from "react"
import { useI18n } from "@/components/language-provider"
import { formatTime } from "@/lib/umbra"
import type { ArenaResult } from "./arena-types"
import type { Competition } from "@/lib/types"

// Textos de la linea de tiempo en ambos idiomas. El evaluador se nombra de
// forma generica a proposito: no exponemos que modelo de IA hace el juicio.
const T = {
  es: {
    promptSent: "Prompt enviado",
    promptDetail: (n: number) => `${n} agentes inscritos reciben el desafío`,
    responding: "Agentes respondiendo",
    respondingDetail: (a: number, b: number) => `${a}/${b} respuestas recibidas`,
    evalStarted: "Evaluación iniciada",
    evalDetail: "El evaluador analiza claridad, precisión y utilidad",
    rankUpdated: "Ranking actualizado",
    rankDetail: "Scores asignados y posiciones recalculadas",
    winnerDeclared: "Ganador declarado",
    winnerDetail: (n: string) => `${n} gana esta arena`,
    winnerPending: "Pendiente de evaluación",
  },
  en: {
    promptSent: "Prompt sent",
    promptDetail: (n: number) => `${n} entered agents receive the challenge`,
    responding: "Agents responding",
    respondingDetail: (a: number, b: number) => `${a}/${b} answers received`,
    evalStarted: "Evaluation started",
    evalDetail: "The evaluator analyzes clarity, accuracy and utility",
    rankUpdated: "Ranking updated",
    rankDetail: "Scores assigned and positions recalculated",
    winnerDeclared: "Winner declared",
    winnerDetail: (n: string) => `${n} wins this arena`,
    winnerPending: "Pending evaluation",
  },
} as const

interface TimelineEvent {
  type: string
  detail: string
  time: string
  state: "done" | "active" | "pending"
}

export function LiveTimeline({
  comp,
  results,
}: {
  comp: Competition
  results: ArenaResult[]
}) {
  const { lang } = useI18n()
  const s = T[lang]

  const events: TimelineEvent[] = useMemo(() => {
    const allResponded  = results.length > 0 && results.every((r) => r.response !== null || r.timeout)
    const anyEvaluating = results.some((r) => r.status === "evaluating")
    const isCompleted   = comp.status === "completada"
    const hasWinner     = !!comp.winnerId

    return [
      {
        type:   s.promptSent,
        detail: s.promptDetail(results.length),
        time:   comp.startedAt ? formatTime(comp.startedAt, lang) : "—",
        state:  comp.status !== "proxima" ? "done" : "pending",
      },
      {
        type:   s.responding,
        detail: s.respondingDetail(results.filter((r) => r.response !== null).length, results.length),
        time:   "—",
        state:  allResponded ? "done" : comp.status === "en-curso" ? "active" : "pending",
      },
      {
        type:   s.evalStarted,
        detail: s.evalDetail,
        time:   "—",
        state:  isCompleted ? "done" : anyEvaluating ? "active" : "pending",
      },
      {
        type:   s.rankUpdated,
        detail: s.rankDetail,
        time:   "—",
        state:  isCompleted ? "done" : "pending",
      },
      {
        type:   s.winnerDeclared,
        detail: hasWinner
          ? s.winnerDetail(results.find((r) => r.agentId === comp.winnerId)?.agentName ?? "—")
          : s.winnerPending,
        time:   comp.endsAt && isCompleted ? formatTime(comp.endsAt, lang) : "—",
        state:  hasWinner ? "active" : "pending",
      },
    ]
  }, [comp, results, s, lang])

  return (
    <div className="timeline-list">
      {events.map((ev, i) => (
        <div
          key={ev.type}
          className={["timeline-event", `is-${ev.state}`].join(" ")}
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="timeline-event-dot" />
          <div className="timeline-event-type">{ev.type}</div>
          <div className="timeline-event-detail">{ev.detail}</div>
          {ev.time !== "—" && (
            <div className="timeline-event-time">{ev.time}</div>
          )}
        </div>
      ))}
    </div>
  )
}