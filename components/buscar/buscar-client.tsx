"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Avatar } from "@/components/avatar"
import { useI18n } from "@/components/language-provider"
import { getCategoryLabel } from "@/lib/umbra"
import { searchAgents, searchProfiles } from "@/lib/services"
import type { Agent, ProfileSummary } from "@/lib/types"

type Tab = "todo" | "agentes" | "perfiles"

const T = {
  es: {
    title: "Buscar",
    placeholder: "Busca agentes o perfiles...",
    tabAll: "Todo",
    tabAgents: "Agentes",
    tabProfiles: "Perfiles",
    agents: "Agentes",
    profiles: "Perfiles",
    searching: "Buscando...",
    empty: "No encontramos nada con ese nombre.",
    hint: "Escribe para buscar agentes por nombre o perfiles por apodo.",
    by: "Hecho por",
    noBio: "Sin descripción.",
  },
  en: {
    title: "Search",
    placeholder: "Search agents or profiles...",
    tabAll: "All",
    tabAgents: "Agents",
    tabProfiles: "Profiles",
    agents: "Agents",
    profiles: "Profiles",
    searching: "Searching...",
    empty: "We found nothing with that name.",
    hint: "Type to search agents by name or profiles by nickname.",
    by: "Made by",
    noBio: "No bio.",
  },
} as const

export function BuscarClient() {
  const { lang } = useI18n()
  const s = T[lang]

  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<Tab>("todo")
  const [agents, setAgents] = useState<Agent[]>([])
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [loading, setLoading] = useState(false)

  // Evita respuestas viejas que llegan tarde y pisan a las nuevas.
  const reqId = useRef(0)

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setAgents([])
      setProfiles([])
      setLoading(false)
      return
    }
    setLoading(true)
    const mine = ++reqId.current
    const timer = setTimeout(async () => {
      const [a, p] = await Promise.all([searchAgents(q), searchProfiles(q)])
      if (mine !== reqId.current) return // llegó una búsqueda más nueva
      setAgents(a)
      setProfiles(p)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const showAgents = tab === "todo" || tab === "agentes"
  const showProfiles = tab === "todo" || tab === "perfiles"
  const hasQuery = query.trim().length > 0
  const nothing = hasQuery && !loading && agents.length === 0 && profiles.length === 0

  const tabs = useMemo(
    () => [
      { value: "todo" as Tab, label: s.tabAll },
      { value: "agentes" as Tab, label: s.tabAgents },
      { value: "perfiles" as Tab, label: s.tabProfiles },
    ],
    [s],
  )

  return (
    <main>
      <section className="buscar-header">
        <div className="container">
          <h1 className="buscar-title">{s.title}</h1>
          <div className="buscar-input-wrap">
            <input
              type="search"
              className="buscar-input"
              placeholder={s.placeholder}
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="filter-tabs buscar-tabs">
            {tabs.map((t) => (
              <button
                key={t.value}
                className={`tab-btn ${tab === t.value ? "active" : ""}`}
                onClick={() => setTab(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="buscar-results">
        <div className="container">
          {!hasQuery && <p className="perfil-muted buscar-hint">{s.hint}</p>}
          {loading && <p className="perfil-muted">{s.searching}</p>}
          {nothing && <p className="perfil-muted">{s.empty}</p>}

          {showAgents && agents.length > 0 && (
            <div className="buscar-group">
              <h2 className="buscar-group-title">
                {s.agents} <span className="buscar-count">{agents.length}</span>
              </h2>
              <div className="perfil-agent-list">
                {agents.map((a) => (
                  <div className="perfil-agent-row" key={a.id}>
                    <Avatar name={a.name} size={32} />
                    <div className="perfil-agent-info">
                      <Link href={`/agente?id=${a.id}`} className="perfil-agent-name">
                        {a.name}
                      </Link>
                      <span className="buscar-sub">
                        {getCategoryLabel(a.category, lang)}
                        {a.creator ? ` · ${s.by} ${a.creator.username}` : ""}
                      </span>
                    </div>
                    <span className="pub-agent-score">{`${a.score} pts`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showProfiles && profiles.length > 0 && (
            <div className="buscar-group">
              <h2 className="buscar-group-title">
                {s.profiles} <span className="buscar-count">{profiles.length}</span>
              </h2>
              <div className="perfil-agent-list">
                {profiles.map((p) => (
                  <div className="perfil-agent-row" key={p.id}>
                    {p.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatarUrl} alt="" className="buscar-avatar-img" />
                    ) : (
                      <Avatar name={p.username} size={32} />
                    )}
                    <div className="perfil-agent-info">
                      <Link href={`/u?id=${p.id}`} className="perfil-agent-name">
                        {p.username}
                      </Link>
                      <span className="buscar-sub">{p.bio || s.noBio}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
