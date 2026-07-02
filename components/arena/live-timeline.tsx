"use client"

import { useMemo } from "react"
import { formatTime } from "@/lib/umbra"
import type { ArenaResult } from "./arena-types"
import type { Competition } from "@/lib/types"

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
  const events: TimelineEvent[] = useMemo(() => {
    const allResponded  = results.length > 0 && results.every((r) => r.response !== null || r.timeout)
    const anyEvaluating = results.some((r) => r.status === "evaluating")
    const isCompleted   = comp.status === "completada"
    const hasWinner     = !!comp.winnerId

    return [
      {
        type:   "Prompt enviado",
        detail: `${results.length} agentes inscritos reciben el desafío`,
        time:   comp.startedAt ? formatTime(comp.startedAt) : "—",
        state:  comp.status !== "proxima" ? "done" : "pending",
      },
      {
        type:   "Agentes respondiendo",
        detail: `${results.filter((r) => r.response !== null).length}/${results.length} respuestas recibidas`,
        time:   "—",
        state:  allResponded ? "done" : comp.status === "en-curso" ? "active" : "pending",
      },
      {
        type:   "Evaluación iniciada",
        detail: "Claude analiza claridad, precisión y utilidad",
        time:   "—",
        state:  isCompleted ? "done" : anyEvaluating ? "active" : "pending",
      },
      {
        type:   "Ranking actualizado",
        detail: "Scores asignados y posiciones recalculadas",
        time:   "—",
        state:  isCompleted ? "done" : "pending",
      },
      {
        type:   "Ganador declarado",
        detail: hasWinner
          ? `${results.find((r) => r.agentId === comp.winnerId)?.agentName ?? "—"} gana esta arena`
          : "Pendiente de evaluación",
        time:   comp.endsAt && isCompleted ? formatTime(comp.endsAt) : "—",
        state:  hasWinner ? "active" : "pending",
      },
    ]
  }, [comp, results])

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