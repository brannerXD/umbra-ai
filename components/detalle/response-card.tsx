"use client"

import Link from "next/link"
import { useState } from "react"
import { Avatar } from "@/components/avatar"
import { ScoreCount } from "@/components/score-count"
import { useI18n } from "@/components/language-provider"
import type { Lang } from "@/lib/i18n"
import type { CompetitionResult } from "@/lib/types"

const CRIT_LABELS: Record<Lang, Record<string, string>> = {
  es: {
    accuracy: "Precisión",
    reasoning: "Razonamiento",
    structure: "Estructura",
    utility: "Utilidad",
  },
  en: {
    accuracy: "Accuracy",
    reasoning: "Reasoning",
    structure: "Structure",
    utility: "Utility",
  },
}

// Textos de la tarjeta en ambos idiomas.
const T = {
  es: {
    noAnswer: "Sin respuesta \u2014 el agente no respondió dentro del tiempo límite (10s).",
    winner: "Ganador",
    evaluating: "Evaluando...",
    scoreLabel: "Score de evaluación",
    answeredIn: "Respondió en",
    pending: "Pendiente",
    seeLess: "Ver menos",
    seeMore: "Ver más",
    waiting: "Esperando respuesta del agente...",
    hideEval: "Ocultar evaluación",
    showEval: "Ver evaluación",
  },
  en: {
    noAnswer: "No answer \u2014 the agent did not respond within the time limit (10s).",
    winner: "Winner",
    evaluating: "Evaluating...",
    scoreLabel: "Evaluation score",
    answeredIn: "Answered in",
    pending: "Pending",
    seeLess: "See less",
    seeMore: "See more",
    waiting: "Waiting for the agent to respond...",
    hideEval: "Hide evaluation",
    showEval: "See evaluation",
  },
} as const

export function ResponseCard({
  result,
  index,
  isWinner,
}: {
  result: CompetitionResult
  index: number
  isWinner: boolean
}) {
  const { lang } = useI18n()
  const s = T[lang]
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
          <p className="response-empty">{s.noAnswer}</p>
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
        {isWinner && <span className="response-winner-tag">{s.winner}</span>}
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
              {s.evaluating}
            </span>
          )}
          <div className="response-score-label">{s.scoreLabel}</div>
        </div>
        {result.responseTime ? (
          <div className="response-timing">
            {s.answeredIn} <strong>{result.responseTime}s</strong>
          </div>
        ) : (
          <div className="response-timing" style={{ color: "var(--text-3)" }}>
            {s.pending}
          </div>
        )}
      </div>

      <div className="response-text-wrap">
        {result.response ? (
          <>
            <p className={`response-text ${textExpanded ? "expanded" : ""}`}>{result.response}</p>
            <button className="btn-expand-text" onClick={() => setTextExpanded((v) => !v)}>
              {textExpanded ? s.seeLess : s.seeMore}
            </button>
          </>
        ) : (
          <p className="response-empty">{s.waiting}</p>
        )}
      </div>

      {result.evaluation && (
        <>
          <button className="response-eval-toggle" onClick={() => setEvalOpen((v) => !v)}>
            <span>{evalOpen ? s.hideEval : s.showEval}</span>
            <span className={`eval-arrow ${evalOpen ? "open" : ""}`}>▾</span>
          </button>
          <div className={`response-eval-content ${evalOpen ? "open" : ""}`}>
            <div className="response-eval-inner">
              {Object.entries(result.evaluation).map(([key, val], i) => (
                <div className="eval-criterion" key={key} style={{ animationDelay: `${i * 90}ms` }}>
                  <div className="eval-crit-header">
                    <span className="eval-crit-name">{CRIT_LABELS[lang][key] || key}</span>
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
