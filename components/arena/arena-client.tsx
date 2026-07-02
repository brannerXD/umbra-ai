"use client"

import Link from "next/link"
import { useMemo, useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArenaCore } from "./arena-core"
import { BattleCard } from "./battle-card"
import { JudgePanel } from "./judge-panel"
import { LiveTimeline } from "./live-timeline"
import { LiveRanking } from "./live-ranking"
import { WinnerOverlay } from "./winner-overlay"
import { getStatusLabel, getStatusClass, formatCountdown } from "@/lib/umbra"
import { useNow } from "@/hooks/use-now"
import type { Competition, CompetitionResult } from "@/lib/types"
import type { ArenaResult } from "./arena-types"

// How long to show "responding" before transitioning to "evaluating"
const RESPONDING_WINDOW_MS = 2500

function deriveStatus(
  result: CompetitionResult,
  compStatus: string,
  isResponding: boolean,
): ArenaResult["status"] {
  if (compStatus === "completada") return "completed"
  if (result.score !== null) return "completed"
  if (isResponding) return "responding"
  if (result.response !== null) return "evaluating"
  if (compStatus === "en-curso") return "thinking"
  return "thinking"
}

export function ArenaClient({ comp }: { comp: Competition }) {
  useNow(comp.status === "en-curso" ? 1000 : null)

  const router = useRouter()
  const [showWinner, setShowWinner] = useState(false)

  // Agents briefly in "responding" state after their response first arrives
  const [transientResponding, setTransientResponding] = useState<Set<string>>(new Set())
  const prevResultsRef = useRef<CompetitionResult[]>([])

  // ── Poll for fresh data while the competition is live ──────────────────────
  useEffect(() => {
    if (comp.status !== "en-curso") return
    const id = setInterval(() => router.refresh(), 4000)
    return () => clearInterval(id)
  }, [comp.status, router])

  // ── Detect response arrivals and briefly show "responding" state ───────────
  useEffect(() => {
    const prev = prevResultsRef.current
    const current = comp.results || []

    // On first mount, just record state — nothing to compare yet
    if (prev.length === 0) {
      prevResultsRef.current = current
      return
    }

    const newResponders: string[] = []
    current.forEach((r) => {
      const p = prev.find((x) => x.agentId === r.agentId)
      if (p && p.response === null && r.response !== null) {
        newResponders.push(r.agentId)
      }
    })

    prevResultsRef.current = current

    if (newResponders.length === 0) return

    setTransientResponding((s) => {
      const next = new Set(s)
      newResponders.forEach((id) => next.add(id))
      return next
    })

    const t = setTimeout(() => {
      setTransientResponding((s) => {
        const next = new Set(s)
        newResponders.forEach((id) => next.delete(id))
        return next
      })
    }, RESPONDING_WINDOW_MS)

    return () => clearTimeout(t)
  }, [comp.results])

  // ── Winner overlay ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (comp.status === "completada" && comp.winnerId) {
      const t = setTimeout(() => setShowWinner(true), 600)
      return () => clearTimeout(t)
    }
  }, [comp.status, comp.winnerId])

  // ── Derived state ──────────────────────────────────────────────────────────
  const arenaResults: ArenaResult[] = useMemo(
    () =>
      (comp.results || []).map((r) => ({
        ...r,
        status: deriveStatus(r, comp.status, transientResponding.has(r.agentId)),
      })),
    [comp, transientResponding],
  )

  const ranked = useMemo(
    () =>
      [...arenaResults]
        .filter((r) => !r.timeout)
        .sort((a, b) => (b.score || 0) - (a.score || 0)),
    [arenaResults],
  )

  const winner = comp.winnerId
    ? arenaResults.find((r) => r.agentId === comp.winnerId) ?? null
    : null

  return (
    <div className="arena-page">
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
                {comp.status === "en-curso" && (
                  <span className="arena-broadcast-badge">
                    <span className="arena-broadcast-dot" />
                    En vivo
                  </span>
                )}
              </div>
            </div>
            {comp.status === "en-curso" && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div suppressHydrationWarning style={{ fontFamily: "var(--font-mono)", fontSize: "1.6rem", fontWeight: 700, color: "var(--red)", lineHeight: 1 }}>
                  {formatCountdown(comp.endsAt)}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.66rem", color: "var(--text-3)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Tiempo restante
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="arena-grid">
        <div className="arena-panel-left">
          {comp.prompt && comp.status !== "proxima" && (
            <div className="arena-prompt-strip">
              <div className="arena-prompt-label">Prompt activo</div>
              <p className="arena-prompt-text">{comp.prompt}</p>
            </div>
          )}
          <div className="panel-section" style={{ flex: 1, overflowY: "auto" }}>
            <div className="panel-label">Agentes</div>
            <div className="battle-cards-list">
              {arenaResults.map((r, i) => (
                <BattleCard key={r.agentId} result={r} isWinner={comp.winnerId === r.agentId} index={i} />
              ))}
            </div>
          </div>
        </div>

        <div className="arena-panel-center">
          <div className="arena-core-wrap" style={{ position: "relative" }}>
            <ArenaCore results={arenaResults} winnerId={comp.winnerId} />
            {showWinner && winner && (
              <WinnerOverlay result={winner} score={comp.winnerScore ?? 0} onClose={() => setShowWinner(false)} />
            )}
          </div>
          <div className="panel-section" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="panel-label">Línea de tiempo</div>
            <LiveTimeline comp={comp} results={arenaResults} />
          </div>
        </div>

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
