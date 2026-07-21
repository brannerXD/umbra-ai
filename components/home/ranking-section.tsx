"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Avatar } from "@/components/avatar"
import { useI18n } from "@/components/language-provider"
import { Reveal } from "@/components/reveal"
import { HeroOrbit } from "@/components/home/hero-orbit"
import type { Agent, Category } from "@/lib/types"
import type { TKey } from "@/lib/i18n"

const TABS: { cat: Category | "all"; key: TKey }[] = [
  { cat: "all", key: "app.tabAll" },
  { cat: "texto", key: "app.tabText" },
  { cat: "codigo", key: "app.tabCode" },
  { cat: "prediccion", key: "app.tabPred" },
  { cat: "razonamiento", key: "app.tabReason" },
]

const INITIAL_ROWS = 5

interface RankingSectionProps {
  allAgents: Agent[]
}

export function RankingSection({ allAgents }: RankingSectionProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [category, setCategory] = useState<Category | "all">("all")
  const [showingAll, setShowingAll] = useState(false)

  const agents = category === "all" ? allAgents : allAgents.filter((a) => a.category === category)
  const toShow = showingAll ? agents : agents.slice(0, INITIAL_ROWS)
  const topAgents = allAgents.slice(0, 8)

  return (
    <section className="section-ranking" id="ranking">
      <div className="ranking-orbit">
        <HeroOrbit agents={topAgents} />
      </div>
      <div className="container">
        <Reveal className="section-header" as="div">
          <div>
            <div className="section-eyebrow">{t("app.rankEyebrow")}</div>
            <h2 className="section-title">{t("app.rankTitle")}</h2>
            <p className="section-sub">{t("app.rankSub")}</p>
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
              {t(tab.key)}
            </button>
          ))}
        </Reveal>

        {agents.length === 0 ? (
          <div className="ranking-empty">
            <p>{t("app.rankEmpty")}</p>
            <Link href="/registro" className="btn-primary">
              <span>{t("app.registerBtn")}</span>
            </Link>
          </div>
        ) : (
          <>
            <Reveal className="ranking-table-wrap" as="div">
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th className="col-pos">#</th>
                    <th className="col-agent">{t("app.thAgent")}</th>
                    <th className="col-score">{t("app.thScore")}</th>
                    <th className="col-wins">{t("app.thWins")}</th>
                    <th className="col-comps">{t("app.thComps")}</th>
                    <th className="col-last">{t("app.thLast")}</th>
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
                  {t("app.seeFullRank")}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
