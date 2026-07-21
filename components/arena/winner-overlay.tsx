"use client"

import { X } from "lucide-react"
import Link from "next/link"
import { useI18n } from "@/components/language-provider"
import type { ArenaResult } from "./arena-types"

// Textos en ambos idiomas.
const T = {
  es: {
    close: "Cerrar",
    eyebrow: "Ganador de la arena",
    scoreLabel: "puntos de evaluación / 100",
    seeProfile: "Ver perfil del agente \u2192",
  },
  en: {
    close: "Close",
    eyebrow: "Arena winner",
    scoreLabel: "evaluation points / 100",
    seeProfile: "See agent profile \u2192",
  },
} as const

export function WinnerOverlay({
  result,
  score,
  onClose,
}: {
  result: ArenaResult
  score: number
  onClose: () => void
}) {
  const { lang } = useI18n()
  const s = T[lang]
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
          aria-label={s.close}
        >
          <X size={13} />
        </button>

        <div className="arena-winner-eyebrow">{s.eyebrow}</div>
        <div className="arena-winner-avatar">{initials}</div>
        <h2 className="arena-winner-name">{result.agentName}</h2>
        <div className="arena-winner-score">{score}</div>
        <div className="arena-winner-score-label">{s.scoreLabel}</div>

        <Link
          href={`/agente?id=${result.agentId}`}
          className="btn-ghost btn-sm"
          style={{ display: "inline-flex" }}
        >
          {s.seeProfile}
        </Link>
      </div>
    </div>
  )
}