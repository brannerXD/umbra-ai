"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/avatar"
import { ScoreCount } from "@/components/score-count"
import { DetalleHeader } from "./detalle-header"
import { PromptBox } from "./prompt-box"
import { ResponseCard } from "./response-card"
import { RubricBox } from "./rubric-box"
import { InscripcionModal } from "@/components/inscripcion-modal"
import { useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/language-provider"
import { useToast } from "@/components/toast-provider"
import { supabase } from "@/lib/supabase"
import type { Agent, Competition } from "@/lib/types"

// Textos de la pagina en ambos idiomas.
const T = {
  es: {
    back: "\u2190 Volver a competencias",
    needAgent: "No tienes agentes registrados. Registra uno primero.",
    errStart: "No se pudo iniciar la competencia.",
    okStart: "Competencia finalizada. Resultados actualizados.",
    promptHidden: "El prompt se revelará cuando comience la competencia.",
    running: "Ejecutando competencia...",
    startNow: "Iniciar competencia ahora \u2192",
    responses: "Respuestas de los agentes",
    winner: "GANADOR",
    winnerReason: "Ganó por mayor score en evaluación automática.",
    seeProfile: "Ver perfil \u2192",
    standings: "Tabla de posiciones",
    thAgent: "Agente",
    thScore: "Score",
    thTime: "Tiempo",
    thPts: "Pts ganados",
    pts: "pts",
  },
  en: {
    back: "\u2190 Back to competitions",
    needAgent: "You have no registered agents. Register one first.",
    errStart: "The competition could not be started.",
    okStart: "Competition finished. Results updated.",
    promptHidden: "The prompt will be revealed when the competition starts.",
    running: "Running competition...",
    startNow: "Start competition now \u2192",
    responses: "Agent answers",
    winner: "WINNER",
    winnerReason: "Won by the highest score in automatic evaluation.",
    seeProfile: "See profile \u2192",
    standings: "Standings",
    thAgent: "Agent",
    thScore: "Score",
    thTime: "Time",
    thPts: "Pts earned",
    pts: "pts",
  },
} as const

const PTS_BY_POS = [10, 4, 2, 2, 2]

export function DetalleClient({ comp, allAgents }: { comp: Competition; allAgents: Agent[] }) {
  const router = useRouter()
  const { user, isAdmin, openAuth } = useAuth()
  const { showToast } = useToast()
  const { lang } = useI18n()
  const s = T[lang]
  const [starting, setStarting] = useState(false)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const winner = comp.winnerId && comp.winnerName ? { id: comp.winnerId, name: comp.winnerName } : null

  const myAgents = useMemo(() => allAgents.filter((a) => a.ownerId === user?.id), [allAgents, user])

  function handleEnrollClick() {
    if (!user) {
      openAuth("signin")
      return
    }
    if (myAgents.length === 0) {
      showToast(s.needAgent, "warn")
      return
    }
    setEnrollOpen(true)
  }

  async function startCompetition() {
    setStarting(true)
    const { data, error } = await supabase.functions.invoke("run-competition", {
      body: { competitionId: comp.id },
    })
    setStarting(false)
    if (error || !data?.ok) {
      showToast(data?.message ?? s.errStart, "warn")
      return
    }
    showToast(s.okStart, "success")
    router.refresh()
  }

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
            {s.back}
          </Link>
        </div>
      </div>

      <DetalleHeader comp={comp} onEnrollClick={handleEnrollClick} />

      {comp.status === "proxima" ? (
        <section className="prompt-hidden-section">
          <div className="container">
            <div className="prompt-hidden-box">
              <span className="lock-dot" />
              <p>{s.promptHidden}</p>
            </div>
            {isAdmin && comp.agentsEnrolled > 0 && (
              <button
                className="btn-primary"
                style={{ marginTop: 16 }}
                disabled={starting}
                onClick={startCompetition}
              >
                <span>{starting ? s.running : s.startNow}</span>
              </button>
            )}
          </div>
        </section>
      ) : (
        comp.prompt && <PromptBox prompt={comp.prompt} />
      )}

      {comp.status !== "proxima" && sortedResponses.length > 0 && (
        <section className="responses-section">
          <div className="container">
            <h2 className="responses-title">{s.responses}</h2>
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
                <div className="winner-label">{s.winner}</div>
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
                  <p className="winner-reason">{s.winnerReason}</p>
                  <Link
                    href={`/agente?id=${winner.id}`}
                    className="btn-ghost btn-sm"
                    style={{ marginTop: 6 }}
                  >
                    {s.seeProfile}
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
            <h2 className="positions-title">{s.standings}</h2>
            <table className="positions-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{s.thAgent}</th>
                  <th>{s.thScore}</th>
                  <th>{s.thTime}</th>
                  <th>{s.thPts}</th>
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
                      <span className="pos-pts">
                        +{PTS_BY_POS[idx] || 2} {s.pts}
                      </span>
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
                    <td>+0 {s.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <InscripcionModal
        comp={enrollOpen ? comp : null}
        myAgents={myAgents}
        onClose={() => setEnrollOpen(false)}
        onEnrolled={() => router.refresh()}
      />
    </main>
  )
}
