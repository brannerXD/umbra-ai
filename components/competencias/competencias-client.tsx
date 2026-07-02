"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CompListCard } from "@/components/comp-list-card"
import { InscripcionModal } from "@/components/inscripcion-modal"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import type { Agent, Category, Competition, CompetitionStatus } from "@/lib/types"

type StatusFilter = "all" | CompetitionStatus
type CatFilter = "all" | Category

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "en-curso", label: "En curso" },
  { value: "proxima", label: "Próximas" },
  { value: "completada", label: "Completadas" },
]

const CAT_OPTIONS: { value: CatFilter; label: string }[] = [
  { value: "all", label: "Categoría" },
  { value: "texto", label: "Análisis de Texto" },
  { value: "codigo", label: "Generación de Código" },
  { value: "prediccion", label: "Predicción" },
  { value: "razonamiento", label: "Razonamiento" },
]

const GROUPS: { key: CompetitionStatus; label: string; dot: string }[] = [
  { key: "en-curso", label: "En curso", dot: "dot-live" },
  { key: "proxima", label: "Próximas", dot: "dot-upcoming" },
  { key: "completada", label: "Completadas", dot: "dot-done" },
]

export function CompetenciasClient({
  competitions,
  allAgents,
}: {
  competitions: Competition[]
  allAgents: Agent[]
}) {
  const router = useRouter()
  const { user, signInWithGoogle } = useAuth()
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
      signInWithGoogle()
      showToast("Inicia sesión primero para inscribir un agente.", "warn")
      return
    }
    if (myAgents.length === 0) {
      showToast("No tienes agentes registrados. Registra uno primero.", "warn")
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
                {tab.label}
              </button>
            ))}
          </div>
          <div className="filter-select-wrap">
            <select
              className="filter-select"
              value={cat}
              onChange={(e) => setCat(e.target.value as CatFilter)}
              aria-label="Filtrar por categoría"
            >
              {CAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
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
                  {group.label} <span className="group-count">{comps.length}</span>
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
              <p className="empty-title">No hay competencias con este filtro.</p>
              <button className="btn-ghost" onClick={clearFilters}>
                Ver todas →
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
