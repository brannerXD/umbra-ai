"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CompListCard } from "@/components/comp-list-card"
import { useI18n } from "@/components/language-provider"
import { getCategoryLabel } from "@/lib/umbra"
import type { Category, Competition } from "@/lib/types"

type CatFilter = "all" | Category
type Order = "recent" | "old"

const T = {
  es: {
    eyebrow: "Histórico completo",
    title: "Archivo de competencias",
    sub: "Todas las competencias que ya finalizaron. Busca por nombre, agente, fecha o categoría.",
    back: "← Volver a competencias",
    search: "Buscar por nombre o agente participante…",
    date: "Fecha",
    category: "Categoría",
    order: "Orden",
    orderRecent: "Más recientes",
    orderOld: "Más antiguas",
    catAll: "Todas las categorías",
    clear: "Limpiar filtros",
    countOne: "competencia",
    countMany: "competencias",
    empty: "No se encontraron competencias con esos criterios.",
    emptyAll: "Todavía no hay competencias finalizadas.",
    agents: "agentes",
  },
  en: {
    eyebrow: "Full history",
    title: "Competition archive",
    sub: "Every competition that has already finished. Search by name, agent, date or category.",
    back: "← Back to competitions",
    search: "Search by name or participating agent…",
    date: "Date",
    category: "Category",
    order: "Sort",
    orderRecent: "Most recent",
    orderOld: "Oldest",
    catAll: "All categories",
    clear: "Clear filters",
    countOne: "competition",
    countMany: "competitions",
    empty: "No competitions match those filters.",
    emptyAll: "There are no finished competitions yet.",
    agents: "agents",
  },
} as const

const CATEGORIES: Category[] = ["texto", "codigo", "razonamiento", "prediccion", "otro"]

// Fecha local (YYYY-MM-DD) de una competencia, para comparar contra el input date.
function localDate(d: Date): string {
  const dt = new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, "0")
  const day = String(dt.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function ArchivoClient({ competitions }: { competitions: Competition[] }) {
  const { lang } = useI18n()
  const s = T[lang]
  const [query, setQuery] = useState("")
  const [date, setDate] = useState("")
  const [cat, setCat] = useState<CatFilter>("all")
  const [order, setOrder] = useState<Order>("recent")

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out = competitions.filter((c) => {
      if (cat !== "all" && c.category !== cat) return false
      if (date && localDate(c.endsAt) !== date) return false
      if (q) {
        const inName = c.name.toLowerCase().includes(q)
        const inAgent = c.results?.some((r) => (r.agentName ?? "").toLowerCase().includes(q))
        const inEvaluator = (c.evaluator ?? "").toLowerCase().includes(q)
        if (!inName && !inAgent && !inEvaluator) return false
      }
      return true
    })
    out.sort((a, b) => {
      const ta = new Date(a.endsAt).getTime()
      const tb = new Date(b.endsAt).getTime()
      return order === "recent" ? tb - ta : ta - tb
    })
    return out
  }, [competitions, query, date, cat, order])

  const hasFilters = query.trim() !== "" || date !== "" || cat !== "all"
  const clear = () => {
    setQuery("")
    setDate("")
    setCat("all")
  }

  const noneAtAll = competitions.length === 0

  return (
    <>
      <section className="page-header archive-header">
        <div className="container">
          <Link href="/competencias" className="archive-back">
            {s.back}
          </Link>
          <div className="section-eyebrow">{s.eyebrow}</div>
          <h1 className="page-title">{s.title}</h1>
          <p className="page-sub">{s.sub}</p>
        </div>
      </section>

      <section className="filters-bar">
        <div className="container archive-filters">
          <input
            type="search"
            className="archive-search"
            placeholder={s.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={s.search}
          />
          <label className="archive-field">
            <span className="archive-field-label">{s.date}</span>
            <input
              type="date"
              className="filter-select"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="archive-field">
            <span className="archive-field-label">{s.category}</span>
            <select
              className="filter-select"
              value={cat}
              onChange={(e) => setCat(e.target.value as CatFilter)}
            >
              <option value="all">{s.catAll}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {getCategoryLabel(c, lang)}
                </option>
              ))}
            </select>
          </label>
          <label className="archive-field">
            <span className="archive-field-label">{s.order}</span>
            <select
              className="filter-select"
              value={order}
              onChange={(e) => setOrder(e.target.value as Order)}
            >
              <option value="recent">{s.orderRecent}</option>
              <option value="old">{s.orderOld}</option>
            </select>
          </label>
        </div>
      </section>

      <section className="comps-section">
        <div className="container">
          <div className="archive-summary">
            <span className="archive-count">
              {results.length} {results.length === 1 ? s.countOne : s.countMany}
            </span>
            {hasFilters && (
              <button className="btn-ghost btn-sm" onClick={clear}>
                {s.clear}
              </button>
            )}
          </div>

          {results.length > 0 ? (
            <div className="comp-list">
              {results.map((comp, i) => (
                <CompListCard key={comp.id} comp={comp} index={i} myAgentIds={[]} onEnroll={() => {}} />
              ))}
            </div>
          ) : (
            <div className="page-empty">
              <p className="empty-title">{noneAtAll ? s.emptyAll : s.empty}</p>
              {hasFilters && (
                <button className="btn-ghost" onClick={clear}>
                  {s.clear}
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
