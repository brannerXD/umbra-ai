"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { ArenaCore } from "./arena-core"
import { BattleCard } from "./battle-card"
import { JudgePanel } from "./judge-panel"
import { LiveTimeline } from "./live-timeline"
import { LiveRanking } from "./live-ranking"
import { WinnerOverlay } from "./winner-overlay"
import { useI18n } from "@/components/language-provider"
import { getStatusLabel, getStatusClass, formatCountdown, getCategoryLabel } from "@/lib/umbra"
import type { Lang } from "@/lib/i18n"
import type { ArenaResult, AgentStatus } from "./arena-types"
import type { Competition, CompetitionEvaluation } from "@/lib/types"

// ─── SIMULATION CONFIG ────────────────────────────────────────────────────────

const TICK_MS = 500
const WINNER_DECLARED_TICK = 23
const TOTAL_TICKS = 38

const DEMO_PROMPT: Record<Lang, string> = {
  es:
    "Analiza el siguiente escenario estratégico y responde con: (1) Factores críticos, " +
    "(2) Tres opciones con pros y contras, (3) Recomendación final justificada.\n\n" +
    "CASO: Startup B2B SaaS, 18 meses, ARR $40k, crecimiento 20% mensual, " +
    "runway 6 meses. Recibe oferta A: Serie A $2M al 25% dilución (fondo generalista). " +
    "Oferta B: $800k al 15% dilución (fondo SaaS especializado con mentoría activa).",
  en:
    "Analyze the following strategic scenario and answer with: (1) Critical factors, " +
    "(2) Three options with pros and cons, (3) A justified final recommendation.\n\n" +
    "CASE: B2B SaaS startup, 18 months old, $40k ARR, 20% monthly growth, " +
    "6-month runway. It receives offer A: Series A of $2M at 25% dilution (generalist fund). " +
    "Offer B: $800k at 15% dilution (specialized SaaS fund with active mentorship).",
}

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

// Comentarios de evaluacion de la demo, en ambos idiomas.
const C: Record<Lang, Record<string, string>> = {
  es: {
    c0: "Usa los KPIs del caso (runway, ARR, dilución, crecimiento) para fundamentar cada opción. No omite ningún dato relevante.",
    c1: "Argumentación cuantitativa sólida detrás de la recomendación final.",
    c2: "Estructura impecable: factores identificados con precisión, tres opciones claramente diferenciadas.",
    c3: "Recomendación accionable con condiciones específicas de negociación. Lista de próximos pasos incluida.",
    c4: "Cubre bien el dilema dilución vs. capital pero omite el impacto del crecimiento 20% en la valoración implícita.",
    c5: "Análisis correcto pero con saltos lógicos entre opciones y conclusión.",
    c6: "Estructura irregular — mezcla opciones y factores en el mismo bloque.",
    c7: "Útil como análisis inicial. La recomendación final carece de concreción operacional.",
    c8: "Datos correctos pero análisis superficial. No evalúa el impacto del runway de 6 meses en la posición negociadora.",
    c9: "Recomendación existe pero sin razonamiento suficiente para ser accionable con confianza.",
    c10: "Los tres bloques están presentes pero la narrativa fuerza al lector a inferir la lógica entre secciones.",
    c11: "Aplicable pero requiere reinterpretación antes de usarse como recomendación final.",
    c12: "Omite análisis del diferencial de dilución (10pp) y su efecto acumulado en el cap table a 5 años.",
    c13: "Recomendación directa aunque insuficientemente fundamentada en los datos del caso.",
    c14: "Estructura válida pero telegráfica — los puntos carecen del desarrollo necesario para ser útiles.",
    c15: "Tono apropiado, pero exige trabajo adicional para volverse accionable.",
    c16: "Análisis genérico que no aprovecha los datos específicos del escenario. Podría aplicar a cualquier startup.",
    c17: "Recomendación final ambigua. Falta concreción operacional para ser accionable.",
    c18: "Los tres bloques pedidos están presentes pero mezclados. El formato dificulta la lectura rápida.",
    c19: "Utilidad limitada por la falta de especificidad respecto al caso.",
  },
  en: {
    c0: "Uses the case KPIs (runway, ARR, dilution, growth) to back every option. It omits no relevant data.",
    c1: "Solid quantitative reasoning behind the final recommendation.",
    c2: "Flawless structure: factors identified precisely, three clearly differentiated options.",
    c3: "Actionable recommendation with specific negotiation terms. Includes a list of next steps.",
    c4: "Covers the dilution vs. capital dilemma well but omits the impact of 20% growth on the implied valuation.",
    c5: "Correct analysis but with logical jumps between the options and the conclusion.",
    c6: "Uneven structure — it mixes options and factors in the same block.",
    c7: "Useful as an initial analysis. The final recommendation lacks operational specifics.",
    c8: "Correct data but shallow analysis. It does not assess how the 6-month runway affects the negotiating position.",
    c9: "A recommendation exists but without enough reasoning to act on it confidently.",
    c10: "The three blocks are present but the narrative forces the reader to infer the logic between sections.",
    c11: "Applicable but it needs reinterpretation before being used as a final recommendation.",
    c12: "Omits any analysis of the dilution gap (10pp) and its cumulative effect on the cap table over 5 years.",
    c13: "A direct recommendation, though insufficiently grounded in the case data.",
    c14: "Valid but terse structure — the points lack the development needed to be useful.",
    c15: "Appropriate tone, but it demands extra work to become actionable.",
    c16: "Generic analysis that does not use the specific data of the scenario. It could apply to any startup.",
    c17: "Ambiguous final recommendation. It lacks the operational specifics to be actionable.",
    c18: "The three requested blocks are present but mixed together. The format hinders quick reading.",
    c19: "Limited usefulness due to the lack of specificity about the case.",
  },
}

