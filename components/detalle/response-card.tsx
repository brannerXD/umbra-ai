"use client"

import Link from "next/link"
import { useState } from "react"
import { Avatar } from "@/components/avatar"
import { ScoreCount } from "@/components/score-count"
import type { CompetitionResult } from "@/lib/types"

const CRIT_LABELS: Record<string, string> = {
  accuracy: "Precisión",
  reasoning: "Razonamiento",
  structure: "Estructura",
  utility: "Utilidad",
}

export function ResponseCard({
  result,
  index,
  isWinner,
}: {
  result: CompetitionResult
  index: number
  isWinner: boolean
}) {
  const [evalOpen, setEvalOpen] = useState(false)
  const [textExpanded, setTextExpanded] = useState(false)

  if (result.timeout) {
    return (
      <div className="response-card timeout" style={{ animationDelay: `${index * 70}ms` }}>
        <div className="response-card-header">
          <Avatar name={result.agentName} size={32} />
          <Link className="response-agent-name" href={`/agente?id=${result.agentId}`}>
            {result.agentName}
          </Link>
          <span className="timeout-badge">TIMEOUT</span>
        </div>
        <div className="response-text-wrap">
          <p className="response-empty">
            Sin respuesta — el agente no respondió dentro del tiempo límite (10s).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`response-card ${isWinner ? "winner" : ""}`}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="response-card-header">
        <Avatar name={result.agentName} size={32} />
        <Link className="response-agent-name" href={`/agente?id=${result.agentId}`}>
          {result.agentName}
        </Link>
        {isWinner && <span className="response-winner-tag">Ganador</span>}
      </div>

      <div className="response-score-area">
        <div>
          {result.score !== null ? (
            <span className="response-score">
              <ScoreCount target={result.score} />
              <span style={{ fontSize: "1rem", color: "var(--text-3)" }}>/100</span>
            </span>
          ) : (
            <span className="response-score evaluating">
              <span className="mini-spinner" />
              Evaluando...
            </span>
          )}
          <div className="response-score-label">Score de evaluación</div>
        </div>
        {result.responseTime ? (
          <div className="response-timing">
            Respondió en <strong>{result.responseTime}s</strong>
          </div>
        ) : (
          <div className="response-timing" style={{ color: "var(--text-3)" }}>
            Pendiente
          </div>
        )}
      </div>

      <div className="response-text-wrap">
        {result.response ? (
          <>
            <p className={`response-text ${textExpanded ? "expanded" : ""}`}>{result.response}</p>
            <button className="btn-expand-text" onClick={() => setTextExpanded((v) => !v)}>
              {textExpanded ? "Ver menos" : "Ver más"}
            </button>
          </>
        ) : (
          <p className="response-empty">Esperando respuesta del agente...</p>
        )}
      </div>

      {result.evaluation && (
        <>
          <button className="response-eval-toggle" onClick={() => setEvalOpen((v) => !v)}>
            <span>{evalOpen ? "Ocultar evaluación" : "Ver evaluación"}</span>
            <span className={`eval-arrow ${evalOpen ? "open" : ""}`}>▾</span>
          </button>
          <div className={`response-eval-content ${evalOpen ? "open" : ""}`}>
            <div className="response-eval-inner">
              {Object.entries(result.evaluation).map(([key, val], i) => (
                <div className="eval-criterion" key={key} style={{ animationDelay: `${i * 90}ms` }}>
                  <div className="eval-crit-header">
                    <span className="eval-crit-name">{CRIT_LABELS[key] || key}</span>
                    <span className="eval-crit-score">
                      {val.score}/{val.max}
                    </span>
                  </div>
                  <p className="eval-crit-text">&quot;{val.comment}&quot;</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
