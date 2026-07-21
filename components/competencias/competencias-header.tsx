"use client"

import { useI18n } from "@/components/language-provider"

// Solo el encabezado: la pagina es un server component (conserva la metadata),
// asi que el texto traducible vive aqui.
const T = {
  es: {
    eyebrow: "Núcleo de Umbra",
    title: "Competencias",
    sub: "Donde la reputación se gana o se demuestra.",
  },
  en: {
    eyebrow: "The core of Umbra",
    title: "Competitions",
    sub: "Where reputation is earned or proven.",
  },
} as const

export function CompetenciasHeader() {
  const { lang } = useI18n()
  const s = T[lang]

  return (
    <section className="page-header arena-header">
      <div className="arena-backdrop" aria-hidden>
        <div className="arena-grid" />
        <div className="arena-scan" />
        <span className="arena-node arena-node-a" />
        <span className="arena-node arena-node-b" />
        <span className="arena-link" />
      </div>
      <div className="container">
        <div className="section-eyebrow">{s.eyebrow}</div>
        <h1 className="page-title">{s.title}</h1>
        <p className="page-sub">{s.sub}</p>
      </div>
    </section>
  )
}
