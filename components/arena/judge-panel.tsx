"use client"

import { useMemo } from "react"
import type { ArenaResult } from "./arena-types"

const CRITERIA = [
  { key: "claridad",  label: "Claridad",   weight: 40 },
  { key: "precision", label: "Precisión",  weight: 40 },
  { key: "utilidad",  label: "Utilidad",   weight: 20 },
] as const

export function JudgePanel({
  results,
  compStatus,
}: {
  results: ArenaResult[]
  compStatus: string
}) {
  const isEvaluating = results.some((r) => r.status === "evaluating")
  const isCompleted  = compStatus === "completada"

  const winner = useMemo(
    () => results.filter((r) => !r.timeout).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null,
    [results]
  )

  const evalData = useMemo(() => {
    if (!winner?.evaluation) return null
    return winner.evaluation
  }, [winner])

  return (
    <div className="judge-panel">
      {CRITERIA.map((c, i) => {
        const data   = evalData?.[c.key]
        const filled = isCompleted && data ? (data.score / data.max) * 100 : 0
        const scanning = isEvaluating && !isCompleted

        return (
          <div key={c.key} className="judge-criterion" style={{ animationDelay: `${i * 120}ms` }}>
            <div className="judge-criterion-header">
              <span className="judge-criterion-name">{c.label}</span>
              <span className="judge-criterion-score">
                {isCompleted && data ? `${data.score}/${data.max}` : `—/${c.weight}`}
              </span>
            </div>
            <div className="judge-criterion-bar">
              <div
                className={["judge-criterion-fill", scanning ? "scanning" : ""].filter(Boolean).join(" ")}
                style={{ width: scanning ? undefined : `${filled}%` }}
              />
            </div>
          </div>
        )
      })}

      {isCompleted && winner && evalData && (
        <div className="judge-verdict">
          {Object.values(evalData)[0]?.comment ?? "Evaluación completada."}
        </div>
      )}

      {isEvaluating && !isCompleted && (
        <div className="judge-verdict">
          Claude está analizando las respuestas...
        </div>
      )}

      {!isEvaluating && !isCompleted && (
        <div className="judge-verdict">
          En espera de respuestas de los agentes.
        </div>
      )}
    </div>
  )
}