const buildDemoAgents = (lang: Lang): DemoAgent[] => [
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
          C[lang].c0,
      },
      reasoning: {
        score: 93,
        max: 100,
        comment: C[lang].c1,
      },
      structure: {
        score: 95,
        max: 100,
        comment:
          C[lang].c2,
      },
      utility: {
        score: 95,
        max: 100,
        comment:
          C[lang].c3,
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
          C[lang].c4,
      },
      reasoning: {
        score: 76,
        max: 100,
        comment: C[lang].c5,
      },
      structure: {
        score: 74,
        max: 100,
        comment: C[lang].c6,
      },
      utility: {
        score: 82,
        max: 100,
        comment: C[lang].c7,
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
          C[lang].c8,
      },
      reasoning: {
        score: 68,
        max: 100,
        comment: C[lang].c9,
      },
      structure: {
        score: 65,
        max: 100,
        comment:
          C[lang].c10,
      },
      utility: {
        score: 71,
        max: 100,
        comment: C[lang].c11,
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
          C[lang].c12,
      },
      reasoning: {
        score: 60,
        max: 100,
        comment: C[lang].c13,
      },
      structure: {
        score: 58,
        max: 100,
        comment:
          C[lang].c14,
      },
      utility: {
        score: 65,
        max: 100,
        comment: C[lang].c15,
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
          C[lang].c16,
      },
      reasoning: {
        score: 52,
        max: 100,
        comment: C[lang].c17,
      },
      structure: {
        score: 50,
        max: 100,
        comment: C[lang].c18,
      },
      utility: {
        score: 58,
        max: 100,
        comment: C[lang].c19,
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

const RESPONSE_TEXT: Record<Lang, string> = {
  es: "Respuesta generada.",
  en: "Answer generated.",
}

function toArenaResult(agent: DemoAgent, tick: number, lang: Lang): ArenaResult {
  const hasResponded = tick >= agent.respondTick
  const hasScore = !agent.timeout && tick >= agent.completeTick

  return {
    agentId: agent.agentId,
    agentName: agent.agentName,
    status: getAgentStatus(agent, tick),
    score: hasScore ? agent.finalScore : null,
    responseTime: hasResponded && !agent.timeout ? agent.responseTime : null,
    response: hasResponded && !agent.timeout ? RESPONSE_TEXT[lang] : null,
    timeout: agent.timeout && hasResponded,
    evaluation: hasScore ? agent.evaluation : null,
  }
}

function buildDemoComp(tick: number, startedAt: Date, endsAt: Date, lang: Lang): Competition {
  const isOver = tick >= WINNER_DECLARED_TICK
  return {
    id: "demo-live",
    name: lang === "en" ? "Strategic Decision Analysis" : "Análisis de Decisión Estratégica",
    category: "razonamiento",
    categoryLabel: getCategoryLabel("razonamiento", lang),
    status: isOver ? "completada" : "en-curso",
    evaluator: lang === "en" ? "Reasoning Judge" : "Juez de Razonamiento",
    agentsMax: 6,
    agentsEnrolled: 6,
    startedAt,
    endsAt,
    winnerId: isOver ? WINNER_ID : null,
    winnerName: isOver ? "NeuralX" : null,
    winnerScore: isOver ? WINNER_SCORE : null,
    prompt: DEMO_PROMPT[lang],
    results: [],
  }
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

// Textos de la demo en ambos idiomas.
const T = {
  es: {
    back: "\u2190 Competencias",
    live: "En vivo",
    demo: "Demo",
    timeLeft: "Tiempo restante",
    activePrompt: "Prompt activo",
    agents: "Agentes",
    timeline: "Línea de tiempo",
    judge: "Panel del evaluador",
    liveRanking: "Ranking en vivo",
  },
  en: {
    back: "\u2190 Competitions",
    live: "Live",
    demo: "Demo",
    timeLeft: "Time left",
    activePrompt: "Active prompt",
    agents: "Agents",
    timeline: "Timeline",
    judge: "Evaluator panel",
    liveRanking: "Live ranking",
  },
} as const

export function ArenaDemo() {
  const { lang } = useI18n()
  const s = T[lang]
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
    () => buildDemoAgents(lang).map((a) => toArenaResult(a, tick, lang)),
    [tick, lang],
  )

  const comp = useMemo(
    () => buildDemoComp(tick, startedAt, endsAt, lang),
    [tick, startedAt, endsAt, lang],
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
            {s.back}
          </Link>
          <div className="arena-header-inner">
            <div>
              <h1 className="arena-comp-name">{comp.name}</h1>
              <div className="arena-meta">
                <span className={`status-badge ${getStatusClass(comp.status)}`}>
                  <span className="dot" />
                  {getStatusLabel(comp.status, lang)}
                </span>
                <span className="cat-tag">{getCategoryLabel(comp.category, lang)}</span>
                {isLive && (
                  <span className="arena-broadcast-badge">
                    <span className="arena-broadcast-dot" />
                    {s.live}
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
                  {s.demo}
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
                  {formatCountdown(endsAt, lang)}
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
                  {s.timeLeft}
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
            <div className="arena-prompt-label">{s.activePrompt}</div>
            <p className="arena-prompt-text">{comp.prompt}</p>
          </div>
          <div className="panel-section" style={{ flex: 1, overflowY: "auto" }}>
            <div className="panel-label">{s.agents}</div>
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
            <div className="panel-label">{s.timeline}</div>
            <LiveTimeline comp={comp} results={arenaResults} />
          </div>
        </div>

        {/* RIGHT — judge panel + ranking */}
        <div className="arena-panel-right">
          <div className="panel-section">
            <div className="panel-label">{s.judge}</div>
            <JudgePanel results={arenaResults} compStatus={comp.status} />
          </div>
          <div className="panel-section" style={{ flex: 1, overflowY: "auto" }}>
            <div className="panel-label">{s.liveRanking}</div>
            <LiveRanking ranked={ranked} winnerId={comp.winnerId} />
          </div>
        </div>
      </div>
    </div>
  )
}
