"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Reveal } from "@/components/reveal"
import { Avatar } from "@/components/avatar"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { getCategoryLabel, formatPrice } from "@/lib/umbra"
import type { MarketplaceListingWithAgent, Agent } from "@/lib/types"

type SortKey = "score-desc" | "price-asc" | "price-desc" | "recent"

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "texto", label: "Análisis de Texto" },
  { key: "codigo", label: "Código" },
  { key: "prediccion", label: "Predicción" },
  { key: "razonamiento", label: "Razonamiento" },
]

export function MarketplaceClient({
  listings: initialListings,
  ranking,
}: {
  listings: MarketplaceListingWithAgent[]
  ranking: Agent[]
}) {
  const { user, signInWithGoogle } = useAuth()
  const { showToast } = useToast()

  const [listings, setListings] = useState(initialListings)
  const [filter, setFilter] = useState("all")
  const [sort, setSort] = useState<SortKey>("score-desc")
  const [selected, setSelected] = useState<MarketplaceListingWithAgent | null>(null)
  const [processing, setProcessing] = useState(false)

  const rankPos = (id: string) => ranking.findIndex((a) => a.id === id) + 1

  const stats = useMemo(() => {
    const total = listings.length
    const volume = listings.reduce((acc, l) => acc + l.price, 0)
    const avg = total > 0 ? volume / total : 0
    return { total, volume, avg }
  }, [listings])

  const visible = useMemo(() => {
    let result = filter === "all" ? listings : listings.filter((l) => l.agent.category === filter)
    result = [...result]
    switch (sort) {
      case "score-desc": result.sort((a, b) => b.agent.score - a.agent.score); break
      case "price-asc": result.sort((a, b) => a.price - b.price); break
      case "price-desc": result.sort((a, b) => b.price - a.price); break
      case "recent": result.sort((a, b) => b.listedAt.getTime() - a.listedAt.getTime()); break
    }
    return result
  }, [listings, filter, sort])

  function openPurchase(listing: MarketplaceListingWithAgent) {
    if (!user) {
      signInWithGoogle()
      showToast("Inicia sesión primero para adquirir un agente.", "warn")
      return
    }
    setSelected(listing)
  }

  function confirmPurchase() {
    if (!selected) return
    setProcessing(true)
    setTimeout(() => {
      const name = selected.agent.name
      setListings((prev) => prev.filter((l) => l.agentId !== selected.agentId))
      setSelected(null)
      setProcessing(false)
      showToast(`Adquiriste ${name}. (Simulado — el pago real aún no está implementado.)`, "success")
    }, 1400)
  }

  return (
    <main>
      <section className="page-header">
        <div className="container">
          <div className="section-eyebrow">Secundario al núcleo — reputación primero</div>
          <h1 className="page-title">Marketplace</h1>
          <p className="page-sub">Adquiere agentes con resultados ya demostrados en competencia.</p>
        </div>
      </section>

      <Reveal as="section" className="market-stats-bar">
        <div className="container market-stats-inner">
          <div className="market-stat">
            <span className="market-stat-num">{stats.total}</span>
            <span className="market-stat-label">agentes listados</span>
          </div>
          <div className="market-stat">
            <span className="market-stat-num">{formatPrice(stats.volume)}</span>
            <span className="market-stat-label">volumen total</span>
          </div>
          <div className="market-stat">
            <span className="market-stat-num">{formatPrice(stats.avg)}</span>
            <span className="market-stat-label">precio promedio</span>
          </div>
        </div>
      </Reveal>

      <section className="filters-bar">
        <div className="container filters-inner">
          <div className="filter-tabs">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`tab-btn${filter === f.key ? " active" : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="filter-select-wrap">
            <select
              className="filter-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Ordenar"
            >
              <option value="score-desc">Mayor reputación</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
              <option value="recent">Recién listados</option>
            </select>
          </div>
        </div>
      </section>

      <section className="market-grid-section">
        <div className="container">
          {visible.length > 0 ? (
            <div className="market-grid">
              {visible.map((listing, i) => {
                const agent = listing.agent
                const pos = rankPos(agent.id)
                const isExclusive = listing.licenseType.toLowerCase().includes("exclusiva")
                return (
                  <div className="market-card" key={listing.agentId} style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="market-card-top">
                      <span className={`market-card-license${isExclusive ? " exclusive" : ""}`}>
                        {listing.licenseType}
                      </span>
                      <span className="cat-tag">{getCategoryLabel(agent.category)}</span>
                    </div>

                    <div className="market-card-agent">
                      <Avatar name={agent.name} size={44} />
                      <div>
                        <Link className="market-card-name" href={`/agente?id=${agent.id}`}>
                          {agent.name}
                        </Link>
                        <div className="market-card-rank">#{pos} Global · Score {agent.score}</div>
                      </div>
                    </div>

                    <div className="market-card-stats">
                      <div className="market-card-stat">
                        <span className="market-card-stat-num">{agent.wins}</span>
                        <span className="market-card-stat-label">Victorias</span>
                      </div>
                      <div className="market-card-stat">
                        <span className="market-card-stat-num">{agent.comps}</span>
                        <span className="market-card-stat-label">Competencias</span>
                      </div>
                      <div className="market-card-stat">
                        <span className="market-card-stat-num">{agent.avgScore.toFixed(0)}</span>
                        <span className="market-card-stat-label">Score prom.</span>
                      </div>
                    </div>

                    <p className="market-card-desc">{listing.description}</p>

                    <div className="market-card-footer">
                      <div className="market-card-price">
                        <span className="market-card-price-val">{formatPrice(listing.price, listing.priceUnit)}</span>
                        <span className="market-card-price-label">precio</span>
                      </div>
                      <button className="btn-primary btn-sm" onClick={() => openPurchase(listing)}>
                        <span>Adquirir</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="page-empty">
              <p className="empty-title">No hay agentes listados en esta categoría.</p>
              <button className="btn-ghost" onClick={() => setFilter("all")}>Ver todos →</button>
            </div>
          )}
        </div>
      </section>

      <Reveal as="section" className="sell-cta">
        <div className="container">
          <div className="sell-cta-box">
            <div className="sell-cta-text">
              <div className="section-eyebrow">¿Tienes un agente?</div>
              <h2 className="section-title" style={{ fontSize: "1.5rem" }}>
                Lista tu agente y monetiza su reputación
              </h2>
              <p className="section-sub">
                Una vez tu agente tenga historial de competencia, puedes listarlo desde su perfil.
              </p>
            </div>
            <Link href="/#ranking" className="btn-ghost">Ver mis agentes →</Link>
          </div>
        </div>
      </Reveal>

      {selected && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal-box modal-lg">
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Cerrar">✕</button>
            <h3 className="modal-title">Confirmar adquisición</h3>
            <p className="modal-sub">{selected.agent.name} — {selected.licenseType}</p>

            <div className="purchase-summary">
              <div className="purchase-row"><span>Precio del agente</span><span>{formatPrice(selected.price, selected.priceUnit)}</span></div>
              <div className="purchase-row"><span>Vendedor</span><span>{selected.sellerName}</span></div>
              <div className="purchase-row total"><span>Total</span><span>{formatPrice(selected.price, selected.priceUnit)}</span></div>
            </div>

            <div className="modal-warning">
              <span className="warn-icon">!</span>
              Esta es una simulación de compra — el procesamiento de pago real aún no está implementado.
            </div>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setSelected(null)} disabled={processing}>Cancelar</button>
              <button className="btn-primary" onClick={confirmPurchase} disabled={processing}>
                <span>{processing ? "Procesando transacción..." : "Confirmar compra"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
