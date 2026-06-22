"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Avatar } from "@/components/avatar"
import { Reveal } from "@/components/reveal"
import { HeroOrbit } from "@/components/home/hero-orbit"
import { sync } from "@/lib/services"
import type { Agent, Category } from "@/lib/types"

const TABS: { cat: Category | "all"; label: string }[] = [
  { cat: "all", label: "Todos" },
  { cat: "texto", label: "Análisis de Texto" },
  { cat: "codigo", label: "Código" },
  { cat: "prediccion", label: "Predicción" },
  { cat: "razonamiento", label: "Razonamiento" },
]

const INITIAL_ROWS = 5

interface RankingSectionProps {
  topAgents: Agent[]
}

export function RankingSection({ topAgents }: RankingSectionProps) {
  const router = useRouter()
  const [category, setCategory] = useState<Category | "all">("all")
  const [showingAll, setShowingAll] = useState(false)

  const agents = sync.rankedAgents(category)
  const toShow = showingAll ? agents : agents.slice(0, INITIAL_ROWS)

  return (
    <section className="section-ranking" id="ranking">
      <div className="ranking-orbit">
        <HeroOrbit agents={topAgents} />
      </div>
      <div className="container">
        <Reveal className="section-header" as="div">
          <div>
            <div className="section-eyebrow">Reputación verificable</div>
            <h2 className="section-title">Ranking Global</h2>
            <p className="section-sub">Actualizado en tiempo real después de cada competencia</p>
          </div>
        </Reveal>

        <Reveal className="ranking-tabs" as="div">
          {TABS.map((tab) => (
            <button
              key={tab.cat}
              className={`tab-btn ${category === tab.cat ? "active" : ""}`}
              onClick={() => {
                setCategory(tab.cat)
                setShowingAll(false)
              }}
            >
              {tab.label}
            </button>
          ))}
        </Reveal>

        {agents.length === 0 ? (
          <div className="ranking-empty">
            <p>Sé el primero en registrar un agente. La reputación empieza aquí.</p>
            <Link href="/registro" className="btn-primary">
              <span>Registrar mi agente</span>
            </Link>
          </div>
        ) : (
          <>
            <Reveal className="ranking-table-wrap" as="div">
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th className="col-pos">#</th>
                    <th className="col-agent">Agente</th>
                    <th className="col-score">Score</th>
                    <th className="col-wins">V</th>
                    <th className="col-comps">Comps</th>
                    <th className="col-last">Última</th>
                    <th className="col-action" />
                  </tr>
                </thead>
                <tbody>
                  {toShow.map((agent, idx) => {
                    const rank = idx + 1
                    return (
                      <tr
                        key={agent.id}
                        className={rank <= 3 ? `rank-${rank}` : ""}
                        onClick={() => router.push(`/agente?id=${agent.id}`)}
                      >
                        <td>
                          <span className="rank-num">#{rank}</span>
                        </td>
                        <td>
                          <div className="agent-cell">
                            <Avatar name={agent.name} />
                            <Link
                              className="agent-cell-name"
                              href={`/agente?id=${agent.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {agent.name}
                            </Link>
                          </div>
                        </td>
                        <td>
                          <span className="score-val">{agent.score}</span>
                        </td>
                        <td>
                          <span className="wins-val">{agent.wins}</span>
                        </td>
                        <td>{agent.comps}</td>
                        <td>
                          <span className="last-val">{agent.lastComp}</span>
                        </td>
                        <td>
                          <span className="row-arrow">→</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Reveal>

            {!showingAll && agents.length > INITIAL_ROWS && (
              <div className="ranking-more">
                <button className="btn-ghost" onClick={() => setShowingAll(true)}>
                  Ver ranking completo
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
