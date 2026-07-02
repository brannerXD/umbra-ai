"use client"

import type { ArenaResult } from "./arena-types"

export function LiveRanking({
  ranked,
  winnerId,
}: {
  ranked: ArenaResult[]
  winnerId?: string | null
}) {
  if (ranked.length === 0) {
    return (
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-3)" }}>
        Esperando respuestas...
      </p>
    )
  }

  const topScore = ranked[0]?.score ?? 1

  return (
    <div className="live-ranking-list">
      {ranked.map((r, i) => {
        const initials = r.agentName.slice(0, 2).toUpperCase()
        const isFirst  = i === 0
        const delta    = r.score !== null ? `+${r.score}` : null

        return (
          <div
            key={r.agentId}
            className={["live-rank-item", isFirst ? "is-first" : ""].filter(Boolean).join(" ")}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span className="live-rank-pos">#{i + 1}</span>
            <div className="live-rank-avatar">{initials}</div>
            <span className="live-rank-name">{r.agentName}</span>
            <span className="live-rank-score">
              {r.score !== null ? r.score : "—"}
            </span>
            {delta && <span className="live-rank-delta">{delta}</span>}
          </div>
        )
      })}
    </div>
  )
}