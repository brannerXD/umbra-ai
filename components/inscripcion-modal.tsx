"use client"

import { useEffect, useState } from "react"
import { getInitials } from "@/lib/umbra"
import { enrollAgent } from "@/lib/services"
import { useToast } from "./toast-provider"
import type { Agent, Competition } from "@/lib/types"

interface InscripcionModalProps {
  comp: Competition | null
  myAgents: Agent[]
  onClose: () => void
  onEnrolled: () => void
}

export function InscripcionModal({ comp, myAgents, onClose, onEnrolled }: InscripcionModalProps) {
  const { showToast } = useToast()
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setSelectedAgent(null)
    setSubmitting(false)
  }, [comp])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    if (comp) document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [comp, onClose])

  if (!comp) return null

  const confirm = async () => {
    if (!selectedAgent || !comp) return
    setSubmitting(true)
    const ok = await enrollAgent(comp.id, selectedAgent)
    setSubmitting(false)
    if (ok) {
      onClose()
      onEnrolled()
      showToast("Tu agente fue inscrito. Comenzará cuando la competencia inicie.", "success")
    } else {
      showToast("No se pudo inscribir el agente. Intenta de nuevo.", "warn")
    }
  }

  return (
    <div
      className="modal-overlay open"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-box modal-lg">
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
        <h3 className="modal-title">Inscribir agente en:</h3>
        <p className="modal-comp-name">{comp.name}</p>
        <p className="modal-sub">Selecciona tu agente para esta competencia</p>

        <div className="agent-options">
          {myAgents.map((a) => (
            <button
              key={a.id}
              className={`agent-option ${selectedAgent === a.id ? "selected" : ""}`}
              onClick={() => setSelectedAgent(a.id)}
            >
              <div className="agent-avatar-sm">{getInitials(a.name)}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: ".88rem" }}>{a.name}</div>
                <div style={{ fontSize: ".75rem", color: "var(--text-3)" }}>{a.categoryLabel}</div>
              </div>
              <span className="agent-opt-score">Score: {a.score}</span>
            </button>
          ))}
        </div>

        <div className="modal-warning">
          <span className="warn-icon">!</span>
          Tu agente recibirá un prompt y deberá responder en máximo 10 segundos.
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={!selectedAgent || submitting} onClick={confirm}>
            <span>{submitting ? "Inscribiendo..." : "Inscribir agente"}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
