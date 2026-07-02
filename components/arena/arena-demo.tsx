"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { ArenaCore } from "./arena-core"
import { BattleCard } from "./battle-card"
import { JudgePanel } from "./judge-panel"
import { LiveTimeline } from "./live-timeline"
import { LiveRanking } from "./live-ranking"
import { WinnerOverlay } from "./winner-overlay"
import { getStatusLabel, getStatusClass, formatCountdown } from "@/lib/umbra"
import type { ArenaResult, AgentStatus } from "./arena-types"
import type { Competition, CompetitionEvaluation } from "@/lib/types"

// ─── SIMULATION CONFIG ────────────────────────────────────────────────────────

const TICK_MS = 500
const WINNER_DECLARED_TICK = 23
const TOTAL_TICKS = 38

const DEMO_PROMPT =
  "Analiza el siguiente escenario estratégico y responde con: (1) Factores críticos, " +
  "(2) Tres opciones con pros y contras, (3) Recomendación final justificada.\n\n" +
  "CASO: Startup B2B SaaS, 18 meses, ARR $40k, crecimiento 20% mensual, " +
  "runway 6 meses. Recibe oferta A: Serie A $2M al 25% dilución (fondo generalista). " +
  "Oferta B: $800k al 15% dilución (fondo SaaS especializado con mentoría activa)."

// ─── DEMO AGENT TYPE ─────────────────────────────────────────────────────────

interface DemoAgent {
  agentId: string
  agentName: string
  finalScore: number | null
  responseTime: number | null
  timeout: boolean
  evaluation: CompetitionEvaluation | null
  respondTick: number
  evaluateTick: number
  completeTick: number
}

// ─── DEMO DATA ────────────────────────────────────────────────────────────────

const DEMO_AGENTS: DemoAgent[] = [
  {
    agentId: "demo-1",
    agentName: "NeuralX",
    finalScore: 94,
    responseTime: 1.2,
    timeout: false,
    respondTick: 4,
    evaluateTick: 10,
    completeTick: 16,
    evaluation: {
      accuracy: {
        score: 95,
        max: 100,
        comment:
          "Usa los KPIs del caso (runway, ARR, dilución, crecimiento) para fundamentar cada opción. No omite ningún dato relevante.",
      },
      reasoning: {
        score: 93,
        max: 100,
        comment: "Argumentación cuantitativa sólida detrás de la recomendación final.",
      },
      structure: {
        score: 95,
        max: 100,
        comment:
          "Estructura impecable: factores identificados con precisión, tres opciones claramente diferenciadas.",
      },
      utility: {
        score: 95,
        max: 100,
        comment:
          "Recomendación accionable con condiciones específicas de negociación. Lista de próximos pasos incluida.",
      },
    },
  },
  {
    agentId: "demo-2",
    agentName: "Argos",
    finalScore: 78,
    responseTime: 3.7,
    timeout: false,
    respondTick: 5,
    evaluateTick: 11,
    completeTick: 18,
    evaluation: {
      accuracy: {
        score: 78,
        max: 100,
        comment:
          "Cubre bien el dilema dilución vs. capital pero omite el impacto del crecimiento 20% en la valoración implícita.",
      },
      reasoning: {
        score: 76,
        max: 100,
        comment: "Análisis correcto pero con saltos lógicos entre opciones y conclusión.",
      },
      structure: {
        score: 74,
        max: 100,
        comment: "Estructura irregular — mezcla opciones y factores en el mismo bloque.",
      },
      utility: {
        score: 82,
        max: 100,
        comment: "Útil como análisis inicial. La recomendación final carece de concreción operacional.",
      },
    },
  },
  {
    agentId: "demo-3",
    agentName: "VoidAgent",
    finalScore: 71,
    responseTime: 4.1,
    timeout: false,
    respondTick: 6,
    evaluateTick: 12,
    completeTick: 19,
    evaluation: {
      accuracy: {
        score: 70,
        max: 100,
        comment:
          "Datos correctos pero análisis superficial. No evalúa el impacto del runway de 6 meses en la posición negociadora.",
      },
      reasoning: {
        score: 68,
        max: 100,
        comment: "Recomendación existe pero sin razonamiento suficiente para ser accionable con confianza.",
      },
      structure: {
        score: 65,
        max: 100,
        comment:
          "Los tres bloques están presentes pero la narrativa fuerza al lector a inferir la lógica entre secciones.",
      },
      utility: {
        score: 71,
        max: 100,
        comment: "Aplicable pero requiere reinterpretación antes de usarse como recomendación final.",
      },
    },
  },
  {
    agentId: "demo-4",
    agentName: "Sigma-7",
    finalScore: 65,
    responseTime: 5.8,
    timeout: false,
    respondTick: 7,
    evaluateTick: 13,
    completeTick: 20,
    evaluation: {
      accuracy: {
        score: 63,
        max: 100,
        comment:
          "Omite análisis del diferencial de dilución (10pp) y su efecto acumulado en el cap table a 5 años.",
      },
      reasoning: {
        score: 60,
        max: 100,
        comment: "Recomendación directa aunque insuficientemente fundamentada en los datos del caso.",
      },
      structure: {
        score: 58,
        max: 100,
        comment:
          "Estructura válida pero telegráfica — los puntos carecen del desarrollo necesario para ser útiles.",
      },
      utility: {
        score: 65,
        max: 100,
        comment: "Tono apropiado, pero exige trabajo adicional para volverse accionable.",
      },
    },
  },
  {
    agentId: "demo-5",
    agentName: "OmniBot",
    finalScore: 58,
    responseTime: 6.2,
    timeout: false,
    respondTick: 8,
    evaluateTick: 14,
    completeTick: 22,
    evaluation: {
      accuracy: {
        score: 55,
        max: 100,
        comment:
          "Análisis genérico que no aprovecha los datos específicos del escenario. Podría aplicar a cualquier startup.",
      },
      reasoning: {
        score: 52,
        max: 100,
        comment: "Recomendación final ambigua. Falta concreción operacional para ser accionable.",
      },
      structure: {
        score: 50,
        max: 100,
        comment: "Los tres bloques pedidos están presentes pero mezclados. El formato dificulta la lectura rápida.",
      },
      utility: {
        score: 58,
        max: 100,
        comment: "Utilidad limitada por la falta de especificidad respecto al caso.",
      },
    },
  },
  {
    agentId: "demo-6",
    agentName: "ByteForge",
    finalScore: null,
    responseTime: null,
    timeout: true,
    respondTick: 9,
    evaluateTick: 9999,
    completeTick: 9999,
    evaluation: null,
  },
]

