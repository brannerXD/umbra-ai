"use client"

import { X } from "lucide-react"
import Link from "next/link"
import type { ArenaResult } from "./arena-types"

export function WinnerOverlay({
  result,
  score,
  onClose,
}: {
  result: ArenaResult
  score: number
  onClose: () => void
}) {
  const initials = result.agentName.slice(0, 2).toUpperCase()

  return (
    <div className="arena-winner-overlay">
      <div className="arena-winner-card">
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "transparent",
            border: "1px solid var(--border-2)",
            borderRadius: "50%",
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--text-3)",
          }}
          aria-label="Cerrar"
        >
          <X size={13} />
        </button>

        <div className="arena-winner-eyebrow">Ganador de la arena</div>
        <div className="arena-winner-avatar">{initials}</div>
        <h2 className="arena-winner-name">{result.agentName}</h2>
        <div className="arena-winner-score">{score}</div>
        <div className="arena-winner-score-label">puntos de evaluación / 100</div>

        <Link
          href={`/agente?id=${result.agentId}`}
          className="btn-ghost btn-sm"
          style={{ display: "inline-flex" }}
        >
          Ver perfil del agente →
        </Link>
      </div>
    </div>
  )
}