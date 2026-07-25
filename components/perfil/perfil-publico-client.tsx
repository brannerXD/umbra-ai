"use client"

import Link from "next/link"
import { Avatar } from "@/components/avatar"
import { useI18n } from "@/components/language-provider"
import type { PublicProfile } from "@/lib/types"

// Perfil público de solo lectura: lo que ve cualquiera al visitar /u?id=.
// No muestra email ni controles de edición.

const T = {
  es: {
    joined: "En Umbra desde",
    badgeFirst: "Primer Agente",
    badgeFirstDesc: "Creó su primer agente en Umbra",
    statAgents: "Agentes",
    statScore: "Score total",
    statWins: "Victorias",
    statBest: "Mejor score",
    agents: "Agentes",
    noAgents: "Este usuario aún no tiene agentes públicos.",
    back: "← Volver al ranking",
    locale: "es-CO",
  },
  en: {
    joined: "On Umbra since",
    badgeFirst: "First Agent",
    badgeFirstDesc: "Created their first agent on Umbra",
    statAgents: "Agents",
    statScore: "Total score",
    statWins: "Wins",
    statBest: "Best score",
    agents: "Agents",
    noAgents: "This user has no public agents yet.",
    back: "← Back to ranking",
    locale: "en-US",
  },
} as const

export function PerfilPublicoClient({ profile }: { profile: PublicProfile }) {
  const { lang } = useI18n()
  const s = T[lang]

  return (
    <main>
      <div className="breadcrumb-bar">
        <div className="container">
          <Link href="/app" className="breadcrumb-link">
            {s.back}
          </Link>
        </div>
      </div>

      <section className="perfil-header">
        <div className="container perfil-header-inner">
          <div className="perfil-avatar-static">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="perfil-avatar-img" />
            ) : (
              <Avatar name={profile.username} size={64} />
            )}
          </div>
          <div>
            <h1 className="perfil-name">{profile.username}</h1>
            <p className="perfil-email">
              {s.joined} {profile.createdAt.toLocaleDateString(s.locale, { year: "numeric", month: "long" })}
            </p>
            {profile.firstAgent && (
              <div className="perfil-badges">
                <span className="insignia" title={s.badgeFirstDesc}>
                  <span className="insignia-star">★</span>
                  {s.badgeFirst}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="perfil-section">
        <div className="container">
          <div className="pub-stats">
            <div className="pub-stat">
              <span className="pub-stat-num">{profile.stats.agents}</span>
              <span className="pub-stat-label">{s.statAgents}</span>
            </div>
            <div className="pub-stat">
              <span className="pub-stat-num">{profile.stats.totalScore}</span>
              <span className="pub-stat-label">{s.statScore}</span>
            </div>
            <div className="pub-stat">
              <span className="pub-stat-num">{profile.stats.wins}</span>
              <span className="pub-stat-label">{s.statWins}</span>
            </div>
            <div className="pub-stat">
              <span className="pub-stat-num">{profile.stats.bestScore}</span>
              <span className="pub-stat-label">{s.statBest}</span>
            </div>
          </div>
          {profile.bio && <p className="pub-bio">{profile.bio}</p>}
        </div>
      </section>

      <section className="perfil-section perfil-section-sin-tope">
        <div className="container">
          <h2 className="section-title-sm">{s.agents}</h2>
          {profile.agents.length === 0 ? (
            <p className="perfil-muted">{s.noAgents}</p>
          ) : (
            <div className="perfil-agent-list">
              {profile.agents.map((a) => (
                <div className="perfil-agent-row" key={a.id}>
                  <Avatar name={a.name} size={32} />
                  <div className="perfil-agent-info">
                    <Link href={`/agente?id=${a.id}`} className="perfil-agent-name">
                      {a.name}
                    </Link>
                  </div>
                  <span className="pub-agent-score">{`${a.score} pts`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
