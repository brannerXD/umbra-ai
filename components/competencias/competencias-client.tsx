"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CompListCard } from "@/components/comp-list-card"
import { InscripcionModal } from "@/components/inscripcion-modal"
import { useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/language-provider"
import { useToast } from "@/components/toast-provider"
import type { Agent, Category, Competition, CompetitionStatus } from "@/lib/types"

type StatusFilter = "all" | CompetitionStatus
type CatFilter = "all" | Category

// Textos de la pagina en ambos idiomas.
const T = {
  es: {
    tabAll: "Todas",
    tabLive: "En curso",
    tabUpcoming: "Próximas",
    tabDone: "Completadas",
    catAll: "Categoría",
    catText: "Análisis de Texto",
    catCode: "Generación de Código",
    catPred: "Predicción",
    catReason: "Razonamiento",
    filterAria: "Filtrar por categoría",
    groupLive: "En curso",
    groupUpcoming: "Próximas",
    groupDone: "Completadas",
    empty: "No hay competencias con este filtro.",
    seeAll: "Ver todas →",
    needSignIn: "Inicia sesión primero para inscribir un agente.",
    needAgent: "No tienes agentes registrados. Registra uno primero.",
  },
  en: {
    tabAll: "All",
    tabLive: "Live",
    tabUpcoming: "Upcoming",
    tabDone: "Completed",
    catAll: "Category",
    catText: "Text Analysis",
    catCode: "Code Generation",
    catPred: "Prediction",
    catReason: "Reasoning",
    filterAria: "Filter by category",
    groupLive: "Live",
    groupUpcoming: "Upcoming",
    groupDone: "Completed",
    empty: "There are no competitions matching this filter.",
    seeAll: "See all →",
    needSignIn: "Sign in first to enter an agent.",
    needAgent: "You have no registered agents. Register one first.",
  },
} as const

type Str = (typeof T)["es"]

const STATUS_TABS: { value: StatusFilter; key: keyof Str }[] = [
  { value: "all", key: "tabAll" },
  { value: "en-curso", key: "tabLive" },
  { value: "proxima", key: "tabUpcoming" },
  { value: "completada", key: "tabDone" },
]

const CAT_OPTIONS: { value: CatFilter; key: keyof Str }[] = [
  { value: "all", key: "catAll" },
  { value: "texto", key: "catText" },
  { value: "codigo", key: "catCode" },
  { value: "prediccion", key: "catPred" },
  { value: "razonamiento", key: "catReason" },
]

const GROUPS: { key: CompetitionStatus; label: keyof Str; dot: string }[] = [
  { key: "en-curso", label: "groupLive", dot: "dot-live" },
  { key: "proxima", label: "groupUpcoming", dot: "dot-upcoming" },
  { key: "completada", label: "groupDone", dot: "dot-done" },
]

export function CompetenciasClient({
  competitions,
  allAgents,
}: {
  competitions: Competition[]
  allAgents: Agent[]
}) {
  const router = useRouter()
  const { user, openAuth } = useAuth()
  const { lang } = useI18n()
  const s = T[lang]
  const { showToast } = useToast()
  const [status, setStatus] = useState<StatusFilter>("all")
  const [cat, setCat] = useState<CatFilter>("all")
  const [enrollComp, setEnrollComp] = useState<Competition | null>(null)

  const myAgents = useMemo(() => allAgents.filter((a) => a.ownerId === user?.id), [user, allAgents])
  const myAgentIds = myAgents.map((a) => a.id)

  const filtered = useMemo(
    () =>
      competitions.filter(
        (c) => (status === "all" || c.status === status) && (cat === "all" || c.category === cat),
      ),
    [competitions, status, cat],
  )

  const handleEnroll = (comp: Competition) => {
    if (!user) {
      openAuth("signin")
      showToast(s.needSignIn, "warn")
      return
    }
    if (myAgents.length === 0) {
      showToast(s.needAgent, "warn")
      return
    }
    setEnrollComp(comp)
  }

  const clearFilters = () => {
    setStatus("all")
    setCat("all")
  }

  const isEmpty = filtered.length === 0

  return (
    <>
      <section className="filters-bar">
        <div className="container filters-inner">
          <div className="filter-tabs">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                className={`tab-btn ${status === tab.value ? "active" : ""}`}
                onClick={() => setStatus(tab.value)}
              >
                {s[tab.key]}
              </button>
            ))}
          </div>
          <div className="filter-select-wrap">
            <select
              className="filter-select"
              value={cat}
              onChange={(e) => setCat(e.target.value as CatFilter)}
              aria-label={s.filterAria}
            >
              {CAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {s[o.key]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="comps-section">
        <div className="container">
          {GROUPS.map((group) => {
            const comps = filtered.filter((c) => c.status === group.key)
            if (comps.length === 0) return null
            return (
              <div className="comp-group" key={group.key}>
                <h2 className="group-title">
                  <span className={`status-dot ${group.dot}`} />
                  {s[group.label]} <span className="group-count">{comps.length}</span>
                </h2>
                <div className="comp-list">
                  {comps.map((comp, i) => (
                    <CompListCard
                      key={comp.id}
                      comp={comp}
                      index={i}
                      myAgentIds={myAgentIds}
                      onEnroll={handleEnroll}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {isEmpty && (
            <div className="page-empty">
              <p className="empty-title">{s.empty}</p>
              <button className="btn-ghost" onClick={clearFilters}>
                {s.seeAll}
              </button>
            </div>
          )}
        </div>
      </section>

      <InscripcionModal
        comp={enrollComp}
        myAgents={myAgents}
        onClose={() => setEnrollComp(null)}
        onEnrolled={() => router.refresh()}
      />
    </>
  )
}
