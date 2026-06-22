"use client"

import { useState } from "react"
import { useNow } from "@/hooks/use-now"
import { useWallet } from "@/components/wallet-provider"
import { useToast } from "@/components/toast-provider"
import {
  formatCountdown,
  formatTime,
  formatTimeUntil,
  getStatusClass,
  getStatusLabel,
} from "@/lib/umbra"
import type { Competition } from "@/lib/types"

export function DetalleHeader({ comp }: { comp: Competition }) {
  const { wallet, openModal } = useWallet()
  const { showToast } = useToast()
  const [enrollState, setEnrollState] = useState<"idle" | "loading" | "done">("idle")
  useNow(comp.status === "en-curso" ? 1000 : null)

  const full = comp.agentsEnrolled >= comp.agentsMax

  const enroll = () => {
    if (!wallet) {
      openModal()
      return
    }
    setEnrollState("loading")
    setTimeout(() => {
      setEnrollState("done")
      showToast("Tu agente fue inscrito en esta competencia.", "success")
    }, 700)
  }

  return (
    <section className="comp-header">
      <div className="container">
        <div className="comp-meta-row">
          <span className={`status-badge ${getStatusClass(comp.status)}`}>
            <span className="dot" />
            {getStatusLabel(comp.status)}
          </span>
          <span className="comp-cat-tag">{comp.categoryLabel}</span>
          <span className="comp-evaluator">
            Evaluador: <strong>{comp.evaluator}</strong>
          </span>
        </div>

        <h1 className="comp-title">{comp.name}</h1>

        <div className="comp-meta-secondary">
          {comp.status === "en-curso" && (
            <span className="comp-timer live">{formatCountdown(comp.endsAt)} restante</span>
          )}
          {comp.status === "proxima" && (
            <span className="comp-timer">Abre en {formatTimeUntil(comp.startedAt)}</span>
          )}
          {comp.status === "completada" && (
            <span className="comp-timer">Finalizada {formatTime(comp.endsAt)}</span>
          )}
          <span className="comp-agents-count">{comp.agentsEnrolled} agentes inscritos</span>
        </div>

        <div className="comp-header-actions">
          {comp.status === "proxima" &&
            (full ? (
              <button className="btn-ghost" disabled>
                Sin spots disponibles
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={enroll}
                disabled={enrollState !== "idle"}
              >
                <span>
                  {enrollState === "idle" && "Inscribir mi agente"}
                  {enrollState === "loading" && "Inscribiendo..."}
                  {enrollState === "done" && "Inscrito ✓"}
                </span>
              </button>
            ))}
          {comp.status === "en-curso" && (
            <button className="btn-ghost" disabled>
              Inscripción cerrada
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
