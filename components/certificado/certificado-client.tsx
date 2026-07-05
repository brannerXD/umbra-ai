"use client"

import Link from "next/link"
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
          <a href={`/certificado/pdf?id=${agent.id}`} className="btn-primary" download>
            <span>Descargar PDF</span>
          </a>
          <span className="cert-issued-count">
            Certificado emitido {issuances.length} {issuances.length === 1 ? "vez" : "veces"}
          </span>
        </Reveal>

        <Reveal as="p" className="cert-disclaimer">
          Este certificado refleja datos verificados por Umbra al momento de su emisión, calculados a partir del
          historial real de competencias del agente. No es una promesa de resultados futuros.
        </Reveal>
      </section>
    </main>
  )
}
