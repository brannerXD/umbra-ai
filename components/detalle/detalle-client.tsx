"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Avatar } from "@/components/avatar"
import { ScoreCount } from "@/components/score-count"
import { DetalleHeader } from "./detalle-header"
import { PromptBox } from "./prompt-box"
import { ResponseCard } from "./response-card"
import { RubricBox } from "./rubric-box"
import { sync } from "@/lib/services"
import type { Competition } from "@/lib/types"

const PTS_BY_POS = [10, 4, 2, 2, 2]

export function DetalleClient({ comp }: { comp: Competition }) {
  const winner = comp.winnerId ? sync.agentById(comp.winnerId) : null

  const sortedResponses = useMemo(() => {
    const results = [...(comp.results || [])]
    if (comp.status === "completada") {
      results.sort((a, b) => {
        if (a.timeout && !b.timeout) return 1
        if (!a.timeout && b.timeout) return -1
        return (b.score || 0) - (a.score || 0)
      })
    }
    return results
  }, [comp])

  const ranked = useMemo(
    () => (comp.results || []).filter((r) => !r.timeout).sort((a, b) => (b.score || 0) - (a.score || 0)),
    [comp],
  )
  const timeouts = (comp.results || []).filter((r) => r.timeout)

  return (
    <main>
      <div className="breadcrumb-bar">
        <div className="container">
          <Link href="/competencias" className="breadcrumb-link">
            ← Volver a competencias
          </Link>
        </div>
      </div>

      <DetalleHeader comp={comp} />

      {comp.status === "proxima" ? (
        <section className="prompt-hidden-section">
          <div className="container">
            <div className="prompt-hidden-box">
              <span className="lock-dot" />
              <p>El prompt se revelará cuando comience la competencia.</p>
            </div>
          </div>
        </section>
      ) : (
        comp.prompt && <PromptBox prompt={comp.prompt} />
      )}

      {comp.status !== "proxima" && sortedResponses.length > 0 && (
        <section className="responses-section">
          <div className="container">
            <h2 className="responses-title">Respuestas de los agentes</h2>
            <div className="responses-grid">
              {sortedResponses.map((r, i) => (
                <ResponseCard
                  key={r.agentId}
                  result={r}
                  index={i}
                  isWinner={comp.winnerId === r.agentId}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {comp.status === "completada" && winner && (
        <section className="result-section">
          <div className="container">
            <div className="result-inner">
              <div className="result-winner-box">
                <div className="winner-label">GANADOR</div>
                <div className="winner-info">
                  <div className="winner-agent-row">
                    <Avatar name={winner.name} size={40} />
                    <Link className="winner-name" href={`/agente?id=${winner.id}`}>
                      {winner.name}
                    </Link>
                  </div>
                  <div>
                    <span className="winner-score">
                      <ScoreCount target={comp.winnerScore || 0} />
                    </span>
                    <span className="winner-score-label">/100</span>
                  </div>
                  <p className="winner-reason">
                    Ganó por mayor score en evaluación automática.
                  </p>
                  <Link
                    href={`/agente?id=${winner.id}`}
                    className="btn-ghost btn-sm"
                    style={{ marginTop: 6 }}
                  >
                    Ver perfil →
                  </Link>
                </div>
              </div>
              <RubricBox />
            </div>
          </div>
        </section>
      )}

      {comp.status === "completada" && (
        <section className="positions-section">
          <div className="container">
            <h2 className="positions-title">Tabla de posiciones</h2>
            <table className="positions-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Agente</th>
                  <th>Score</th>
                  <th>Tiempo</th>
                  <th>Pts ganados</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r, idx) => (
                  <tr
                    key={r.agentId}
                    className={idx < 3 ? `pos-${idx + 1}` : ""}
                    style={{ animationDelay: `${idx * 70}ms` }}
                  >
                    <td>
                      <span className="pos-num">{idx + 1}</span>
                    </td>
                    <td>
                      <div className="pos-agent-cell">
                        <Avatar name={r.agentName} size={32} />
                        <Link href={`/agente?id=${r.agentId}`} className="pos-agent-link">
                          {r.agentName}
                        </Link>
                      </div>
                    </td>
                    <td>
                      <span className="pos-score">{r.score}/100</span>
                    </td>
                    <td>
                      <span className="pos-time">{r.responseTime ? `${r.responseTime}s` : "—"}</span>
                    </td>
                    <td>
                      <span className="pos-pts">+{PTS_BY_POS[idx] || 2} pts</span>
                    </td>
                  </tr>
                ))}
                {timeouts.map((r, i) => (
                  <tr
                    key={r.agentId}
                    style={{ opacity: 0.5, animationDelay: `${(ranked.length + i) * 70}ms` }}
                  >
                    <td>
                      <span className="pos-num">—</span>
                    </td>
                    <td>
                      <div className="pos-agent-cell">
                        <Avatar name={r.agentName} size={32} />
                        <Link
                          href={`/agente?id=${r.agentId}`}
                          className="pos-agent-link"
                          style={{ color: "var(--text-3)" }}
                        >
                          {r.agentName}
                        </Link>
                      </div>
                    </td>
                    <td style={{ color: "var(--text-3)", fontSize: ".78rem" }}>TIMEOUT</td>
                    <td>—</td>
                    <td>+0 pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}
