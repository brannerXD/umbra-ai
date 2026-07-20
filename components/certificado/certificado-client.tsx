"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { CountUp } from "@/components/count-up"
import { Reveal } from "@/components/reveal"
import { MIN_COMPS_FOR_CERTIFICATE } from "@/lib/services"
import type { Agent, CertificateIssuance } from "@/lib/types"
import { formatFullDate } from "@/lib/umbra"

interface CertificadoClientProps {
  agent: Agent
  eligible: boolean
  issuances: CertificateIssuance[]
}

export function CertificadoClient({ agent, eligible, issuances }: CertificadoClientProps) {
  if (!eligible) {
    return (
      <main>
        <div className="breadcrumb-bar">
          <div className="container">
            <Link href={`/agente?id=${agent.id}`} className="breadcrumb-link">
              ← Volver al agente
            </Link>
          </div>
        </div>
        <section className="cert-empty container">
          <p className="section-eyebrow">Certificado de reputación</p>
          <h1 className="page-title">Todavía no hay suficientes datos.</h1>
          <p className="page-sub">
            {agent.name} lleva {agent.comps} de {MIN_COMPS_FOR_CERTIFICATE} competencias necesarias para emitir un
            certificado verificable.
          </p>
        </section>
      </main>
    )
  }

  const latest = issuances[0]
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

  return (
    <main>
      <div className="breadcrumb-bar">
        <div className="container">
          <Link href={`/agente?id=${agent.id}`} className="breadcrumb-link">
            ← Volver al agente
          </Link>
        </div>
      </div>

      <section className="cert-header container">
        <Reveal as="div" className="section-eyebrow">
          Certificado de reputación
        </Reveal>
        <Reveal as="h1" className="cert-title">
          {agent.name}
        </Reveal>
        <Reveal as="p" className="cert-sub">
          {agent.categoryLabel} · Emitido el {formatFullDate(latest?.issuedAt ?? new Date())}
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
            <span className="stat-card-label">Score total</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-num">
              <CountUp target={agent.wins} />
            </span>
            <span className="stat-card-label">Veces #1</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-num">
              <CountUp target={agent.comps} />
            </span>
            <span className="stat-card-label">Competencias</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-num">{agent.avgScore.toFixed(1)}</span>
            <span className="stat-card-label">Promedio /100</span>
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
            <span>Descargar PDF</span>
          </button>
          <span className="cert-issued-count">
            Certificado emitido {issuances.length} {issuances.length === 1 ? "vez" : "veces"}
          </span>
        </Reveal>

        <Reveal as="p" className="cert-disclaimer">
          Este certificado refleja datos verificados por Umbra al momento de su emisión, calculados a partir del
          historial real de competencias del agente. No es una promesa de resultados futuros.
        </Reveal>
      </section>

      {menuOpen && (
        <div
          className="modal-overlay open"
          role="dialog"
          aria-modal="true"
          aria-label="Elegir formato de descarga"
          onClick={() => setMenuOpen(false)}
        >
          <div className="modal-box cert-format-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close"
              aria-label="Cerrar"
              onClick={() => setMenuOpen(false)}
            >
              ✕
            </button>
            <h2 className="modal-title">Descargar certificado</h2>
            <p className="modal-sub">Elige el formato según dónde lo vas a ver.</p>

            <div className="cert-format-options">
              <a
                href={`/certificado/pdf?id=${agent.id}&format=desktop`}
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
                  <strong>Escritorio</strong>
                  <em>Horizontal · ideal para PC e imprimir</em>
                </span>
              </a>
              <a
                href={`/certificado/pdf?id=${agent.id}&format=mobile`}
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
                  <strong>Móvil</strong>
                  <em>Vertical · se ve bien en el celular</em>
                </span>
              </a>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setMenuOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
