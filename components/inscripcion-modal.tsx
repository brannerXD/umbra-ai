"use client"

import { useEffect, useState } from "react"
import { getCategoryLabel, getInitials } from "@/lib/umbra"
import { enrollAgent } from "@/lib/services"
import { useI18n } from "./language-provider"
import { useToast } from "./toast-provider"
import type { Agent, Competition } from "@/lib/types"

// Textos del modal en ambos idiomas.
const T = {
  es: {
    close: "Cerrar",
    title: "Inscribir agente en:",
    sub: "Selecciona tu agente para esta competencia",
    score: "Score:",
    warn: "Tu agente recibirá un prompt y deberá responder en máximo 10 segundos.",
    cancel: "Cancelar",
    submit: "Inscribir agente",
    submitting: "Inscribiendo...",
    ok: "Tu agente fue inscrito. Comenzará cuando la competencia inicie.",
    err: "No se pudo inscribir el agente. Intenta de nuevo.",
    already: "Ya inscrito",
    alreadyMsg: "Ese agente ya está inscrito en esta competencia.",
  },
  en: {
    close: "Close",
    title: "Enter an agent in:",
    sub: "Select your agent for this competition",
    score: "Score:",
    warn: "Your agent will receive a prompt and must answer within 10 seconds.",
    cancel: "Cancel",
    submit: "Enter agent",
    submitting: "Entering...",
    ok: "Your agent is entered. It will start when the competition begins.",
    err: "The agent could not be entered. Please try again.",
    already: "Already entered",
    alreadyMsg: "That agent is already entered in this competition.",
  },
} as const

interface InscripcionModalProps {
  comp: Competition | null
  myAgents: Agent[]
  onClose: () => void
  onEnrolled: () => void
}

export function InscripcionModal({ comp, myAgents, onClose, onEnrolled }: InscripcionModalProps) {
  const { showToast } = useToast()
  const { lang } = useI18n()
  const s = T[lang]
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

  // Agentes que ya están inscritos en esta competencia (vienen en los resultados).
  const enrolledIds = new Set(comp.results?.map((r) => r.agentId) ?? [])

  const confirm = async () => {
    if (!selectedAgent || !comp) return
    setSubmitting(true)
    const res = await enrollAgent(comp.id, selectedAgent)
    setSubmitting(false)
    if (res.ok) {
      onClose()
      onEnrolled()
      showToast(s.ok, "success")
    } else if (res.already) {
      // Ya estaba inscrito: no es un error, solo refrescamos para que se vea.
      onClose()
      onEnrolled()
      showToast(s.alreadyMsg, "warn")
    } else {
      showToast(s.err, "warn")
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
        <button className="modal-close" onClick={onClose} aria-label={s.close}>
          ✕
        </button>
        <h3 className="modal-title">{s.title}</h3>
        <p className="modal-comp-name">{comp.name}</p>
        <p className="modal-sub">{s.sub}</p>

        <div className="agent-options">
          {myAgents.map((a) => {
            const yaInscrito = enrolledIds.has(a.id)
            return (
              <button
                key={a.id}
                className={`agent-option ${selectedAgent === a.id ? "selected" : ""} ${yaInscrito ? "enrolled" : ""}`}
                disabled={yaInscrito}
                onClick={() => !yaInscrito && setSelectedAgent(a.id)}
              >
                <div className="agent-avatar-sm">{getInitials(a.name)}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: ".88rem" }}>{a.name}</div>
                  <div style={{ fontSize: ".75rem", color: "var(--text-3)" }}>
                    {getCategoryLabel(a.category, lang)}
                  </div>
                </div>
                {yaInscrito ? (
                  <span className="agent-opt-enrolled">{s.already}</span>
                ) : (
                  <span className="agent-opt-score">
                    {s.score} {a.score}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="modal-warning">
          <span className="warn-icon">!</span>
          {s.warn}
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>
            {s.cancel}
          </button>
          <button className="btn-primary" disabled={!selectedAgent || submitting} onClick={confirm}>
            <span>{submitting ? s.submitting : s.submit}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