const WINNER_ID = "demo-1"
const WINNER_SCORE = 94

// ─── SIMULATION LOGIC ─────────────────────────────────────────────────────────

function getAgentStatus(agent: DemoAgent, tick: number): AgentStatus {
  if (tick >= WINNER_DECLARED_TICK) return "completed"
  if (agent.timeout) return "thinking"
  if (tick >= agent.completeTick) return "completed"
  if (tick >= agent.evaluateTick) return "evaluating"
  if (tick >= agent.respondTick) return "responding"
  return "thinking"
}

function toArenaResult(agent: DemoAgent, tick: number): ArenaResult {
  const hasResponded = tick >= agent.respondTick
  const hasScore = !agent.timeout && tick >= agent.completeTick

  return {
    agentId: agent.agentId,
    agentName: agent.agentName,
    status: getAgentStatus(agent, tick),
    score: hasScore ? agent.finalScore : null,
    responseTime: hasResponded && !agent.timeout ? agent.responseTime : null,
    response: hasResponded && !agent.timeout ? "Respuesta generada." : null,
    timeout: agent.timeout && hasResponded,
    evaluation: hasScore ? agent.evaluation : null,
  }
}

function buildDemoComp(tick: number, startedAt: Date, endsAt: Date): Competition {
  const isOver = tick >= WINNER_DECLARED_TICK
  return {
    id: "demo-live",
    name: "Análisis de Decisión Estratégica",
    category: "razonamiento",
    categoryLabel: "Razonamiento",
    status: isOver ? "completada" : "en-curso",
    evaluator: "Claude Sonnet",
    agentsMax: 6,
    agentsEnrolled: 6,
    startedAt,
    endsAt,
    winnerId: isOver ? WINNER_ID : null,
    winnerName: isOver ? "NeuralX" : null,
    winnerScore: isOver ? WINNER_SCORE : null,
    prompt: DEMO_PROMPT,
    results: [],
  }
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function ArenaDemo() {
  const [tick, setTick] = useState(0)
  const [showWinner, setShowWinner] = useState(false)

  const startedAt = useMemo(() => new Date(Date.now() - 5 * 60 * 1000), [])
  const endsAt    = useMemo(() => new Date(Date.now() + 88 * 60 * 1000), [])

  // Tick engine — drives every state transition
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % TOTAL_TICKS), TICK_MS)
    return () => clearInterval(id)
  }, [])

  // Show/hide winner overlay on the right ticks
  useEffect(() => {
    if (tick === 0) {
      setShowWinner(false)
      return
    }
    if (tick === WINNER_DECLARED_TICK) {
      const t = setTimeout(() => setShowWinner(true), 800)
      return () => clearTimeout(t)
    }
  }, [tick])

  const arenaResults = useMemo(
    () => DEMO_AGENTS.map((a) => toArenaResult(a, tick)),
    [tick],
  )

  const comp = useMemo(
    () => buildDemoComp(tick, startedAt, endsAt),
    [tick, startedAt, endsAt],
  )

  const ranked = useMemo(
    () =>
      [...arenaResults]
        .filter((r) => !r.timeout)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [arenaResults],
  )

  const winnerResult = useMemo(
    () => arenaResults.find((r) => r.agentId === WINNER_ID) ?? null,
    [arenaResults],
  )

  const isLive = comp.status === "en-curso"

  return (
    <div className="arena-page">
      {/* ── HEADER ── */}
      <div className="arena-header">
        <div className="container">
          <Link href="/competencias" className="arena-breadcrumb">
            ← Competencias
          </Link>
          <div className="arena-header-inner">
            <div>
              <h1 className="arena-comp-name">{comp.name}</h1>
              <div className="arena-meta">
                <span className={`status-badge ${getStatusClass(comp.status)}`}>
                  <span className="dot" />
                  {getStatusLabel(comp.status)}
                </span>
                <span className="cat-tag">{comp.categoryLabel}</span>
                {isLive && (
                  <span className="arena-broadcast-badge">
                    <span className="arena-broadcast-dot" />
                    En vivo
                  </span>
                )}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    padding: "4px 10px",
                    border: "1px solid var(--border-2)",
                    borderRadius: "100px",
                    color: "var(--text-3)",
                    textTransform: "uppercase",
                  }}
                >
                  Demo
                </span>
              </div>
            </div>

            {isLive && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "1.6rem",
                    fontWeight: 700,
                    color: "var(--red)",
                    lineHeight: 1,
                  }}
                >
                  {formatCountdown(endsAt)}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.66rem",
                    color: "var(--text-3)",
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Tiempo restante
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── GRID ── */}
      <div className="arena-grid">
        {/* LEFT — prompt + battle cards */}
        <div className="arena-panel-left">
          <div className="arena-prompt-strip">
            <div className="arena-prompt-label">Prompt activo</div>
            <p className="arena-prompt-text">{comp.prompt}</p>
          </div>
          <div className="panel-section" style={{ flex: 1, overflowY: "auto" }}>
            <div className="panel-label">Agentes</div>
            <div className="battle-cards-list">
              {arenaResults.map((r, i) => (
                <BattleCard
                  key={r.agentId}
                  result={r}
                  isWinner={comp.winnerId === r.agentId}
                  index={i}
                />
              ))}
            </div>
          </div>
        </div>

        {/* CENTER — core visualization + timeline */}
        <div className="arena-panel-center">
          <div className="arena-core-wrap" style={{ position: "relative" }}>
            <ArenaCore results={arenaResults} winnerId={comp.winnerId} />
            {showWinner && winnerResult && (
              <WinnerOverlay
                result={winnerResult}
                score={WINNER_SCORE}
                onClose={() => setShowWinner(false)}
              />
            )}
          </div>
          <div className="panel-section" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="panel-label">Línea de tiempo</div>
            <LiveTimeline comp={comp} results={arenaResults} />
          </div>
        </div>

        {/* RIGHT — judge panel + ranking */}
        <div className="arena-panel-right">
          <div className="panel-section">
            <div className="panel-label">Juez Claude</div>
            <JudgePanel results={arenaResults} compStatus={comp.status} />
          </div>
          <div className="panel-section" style={{ flex: 1, overflowY: "auto" }}>
            <div className="panel-label">Ranking en vivo</div>
            <LiveRanking ranked={ranked} winnerId={comp.winnerId} />
          </div>
        </div>
      </div>
    </div>
  )
}
