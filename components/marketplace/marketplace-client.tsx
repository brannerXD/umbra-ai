"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Reveal } from "@/components/reveal"
import { Avatar } from "@/components/avatar"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { getCategoryLabel, formatListingPrice, getBillingLabel } from "@/lib/umbra"
import { getCodeDownloadUrl, getPurchasedListingIds, purchaseListing } from "@/lib/services"
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

  const [listings] = useState(initialListings)
  const [filter, setFilter] = useState("all")
  const [sort, setSort] = useState<SortKey>("score-desc")
  const [selected, setSelected] = useState<MarketplaceListingWithAgent | null>(null)
  const [processing, setProcessing] = useState(false)
  const [buyAccepted, setBuyAccepted] = useState(false)
  const [purchasedIds, setPurchasedIds] = useState<string[]>([])

  // Qué ya compró este usuario (habilita la descarga del código / marca el acceso activo).
  useEffect(() => {
    if (!user) {
      setPurchasedIds([])
      return
    }
    let active = true
    getPurchasedListingIds(user.id).then((ids) => {
      if (active) setPurchasedIds(ids)
    })
    return () => {
      active = false
    }
  }, [user])

  const rankPos = (id: string) => ranking.findIndex((a) => a.id === id) + 1

  const stats = useMemo(() => {
    const total = listings.length
    const access = listings.filter((l) => l.listingType === "acceso").length
    const code = listings.filter((l) => l.listingType === "codigo").length
    return { total, access, code }
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
    setBuyAccepted(false)
    setSelected(listing)
  }

  async function confirmPurchase() {
    if (!selected || !user) return
    setProcessing(true)
    // Sin cobro real todavía, pero la compra sí se registra: es lo que habilita
    // la descarga del código (la RLS del bucket privado la exige).
    const ok = await purchaseListing({
      listingId: selected.listingId,
      buyerId: user.id,
      price: selected.price,
      priceUnit: selected.priceUnit,
    })
    setProcessing(false)
    if (!ok) {
      showToast("No se pudo completar. Intenta de nuevo.", "warn")
      return
    }
    const { agent, listingType, listingId } = selected
    // El acceso es NO exclusivo: el listado sigue disponible para otros compradores.
    setPurchasedIds((prev) => (prev.includes(listingId) ? prev : [...prev, listingId]))
    setSelected(null)
    showToast(
      listingType === "codigo"
        ? `Compraste el código de ${agent.name}. Ya puedes descargarlo. (Cobro simulado.)`
        : `Acceso a ${agent.name} activado. (Cobro simulado.)`,
      "success",
    )
  }

  async function downloadCode(listing: MarketplaceListingWithAgent) {
    if (!listing.codePath) return
    const url = await getCodeDownloadUrl(listing.codePath)
    if (!url) {
      showToast("No se pudo generar el enlace de descarga.", "warn")
      return
    }
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <main>
      <section className="page-header">
        <div className="container">
          <div className="section-eyebrow">Secundario al núcleo — reputación primero</div>
          <h1 className="page-title">Marketplace</h1>
          <p className="page-sub">
            Usa agentes con reputación demostrada en competencia — a través de una sola API.
          </p>
        </div>
      </section>

      <Reveal as="section" className="market-stats-bar">
        <div className="container market-stats-inner">
          <div className="market-stat">
            <span className="market-stat-num">{stats.total}</span>
            <span className="market-stat-label">agentes disponibles</span>
          </div>
          <div className="market-stat">
            <span className="market-stat-num">{stats.access}</span>
            <span className="market-stat-label">acceso vía API</span>
          </div>
          <div className="market-stat">
            <span className="market-stat-num">{stats.code}</span>
            <span className="market-stat-label">código a la venta</span>
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
                const isSubscription = listing.billingModel === "mensual"
                const isCode = listing.listingType === "codigo"
                const purchased = purchasedIds.includes(listing.listingId)
                return (
                  <div className="market-card" key={listing.agentId} style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="market-card-top">
                      <span
                        className={`market-card-license${isCode ? " code" : isSubscription ? " subscription" : ""}`}
                      >
                        {isCode ? `Código · ${listing.codeLicense}` : getBillingLabel(listing.billingModel)}
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
                        <span className="market-card-price-val">
                          {formatListingPrice(listing.price, listing.priceUnit, listing.billingModel)}
                        </span>
                        <span className="market-card-price-label">
                          {isCode ? "descarga única" : "acceso vía API"}
                        </span>
                      </div>
                      {purchased && isCode ? (
                        <button className="btn-primary btn-sm" onClick={() => downloadCode(listing)}>
                          <span>Descargar</span>
                        </button>
                      ) : purchased ? (
                        <button className="btn-ghost btn-sm" disabled>
                          <span>Activo</span>
                        </button>
                      ) : (
                        <button className="btn-primary btn-sm" onClick={() => openPurchase(listing)}>
                          <span>{isCode ? "Comprar código" : "Obtener acceso"}</span>
                        </button>
                      )}
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
                Publica tu agente y monetiza su reputación
              </h2>
              <p className="section-sub">
                Cobra por suscripción o por uso. Tú lo sigues hospedando; Umbra cobra y te transfiere.
              </p>
            </div>
            <Link href="/app#ranking" className="btn-ghost">Ver mis agentes →</Link>
          </div>
        </div>
      </Reveal>

      {selected && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal-box modal-lg">
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Cerrar">✕</button>
            <h3 className="modal-title">
              {selected.listingType === "codigo" ? "Comprar código" : "Obtener acceso"}
            </h3>
            <p className="modal-sub">
              {selected.agent.name} —{" "}
              {selected.listingType === "codigo"
                ? `Licencia ${selected.codeLicense}`
                : getBillingLabel(selected.billingModel)}
            </p>

            <div className="purchase-summary">
              <div className="purchase-row">
                <span>Precio</span>
                <span>{formatListingPrice(selected.price, selected.priceUnit, selected.billingModel)}</span>
              </div>
              <div className="purchase-row"><span>Creador</span><span>{selected.sellerName}</span></div>
              <div className="purchase-row total">
                <span>Recibes</span>
                <span>
                  {selected.listingType === "codigo" ? "Descarga del código" : "Acceso vía API de Umbra"}
                </span>
              </div>
            </div>

            <p className="modal-sub">
              {selected.listingType === "codigo" ? (
                <>
                  Descargarás el código completo de {selected.agent.name} bajo licencia{" "}
                  <strong>{selected.codeLicense}</strong> y lo corres donde quieras.{" "}
                  <strong>No hereda la reputación</strong>: esa la ganó el despliegue del creador, no el
                  archivo. Si quieres reputación, registra tu agente y compite.
                </>
              ) : (
                <>
                  Recibirás una llave para llamar a {selected.agent.name} desde la API de Umbra. El acceso es{" "}
                  <strong>no exclusivo</strong>: el creador sigue hospedando el agente y otros también pueden
                  usarlo.
                </>
              )}
            </p>

            <div className="modal-warning">
              <span className="warn-icon">!</span>
              {selected.listingType === "codigo"
                ? "El cobro aún no está habilitado: por ahora la descarga se otorga sin pago real."
                : "Simulación — el cobro y la entrega de llaves aún no están habilitados."}
            </div>

            <label className="consent-check">
              <input
                type="checkbox"
                checked={buyAccepted}
                onChange={(e) => setBuyAccepted(e.target.checked)}
              />
              <span>
                Acepto los{" "}
                <Link href="/terminos#compradores" target="_blank">
                  Términos del Marketplace para compradores
                </Link>{" "}
                {selected.listingType === "codigo"
                  ? " y entiendo que la descarga no es reembolsable ni transfiere reputación."
                  : " y entiendo que el acceso es no exclusivo."}
              </span>
            </label>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setSelected(null)} disabled={processing}>Cancelar</button>
              <button className="btn-primary" onClick={confirmPurchase} disabled={processing || !buyAccepted}>
                <span>
                  {processing
                    ? "Procesando..."
                    : selected.listingType === "codigo"
                      ? "Confirmar compra"
                      : "Confirmar acceso"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
