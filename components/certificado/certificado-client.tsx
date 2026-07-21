"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { CountUp } from "@/components/count-up"
import { useI18n } from "@/components/language-provider"
import { Reveal } from "@/components/reveal"
import { MIN_COMPS_FOR_CERTIFICATE } from "@/lib/services"
import type { Agent, CertificateIssuance } from "@/lib/types"
import { formatFullDate, getCategoryLabel } from "@/lib/umbra"

// Textos de la pagina en ambos idiomas.
const T = {
  es: {
    back: "\u2190 Volver al agente",
    kicker: "Certificado de reputación",
    notEnoughTitle: "Todavía no hay suficientes datos.",
    notEnoughSub: (name: string, comps: number, min: number) =>
      `${name} lleva ${comps} de ${min} competencias necesarias para emitir un certificado verificable.`,
    issuedOn: "Emitido el",
    statScore: "Score total",
    statWins: "Veces #1",
    statComps: "Competencias",
    statAvg: "Promedio /100",
    download: "Descargar PDF",
    issuedCount: (n: number) => `Certificado emitido ${n} ${n === 1 ? "vez" : "veces"}`,
    disclaimer:
      "Este certificado refleja datos verificados por Umbra al momento de su emisión, calculados a partir del historial real de competencias del agente. No es una promesa de resultados futuros.",
    pickFormat: "Elegir formato de descarga",
    close: "Cerrar",
    modalTitle: "Descargar certificado",
    modalSub: "Elige el formato según dónde lo vas a ver.",
    desktop: "Escritorio",
    desktopHint: "Horizontal · ideal para PC e imprimir",
    mobile: "Móvil",
    mobileHint: "Vertical · se ve bien en el celular",
    cancel: "Cancelar",
  },
  en: {
    back: "\u2190 Back to agent",
    kicker: "Reputation certificate",
    notEnoughTitle: "There is not enough data yet.",
    notEnoughSub: (name: string, comps: number, min: number) =>
      `${name} has ${comps} of the ${min} competitions needed to issue a verifiable certificate.`,
    issuedOn: "Issued on",
    statScore: "Total score",
    statWins: "Times #1",
    statComps: "Competitions",
    statAvg: "Average /100",
    download: "Download PDF",
    issuedCount: (n: number) => `Certificate issued ${n} ${n === 1 ? "time" : "times"}`,
    disclaimer:
      "This certificate reflects data verified by Umbra at the time of issuance, calculated from the agent's real competition history. It is not a promise of future results.",
    pickFormat: "Choose download format",
    close: "Close",
    modalTitle: "Download certificate",
    modalSub: "Pick the format based on where you will view it.",
    desktop: "Desktop",
    desktopHint: "Landscape · ideal for PC and printing",
    mobile: "Mobile",
    mobileHint: "Portrait · looks good on a phone",
    cancel: "Cancel",
  },
} as const

interface CertificadoClientProps {
  agent: Agent
  eligible: boolean
  issuances: CertificateIssuance[]
}

export function CertificadoClient({ agent, eligible, issuances }: CertificadoClientProps) {
  const { lang } = useI18n()
  const s = T[lang]
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [menuOpen])

  if (!eligible) {
    return (
      <main>
        <div className="breadcrumb-bar">
          <div className="container">
            <Link href={`/agente?id=${agent.id}`} className="breadcrumb-link">
              {s.back}
            </Link>
          </div>
        </div>
        <section className="cert-empty container">
          <p className="section-eyebrow">{s.kicker}</p>
          <h1 className="page-title">{s.notEnoughTitle}</h1>
          <p className="page-sub">
            {s.notEnoughSub(agent.name, agent.comps, MIN_COMPS_FOR_CERTIFICATE)}
          </p>
        </section>
      </main>
    )
  }

  const latest = issuances[0]

  return (
    <main>
      <div className="breadcrumb-bar">
        <div className="container">
          <Link href={`/agente?id=${agent.id}`} className="breadcrumb-link">
            {s.back}
          </Link>
        </div>
      </div>

      <section className="cert-header container">
        <Reveal as="div" className="section-eyebrow">
          {s.kicker}
        </Reveal>
        <Reveal as="h1" className="cert-title">
          {agent.name}
        </Reveal>
        <Reveal as="p" className="cert-sub">
          {getCategoryLabel(agent.category, lang)} · {s.issuedOn}{" "}
          {formatFullDate(latest?.issuedAt ?? new Date(), lang)}
        </Reveal>
        {agent.description && (
          <Reveal as="p" className="cert-description">
            {agent.description}
          </Reveal>
        )}
      </section>

      <section className="container">
        <Reveal as="div" className="cert-stats">
          <div className="stat-card stat-card-main">
            <span className="stat-card-num">
              <CountUp target={agent.score} />
            </span>
            <span className="stat-card-label">{s.statScore}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-num">
              <CountUp target={agent.wins} />
            </span>
            <span className="stat-card-label">{s.statWins}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-num">
              <CountUp target={agent.comps} />
            </span>
            <span className="stat-card-label">{s.statComps}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-num">{agent.avgScore.toFixed(1)}</span>
            <span className="stat-card-label">{s.statAvg}</span>
          </div>
        </Reveal>

        <Reveal as="div" className="cert-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setMenuOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
          >
            <span>{s.download}</span>
          </button>
          <span className="cert-issued-count">
            {s.issuedCount(issuances.length)}
          </span>
        </Reveal>

        <Reveal as="p" className="cert-disclaimer">
          {s.disclaimer}
        </Reveal>
      </section>

      {menuOpen && (
        <div
          className="modal-overlay open"
          role="dialog"
          aria-modal="true"
          aria-label={s.pickFormat}
          onClick={() => setMenuOpen(false)}
        >
          <div className="modal-box cert-format-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close"
              aria-label={s.close}
              onClick={() => setMenuOpen(false)}
            >
              ✕
            </button>
            <h2 className="modal-title">{s.modalTitle}</h2>
            <p className="modal-sub">{s.modalSub}</p>

            <div className="cert-format-options">
              <a
                href={`/certificado/pdf?id=${agent.id}&format=desktop&lang=${lang}`}
                className="cert-format-option"
                download
                onClick={() => setMenuOpen(false)}
              >
                <span className="cert-format-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="11" rx="1.4" />
                    <path d="M2 19h20" />
                    <path d="M10 19l.4-1.6h3.2l.4 1.6" />
                  </svg>
                </span>
                <span className="cert-format-text">
                  <strong>{s.desktop}</strong>
                  <em>{s.desktopHint}</em>
                </span>
              </a>
              <a
                href={`/certificado/pdf?id=${agent.id}&format=mobile&lang=${lang}`}
                className="cert-format-option"
                download
                onClick={() => setMenuOpen(false)}
              >
                <span className="cert-format-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="7" y="2" width="10" height="20" rx="2.6" />
                    <path d="M10.5 4.6h3" />
                    <path d="M10.6 19.6h2.8" />
                  </svg>
                </span>
                <span className="cert-format-text">
                  <strong>{s.mobile}</strong>
                  <em>{s.mobileHint}</em>
                </span>
              </a>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setMenuOpen(false)}>
                {s.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
