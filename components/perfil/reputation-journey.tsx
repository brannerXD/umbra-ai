"use client"

import { useMemo } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useI18n } from "@/components/language-provider"
import type { ReputationJourney } from "@/lib/types"

// Textos en ambos idiomas.
const T = {
  es: {
    titulo: "Trayectoria de reputación",
    sub: "Cómo se ganó, competencia a competencia.",
    score: "Score",
    comps: "Competencias",
    victorias: "Victorias",
    mejor: "Mejor puntuación",
    vacioTitulo: "Tu trayectoria empieza en la primera competencia.",
    vacioSub: "Registra un agente e inscríbelo: cada resultado suma a tu score.",
    ganada: "Ganada",
    puesto: (n: number) => `${n}º puesto`,
    obtuvo: "Obtuvo",
    locale: "es-CO",
  },
  en: {
    titulo: "Reputation journey",
    sub: "How it was earned, competition by competition.",
    score: "Score",
    comps: "Competitions",
    victorias: "Wins",
    mejor: "Best result",
    vacioTitulo: "Your journey starts at the first competition.",
    vacioSub: "Register an agent and enter it: every result adds to your score.",
    ganada: "Won",
    puesto: (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"} place`,
    obtuvo: "Scored",
    locale: "en-US",
  },
} as const

interface TipProps {
  active?: boolean
  payload?: { payload: Punto }[]
}

interface Punto {
  fecha: string
  score: number
  puntos: number
  puntuacion: number
  puesto: number
  gano: boolean
  competencia: string
  agente: string
  etiqueta: string
}

export function ReputationJourney({ data }: { data: ReputationJourney | null }) {
  const { lang } = useI18n()
  const s = T[lang]

  const puntos = useMemo<Punto[]>(
    () =>
      (data?.puntos ?? []).map((p) => ({
        ...p,
        etiqueta: new Date(p.fecha).toLocaleDateString(s.locale, {
          day: "numeric",
          month: "short",
        }),
      })),
    [data, s.locale],
  )

  if (!data) return <div className="jrn-skeleton" />

  const r = data.resumen

  function Tip({ active, payload }: TipProps) {
    if (!active || !payload?.length) return null
    const p = payload[0].payload
    return (
      <div className="jrn-tip">
        <span className="jrn-tip-comp">{p.competencia}</span>
        <span className="jrn-tip-linea">
          {p.gano ? s.ganada : s.puesto(p.puesto)} · {s.obtuvo} {p.puntuacion}/100
        </span>
        <span className="jrn-tip-score">
          {s.score} {p.score} <em>(+{p.puntos})</em>
        </span>
      </div>
    )
  }

  return (
    <section className="jrn">
      <div className="jrn-head">
        <div>
          <h2 className="section-title-sm">{s.titulo}</h2>
          <p className="jrn-sub">{s.sub}</p>
        </div>
      </div>

      {/* La cifra que manda va grande; el resto acompaña. */}
      <div className="jrn-kpis">
        <div className="jrn-kpi jrn-kpi-hero">
          <span className="jrn-kpi-num">{r.score}</span>
          <span className="jrn-kpi-label">{s.score}</span>
        </div>
        <div className="jrn-kpi">
          <span className="jrn-kpi-num">{r.competencias}</span>
          <span className="jrn-kpi-label">{s.comps}</span>
        </div>
        <div className="jrn-kpi">
          <span className="jrn-kpi-num">{r.victorias}</span>
          <span className="jrn-kpi-label">{s.victorias}</span>
        </div>
        <div className="jrn-kpi">
          <span className="jrn-kpi-num">{r.mejor}</span>
          <span className="jrn-kpi-label">{s.mejor}</span>
        </div>
      </div>

      {puntos.length === 0 ? (
        <div className="jrn-vacio">
          <p className="jrn-vacio-titulo">{s.vacioTitulo}</p>
          <p className="jrn-vacio-sub">{s.vacioSub}</p>
        </div>
      ) : (
        <div className="jrn-chart">
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={puntos} margin={{ left: -20, right: 16, top: 12, bottom: 0 }}>
              <defs>
                <linearGradient id="jrn-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--jrn-linea)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--jrn-linea)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--jrn-grid)" vertical={false} />
              <XAxis
                dataKey="etiqueta"
                tick={{ fill: "var(--jrn-eje)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--jrn-eje)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={38}
              />
              <Tooltip content={<Tip />} cursor={{ stroke: "var(--jrn-grid)" }} />
              {/* Una sola serie: no lleva leyenda, el titulo ya la nombra.
                  Los puntos ganados se resaltan y el resto queda de apoyo
                  (enfasis), en vez de gastar colores en identidad. */}
              <Area
                type="monotone"
                dataKey="score"
                stroke="var(--jrn-linea)"
                strokeWidth={2}
                fill="url(#jrn-fill)"
                dot={<PuntoHito />}
                activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--surface)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

interface DotProps {
  cx?: number
  cy?: number
  payload?: Punto
}

/** Marca cada competencia. Las ganadas van rellenas; el resto, huecas. */
function PuntoHito({ cx, cy, payload }: DotProps) {
  if (cx == null || cy == null || !payload) return null
  const gano = payload.gano
  return (
    <circle
      cx={cx}
      cy={cy}
      r={gano ? 5 : 4}
      fill={gano ? "var(--jrn-linea)" : "var(--surface)"}
      stroke="var(--jrn-linea)"
      strokeWidth={2}
    />
  )
}
