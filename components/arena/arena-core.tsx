"use client"

import { useMemo } from "react"
import type { ArenaResult } from "./arena-types"

const TICK_COUNT = 36

function AgentNode({
  result,
  index,
  total,
  winnerId,
}: {
  result: ArenaResult
  index: number
  total: number
  winnerId?: string | null
}) {
  const angle = (index / total) * 360
  const rad = (angle * Math.PI) / 180
  const radius = 168
  const x = Math.round(radius * Math.sin(rad))
  const y = Math.round(-radius * Math.cos(rad))
  const initials = result.agentName.slice(0, 2).toUpperCase()
  const isWinner = winnerId === result.agentId

  return (
    <div
      className="arena-agent-node"
      style={{ transform: `translate(calc(${x}px - 50%), calc(${y}px - 50%))` }}
    >
      <div
        className={[
          "arena-agent-chip",
          `status-${result.status}`,
          isWinner ? "is-winner" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ animationDuration: `${3 + index * 0.4}s` }}
      >
        <div className="arena-chip-avatar">{initials}</div>
        <span className="arena-chip-name">{result.agentName}</span>
        {result.score !== null && (
          <span className="arena-chip-score">{result.score}</span>
        )}
      </div>
    </div>
  )
}

export function ArenaCore({
  results,
  winnerId,
}: {
  results: ArenaResult[]
  winnerId?: string | null
}) {
  const ticks = useMemo(() => Array.from({ length: TICK_COUNT }), [])

  const particles = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        left: `${10 + Math.random() * 80}%`,
        top: `${10 + Math.random() * 80}%`,
        delay: `${(i * 0.37).toFixed(2)}s`,
        duration: `${2.5 + Math.random() * 3}s`,
        dx: `${(Math.random() - 0.5) * 60}px`,
        dy: `${(Math.random() - 0.5) * 60}px`,
      })),
    []
  )

  const beamLines = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => ({
        id: i,
        left: `${12 + i * 14}%`,
        height: `${40 + Math.random() * 40}%`,
        delay: `${(i * 0.6).toFixed(2)}s`,
        duration: `${2.2 + i * 0.4}s`,
      })),
    []
  )

  return (
    <div className="arena-core">
      {/* Rotating rings */}
      <div className="arena-ring arena-ring-1" />
      <div className="arena-ring arena-ring-2" />
      <div className="arena-ring arena-ring-3" />

      {/* Tick marks */}
      <div className="arena-ring-ticks">
        {ticks.map((_, i) => (
          <div
            key={i}
            className="arena-ring-tick"
            style={{ transform: `rotate(${(i / TICK_COUNT) * 360}deg) translateX(-50%)` }}
          />
        ))}
      </div>

      {/* Beam sweep */}
      <div className="arena-core-beam" />

      {/* Data beam lines */}
      <div className="arena-beam-lines">
        {beamLines.map((b) => (
          <div
            key={b.id}
            className="arena-beam-line"
            style={{
              left: b.left,
              height: b.height,
              top: "50%",
              animationDelay: b.delay,
              animationDuration: b.duration,
            }}
          />
        ))}
      </div>

      {/* Particles */}
      <div className="arena-particles">
        {particles.map((p) => (
          <div
            key={p.id}
            className="arena-particle"
            style={{
              left: p.left,
              top: p.top,
              animationDelay: p.delay,
              animationDuration: p.duration,
              ["--dx" as string]: p.dx,
              ["--dy" as string]: p.dy,
            }}
          />
        ))}
      </div>

      {/* Energy core */}
      <div className="arena-energy-core">
        <div className="arena-energy-pulse arena-energy-pulse-3" />
        <div className="arena-energy-pulse arena-energy-pulse-2" />
        <div className="arena-energy-pulse" />
        <div className="arena-energy-inner">
          <div className="arena-energy-logo" />
        </div>
      </div>

      {/* Agent nodes */}
      {results.map((r, i) => (
        <AgentNode
          key={r.agentId}
          result={r}
          index={i}
          total={results.length}
          winnerId={winnerId}
        />
      ))}
    </div>
  )
}