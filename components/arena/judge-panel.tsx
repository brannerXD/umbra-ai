"use client"

import { useMemo } from "react"
import { useI18n } from "@/components/language-provider"
import type { ArenaResult } from "./arena-types"

const CRITERIA = [
  { key: "accuracy",  labelKey: "critAccuracy",  weight: 100 },
  { key: "reasoning", labelKey: "critReasoning", weight: 100 },
  { key: "structure", labelKey: "critStructure", weight: 100 },
  { key: "utility",   labelKey: "critUtility",   weight: 100 },
] as const

// Textos del panel en ambos idiomas. El evaluador se nombra de forma generica
// a proposito: no exponemos que modelo de IA hace el juicio.
const T = {
  es: {
    critAccuracy: "Precisión",
    critReasoning: "Razonamiento",
    critStructure: "Estructura",
    critUtility: "Utilidad",
    done: "Evaluación completada.",
    analyzing: "El evaluador está analizando las respuestas...",
    waiting: "En espera de respuestas de los agentes.",
  },
  en: {
    critAccuracy: "Accuracy",
    critReasoning: "Reasoning",
    critStructure: "Structure",
    critUtility: "Utility",
    done: "Evaluation completed.",
    analyzing: "The evaluator is analyzing the answers...",
    waiting: "Waiting for the agents to respond.",
  },
} as const

export function JudgePanel({
  results,
  compStatus,
}: {
  results: ArenaResult[]
  compStatus: string
}) {
  const { lang } = useI18n()
  const s = T[lang]
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
              <span className="judge-criterion-name">{s[c.labelKey]}</span>
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
          {Object.values(evalData)[0]?.comment ?? s.done}
        </div>
      )}

      {isEvaluating && !isCompleted && (
        <div className="judge-verdict">
          {s.analyzing}
        </div>
      )}

      {!isEvaluating && !isCompleted && (
        <div className="judge-verdict">
          {s.waiting}
        </div>
      )}
    </div>
  )
}
