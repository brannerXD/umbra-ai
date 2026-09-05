"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Reveal } from "@/components/reveal"
import { Avatar } from "@/components/avatar"
import { useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/language-provider"
import { useToast } from "@/components/toast-provider"
import { getCategoryLabel, formatListingPrice, getBillingLabel } from "@/lib/umbra"
import { getAgentVersions, getCodeDownloadUrl, getPurchasedListingIds, iniciarCompra } from "@/lib/services"
import { safeExternalUrl } from "@/lib/utils"
import type { AgentVersion, MarketplaceListingWithAgent, Agent } from "@/lib/types"

type SortKey = "score-desc" | "price-asc" | "price-desc" | "recent"

const FILTER_KEYS = ["all", "texto", "codigo", "prediccion", "razonamiento"] as const

// Secciones por modalidad de venta.
type SaleType = "all" | "codigo" | "acceso"
const TYPE_KEYS: SaleType[] = ["all", "codigo", "acceso"]

// Textos de la página en ambos idiomas.
const T = {
  es: {
    eyebrow: "Secundario al núcleo — reputación primero",
    title: "Marketplace",
    sub: "Usa agentes con reputación demostrada en competencia — a través de una sola API.",
    statAvailable: "agentes disponibles",
    statApi: "acceso vía API",
    statCode: "código a la venta",
    types: {
      all: { label: "Todos", hint: "Licencias por URL y agentes completos" },
      codigo: { label: "Agentes Completos", hint: "Compra el código fuente y ejecútalo tú" },
      acceso: { label: "Licencias", hint: "Usa el agente vía la API de Umbra" },
    },
    filters: {
      all: "Todos",
      texto: "Análisis de Texto",
      codigo: "Código",
      prediccion: "Predicción",
      razonamiento: "Razonamiento",
    },
    sortLabel: "Ordenar",
    sortScore: "Mayor reputación",
    sortPriceAsc: "Precio: menor a mayor",
    sortPriceDesc: "Precio: mayor a menor",
    sortRecent: "Recién listados",
    codePrefix: "Código",
    global: "Global · Score",
    wins: "Victorias",
    comps: "Competencias",
    avgScore: "Score prom.",
    priceOneTime: "descarga única",
    priceApi: "acceso vía API",
    buyCode: "Comprar código",
    getAccess: "Obtener acceso",
    download: "Descargar",
    active: "Activo",
    details: "Ver detalles →",
    emptyCode: "Todavía no hay agentes completos en esta categoría.",
    emptyLicense: "Todavía no hay licencias en esta categoría.",
    emptyAll: "No hay agentes listados en esta categoría.",
    seeAll: "Ver todos →",
    sellEyebrow: "¿Tienes un agente?",
    sellTitle: "Publica tu agente y monetiza su reputación",
    sellSub: "Cobra por suscripción o por uso. Tú lo sigues hospedando; Umbra cobra y te transfiere.",
    sellBtn: "Ver mis agentes →",
    // Ficha pública
    dComplete: "Agente Completo",
    dLicense: "Licencia por URL",
    dLicenseLabel: "Licencia:",
    dRepo: "Repositorio ↗",
    dWins: "victorias",
    tabReadme: "README",
    tabDocs: "Documentación",
    tabDeps: "Dependencias",
    tabVersions: "Versiones",
    noReadme: "Este agente no incluye README.",
    noDocs: "Sin documentación adicional.",
    noDeps: "No se especificaron dependencias.",
    loadingVersions: "Cargando versiones…",
    // Modal de compra
    pPrice: "Precio",
    pCreator: "Creador",
    pYouGet: "Recibes",
    pCodeDownload: "Descarga del código",
    pApiAccess: "Acceso vía API de Umbra",
    pCodeA: "Descargarás el código completo de ",
    pCodeB: " bajo licencia ",
    pCodeC: " y lo corres donde quieras. ",
    pCodeD: "No hereda la reputación",
    pCodeE: ": esa la ganó el despliegue del creador, no el archivo. Si quieres reputación, registra tu agente y compite.",
    pAccessA: "Recibirás una llave para llamar a ",
    pAccessB: " desde la API de Umbra. El acceso es ",
    pAccessC: "no exclusivo",
    pAccessD: ": el creador sigue hospedando el agente y otros también pueden usarlo.",
    pWarnCode: "El cobro aún no está habilitado: por ahora la descarga se otorga sin pago real.",
    pWarnAccess: "Simulación — el cobro y la entrega de llaves aún no están habilitados.",
    pConsentA: "Acepto los ",
    pConsentLink: "Términos del Marketplace para compradores",
    pConsentCode: " y entiendo que la descarga no es reembolsable ni transfiere reputación.",
    pConsentAccess: " y entiendo que el acceso es no exclusivo.",
    pCancel: "Cancelar",
    pProcessing: "Procesando...",
    pConfirmBuy: "Confirmar compra",
    pConfirmAccess: "Confirmar acceso",
    // Avisos
    toastSignIn: "Inicia sesión primero para adquirir un agente.",
    toastFailed: "No se pudo completar. Intenta de nuevo.",
    toastBoughtCodeA: "Compraste el código de ",
    toastBoughtCodeB: ". Ya puedes descargarlo. (Cobro simulado.)",
    toastAccessA: "Acceso a ",
    toastAccessB: " activado. (Cobro simulado.)",
    toastNoLink: "No se pudo generar el enlace de descarga.",
  },
  en: {
    eyebrow: "Secondary to the core — reputation first",
    title: "Marketplace",
    sub: "Use agents with reputation proven in competition — through a single API.",
    statAvailable: "agents available",
    statApi: "API access",
    statCode: "code for sale",
    types: {
      all: { label: "All", hint: "URL licenses and complete agents" },
      codigo: { label: "Complete Agents", hint: "Buy the source code and run it yourself" },
      acceso: { label: "Licenses", hint: "Use the agent via the Umbra API" },
    },
    filters: {
      all: "All",
      texto: "Text Analysis",
      codigo: "Code",
      prediccion: "Prediction",
      razonamiento: "Reasoning",
    },
    sortLabel: "Sort",
    sortScore: "Highest reputation",
    sortPriceAsc: "Price: low to high",
    sortPriceDesc: "Price: high to low",
    sortRecent: "Recently listed",
    codePrefix: "Code",
    global: "Global · Score",
    wins: "Wins",
    comps: "Competitions",
    avgScore: "Avg. score",
    priceOneTime: "one-time download",
    priceApi: "API access",
    buyCode: "Buy code",
    getAccess: "Get access",
    download: "Download",
    active: "Active",
    details: "View details →",
    emptyCode: "There are no complete agents in this category yet.",
    emptyLicense: "There are no licenses in this category yet.",
    emptyAll: "There are no agents listed in this category.",
    seeAll: "See all →",
    sellEyebrow: "Have an agent?",
    sellTitle: "Publish your agent and monetize its reputation",
    sellSub: "Charge by subscription or usage. You keep hosting it; Umbra charges and transfers to you.",
    sellBtn: "See my agents →",
    dComplete: "Complete Agent",
    dLicense: "URL License",
    dLicenseLabel: "License:",
    dRepo: "Repository ↗",
    dWins: "wins",
    tabReadme: "README",
    tabDocs: "Documentation",
    tabDeps: "Dependencies",
    tabVersions: "Versions",
    noReadme: "This agent does not include a README.",
    noDocs: "No additional documentation.",
    noDeps: "No dependencies were specified.",
    loadingVersions: "Loading versions…",
    pPrice: "Price",
    pCreator: "Creator",
    pYouGet: "You get",
    pCodeDownload: "Code download",
    pApiAccess: "Access via the Umbra API",
    pCodeA: "You will download the complete code of ",
    pCodeB: " under the ",
    pCodeC: " license and run it wherever you want. ",
    pCodeD: "It does not inherit the reputation",
    pCodeE: ": that was earned by the creator's deployment, not by the file. If you want reputation, register your agent and compete.",
    pAccessA: "You will receive a key to call ",
    pAccessB: " from the Umbra API. The access is ",
    pAccessC: "non-exclusive",
    pAccessD: ": the creator keeps hosting the agent and others can use it too.",
    pWarnCode: "Charging is not enabled yet: for now the download is granted without a real payment.",
    pWarnAccess: "Simulation — charging and key delivery are not enabled yet.",
    pConsentA: "I accept the ",
    pConsentLink: "Marketplace Terms for buyers",
    pConsentCode: " and understand the download is non-refundable and does not transfer reputation.",
    pConsentAccess: " and understand the access is non-exclusive.",
    pCancel: "Cancel",
    pProcessing: "Processing...",
    pConfirmBuy: "Confirm purchase",
    pConfirmAccess: "Confirm access",
    toastSignIn: "Sign in first to acquire an agent.",
    toastFailed: "Couldn't complete it. Please try again.",
    toastBoughtCodeA: "You bought the code for ",
    toastBoughtCodeB: ". You can download it now. (Simulated charge.)",
    toastAccessA: "Access to ",
    toastAccessB: " activated. (Simulated charge.)",
    toastNoLink: "Couldn't generate the download link.",
  },
} as const

export function MarketplaceClient({
  listings: initialListings,
  ranking,
}: {
  listings: MarketplaceListingWithAgent[]
  ranking: Agent[]
}) {
  const { user, openAuth } = useAuth()
  const { showToast } = useToast()
  const { lang } = useI18n()
  const s = T[lang]

  const [listings] = useState(initialListings)
  const [typeFilter, setTypeFilter] = useState<SaleType>("all")
  const [filter, setFilter] = useState("all")
  const [sort, setSort] = useState<SortKey>("score-desc")
  const [selected, setSelected] = useState<MarketplaceListingWithAgent | null>(null)
  const [processing, setProcessing] = useState(false)
  const [buyAccepted, setBuyAccepted] = useState(false)
  const [purchasedIds, setPurchasedIds] = useState<string[]>([])
  // Ficha pública "Ver detalles"
  const [details, setDetails] = useState<MarketplaceListingWithAgent | null>(null)
  const [detailsTab, setDetailsTab] = useState<"readme" | "docs" | "deps" | "versiones">("readme")
  const [detailVersions, setDetailVersions] = useState<AgentVersion[]>([])

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
    let result = [...listings]
    if (typeFilter !== "all") result = result.filter((l) => l.listingType === typeFilter)
    if (filter !== "all") result = result.filter((l) => l.agent.category === filter)
    switch (sort) {
      case "score-desc": result.sort((a, b) => b.agent.score - a.agent.score); break
      case "price-asc": result.sort((a, b) => a.price - b.price); break
      case "price-desc": result.sort((a, b) => b.price - a.price); break
      case "recent": result.sort((a, b) => b.listedAt.getTime() - a.listedAt.getTime()); break
    }
    return result
  }, [listings, typeFilter, filter, sort])

  function openPurchase(listing: MarketplaceListingWithAgent) {
    if (!user) {
      openAuth("signin")
      showToast(s.toastSignIn, "warn")
      return
    }
    setBuyAccepted(false)
    setSelected(listing)
  }

  // Ficha pública: se puede ver todo (imagen, README, tecnologías, dependencias)
  // ANTES de comprar. El ZIP nunca se expone aquí; eso requiere la compra.
  function openDetails(listing: MarketplaceListingWithAgent) {
    setDetailsTab(listing.listingType === "codigo" ? "readme" : "docs")
    setDetailVersions([])
    setDetails(listing)
    if (listing.listingType === "codigo") {
      getAgentVersions(listing.listingId).then(setDetailVersions)
    }
  }

  function buyFromDetails() {
    if (!details) return
    const listing = details
    setDetails(null)
    openPurchase(listing)
  }

  async function confirmPurchase() {
    if (!selected || !user) return
    setProcessing(true)
    // Para el código, registramos qué versión se compró (la última publicada).
    let versionId: string | null = null
    if (selected.listingType === "codigo") {
      const versions = await getAgentVersions(selected.listingId)
      versionId = versions[0]?.id ?? null
    }
    // La compra la crea el SERVIDOR y solo se completa cuando la pasarela
    // confirma el pago. Aqui solo se pide la URL y se envia al comprador.
    const res = await iniciarCompra({ listingId: selected.listingId, versionId })
    setProcessing(false)
    if (!res.ok) {
      showToast(res.message || s.toastFailed, "warn")
      return
    }
    // Mercado Pago devuelve al comprador a /mis-compras cuando termina.
    window.location.href = res.url
  }

  async function downloadCode(listing: MarketplaceListingWithAgent) {
    if (!listing.codePath) return
    const url = await getCodeDownloadUrl(listing.codePath, { listingId: listing.listingId })
    if (!url) {
      showToast(s.toastNoLink, "warn")
      return
    }
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <main>
      <section className="page-header">
        <div className="container">
          <div className="section-eyebrow">{s.eyebrow}</div>
          <h1 className="page-title">{s.title}</h1>
          <p className="page-sub">{s.sub}</p>
        </div>
      </section>

      <Reveal as="section" className="market-stats-bar">
        <div className="container market-stats-inner">
          <div className="market-stat">
            <span className="market-stat-num">{stats.total}</span>
            <span className="market-stat-label">{s.statAvailable}</span>
          </div>
          <div className="market-stat">
            <span className="market-stat-num">{stats.access}</span>
            <span className="market-stat-label">{s.statApi}</span>
          </div>
          <div className="market-stat">
            <span className="market-stat-num">{stats.code}</span>
            <span className="market-stat-label">{s.statCode}</span>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="market-type-bar">
        <div className="container">
          <div className="market-type-seg" role="tablist" aria-label={s.sortLabel}>
            {TYPE_KEYS.map((key) => {
              const count = key === "all" ? stats.total : key === "codigo" ? stats.code : stats.access
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={typeFilter === key}
                  className={`market-type-opt${typeFilter === key ? " active" : ""}`}
                  onClick={() => setTypeFilter(key)}
                >
                  <span className="market-type-opt-label">{s.types[key].label}</span>
                  <span className="market-type-opt-count">{count}</span>
                  <span className="market-type-opt-hint">{s.types[key].hint}</span>
                </button>
              )
            })}
          </div>
        </div>
      </Reveal>

      <section className="filters-bar">
        <div className="container filters-inner">
          <div className="filter-tabs">
            {FILTER_KEYS.map((key) => (
              <button
                key={key}
                className={`tab-btn${filter === key ? " active" : ""}`}
                onClick={() => setFilter(key)}
              >
                {s.filters[key]}
              </button>
            ))}
          </div>
          <div className="filter-select-wrap">
            <select
              className="filter-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label={s.sortLabel}
            >
              <option value="score-desc">{s.sortScore}</option>
              <option value="price-asc">{s.sortPriceAsc}</option>
              <option value="price-desc">{s.sortPriceDesc}</option>
              <option value="recent">{s.sortRecent}</option>
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
                        {isCode ? `${s.codePrefix} · ${listing.codeLicense}` : getBillingLabel(listing.billingModel)}
                      </span>
                      <span className="cat-tag">{getCategoryLabel(agent.category)}</span>
                    </div>

                    <div className="market-card-agent">
                      {listing.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={listing.imageUrl} alt="" className="market-card-img" />
                      ) : (
                        <Avatar name={agent.name} size={44} />
                      )}
                      <div>
                        <Link className="market-card-name" href={`/agente?id=${agent.id}`}>
                          {agent.name}
                        </Link>
                        <div className="market-card-rank">#{pos} {s.global} {agent.score}</div>
                      </div>
                    </div>

                    <div className="market-card-stats">
                      <div className="market-card-stat">
                        <span className="market-card-stat-num">{agent.wins}</span>
                        <span className="market-card-stat-label">{s.wins}</span>
                      </div>
                      <div className="market-card-stat">
                        <span className="market-card-stat-num">{agent.comps}</span>
                        <span className="market-card-stat-label">{s.comps}</span>
                      </div>
                      <div className="market-card-stat">
                        <span className="market-card-stat-num">{agent.avgScore.toFixed(0)}</span>
                        <span className="market-card-stat-label">{s.avgScore}</span>
                      </div>
                    </div>

                    <p className="market-card-desc">{listing.description}</p>

                    <button className="market-card-details" onClick={() => openDetails(listing)}>
                      {s.details}
                    </button>

                    <div className="market-card-footer">
                      <div className="market-card-price">
                        <span className="market-card-price-val">
                          {formatListingPrice(listing.price, listing.priceUnit, listing.billingModel)}
                        </span>
                        <span className="market-card-price-label">
                          {isCode ? s.priceOneTime : s.priceApi}
                        </span>
                      </div>
                      {purchased && isCode ? (
                        <button className="btn-primary btn-sm" onClick={() => downloadCode(listing)}>
                          <span>{s.download}</span>
                        </button>
                      ) : purchased ? (
                        <button className="btn-ghost btn-sm" disabled>
                          <span>{s.active}</span>
                        </button>
                      ) : (
                        <button className="btn-primary btn-sm" onClick={() => openPurchase(listing)}>
                          <span>{isCode ? s.buyCode : s.getAccess}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="page-empty">
              <p className="empty-title">
                {typeFilter === "codigo" ? s.emptyCode : typeFilter === "acceso" ? s.emptyLicense : s.emptyAll}
              </p>
              <button
                className="btn-ghost"
                onClick={() => {
                  setTypeFilter("all")
                  setFilter("all")
                }}
              >
                {s.seeAll}
              </button>
            </div>
          )}
        </div>
      </section>

      <Reveal as="section" className="sell-cta">
        <div className="container">
          <div className="sell-cta-box">
            <div className="sell-cta-text">
              <div className="section-eyebrow">{s.sellEyebrow}</div>
              <h2 className="section-title" style={{ fontSize: "1.5rem" }}>{s.sellTitle}</h2>
              <p className="section-sub">{s.sellSub}</p>
            </div>
            <Link href="/app#ranking" className="btn-ghost">{s.sellBtn}</Link>
          </div>
        </div>
      </Reveal>

      {/* Ficha pública — evaluar antes de comprar */}
      {details && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setDetails(null)}>
          <div className="modal-box detail-modal">
            <button className="modal-close" onClick={() => setDetails(null)} aria-label="Cerrar">✕</button>

            <div className="detail-head">
              {details.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={details.imageUrl} alt="" className="detail-img" />
              ) : (
                <div className="detail-img detail-img-fallback">{details.agent.name.slice(0, 2).toUpperCase()}</div>
              )}
              <div className="detail-head-info">
                <h3 className="modal-title" style={{ marginBottom: 4 }}>{details.agent.name}</h3>
                <div className="detail-head-meta">
                  <span className={`detail-badge${details.listingType === "codigo" ? " code" : ""}`}>
                    {details.listingType === "codigo" ? s.dComplete : s.dLicense}
                  </span>
                  <span className="cat-tag">{getCategoryLabel(details.agent.category)}</span>
                </div>
                <div className="detail-head-rank">
                  #{rankPos(details.agent.id)} {s.global} {details.agent.score} · {details.agent.wins} {s.dWins}
                </div>
              </div>
            </div>

            <p className="detail-desc">{details.description}</p>

            {details.listingType === "codigo" && details.technologies && details.technologies.length > 0 && (
              <div className="detail-tags">
                {details.technologies.map((t) => <span key={t} className="detail-tag">{t}</span>)}
              </div>
            )}
            {details.listingType === "acceso" && details.compatibleModels && details.compatibleModels.length > 0 && (
              <div className="detail-tags">
                {details.compatibleModels.map((m) => <span key={m} className="detail-tag">{m}</span>)}
              </div>
            )}
            {details.listingType === "codigo" && (
              <div className="detail-facts">
                {details.codeLicense && <span>{s.dLicenseLabel} <strong>{details.codeLicense}</strong></span>}
                {safeExternalUrl(details.gitRepo) && (
                  <a href={safeExternalUrl(details.gitRepo)} target="_blank" rel="noopener noreferrer" className="detail-repo">{s.dRepo}</a>
                )}
              </div>
            )}

            {/* Pestañas de contenido público (el ZIP NO se expone aquí) */}
            {(() => {
              const tabs: [typeof detailsTab, string][] =
                details.listingType === "codigo"
                  ? [["readme", s.tabReadme], ["docs", s.tabDocs], ["deps", s.tabDeps], ["versiones", s.tabVersions]]
                  : [["docs", s.tabDocs]]
              return (
                <>
                  <div className="detail-tabs">
                    {tabs.map(([key, label]) => (
                      <button
                        key={key}
                        className={`detail-tab${detailsTab === key ? " active" : ""}`}
                        onClick={() => setDetailsTab(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="detail-tab-body">
                    {detailsTab === "readme" && (
                      <pre className="detail-doc">{details.readme || s.noReadme}</pre>
                    )}
                    {detailsTab === "docs" && (
                      <pre className="detail-doc">{details.documentation || s.noDocs}</pre>
                    )}
                    {detailsTab === "deps" && (
                      <pre className="detail-doc">{details.dependencies || s.noDeps}</pre>
                    )}
                    {detailsTab === "versiones" && (
                      <div className="detail-versions">
                        {detailVersions.length === 0 ? (
                          <p className="detail-doc">{s.loadingVersions}</p>
                        ) : (
                          detailVersions.map((v) => (
                            <div key={v.id} className="detail-version-row">
                              <span className="detail-version-name">{v.version}</span>
                              {v.changelog && <span className="detail-version-log">{v.changelog}</span>}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </>
              )
            })()}

            <div className="detail-foot">
              <div className="market-card-price">
                <span className="market-card-price-val">
                  {formatListingPrice(details.price, details.priceUnit, details.billingModel)}
                </span>
                <span className="market-card-price-label">
                  {details.listingType === "codigo" ? s.priceOneTime : s.priceApi}
                </span>
              </div>
              {purchasedIds.includes(details.listingId) && details.listingType === "codigo" ? (
                <button className="btn-primary" onClick={() => downloadCode(details)}><span>{s.download}</span></button>
              ) : purchasedIds.includes(details.listingId) ? (
                <button className="btn-ghost" disabled><span>{s.active}</span></button>
              ) : (
                <button className="btn-primary" onClick={buyFromDetails}>
                  <span>{details.listingType === "codigo" ? s.buyCode : s.getAccess}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal-box modal-lg">
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Cerrar">✕</button>
            <h3 className="modal-title">
              {selected.listingType === "codigo" ? s.buyCode : s.getAccess}
            </h3>
            <p className="modal-sub">
              {selected.agent.name} —{" "}
              {selected.listingType === "codigo"
                ? `${s.dLicenseLabel} ${selected.codeLicense}`
                : getBillingLabel(selected.billingModel)}
            </p>

            <div className="purchase-summary">
              <div className="purchase-row">
                <span>{s.pPrice}</span>
                <span>{formatListingPrice(selected.price, selected.priceUnit, selected.billingModel)}</span>
              </div>
              <div className="purchase-row"><span>{s.pCreator}</span><span>{selected.sellerName}</span></div>
              <div className="purchase-row total">
                <span>{s.pYouGet}</span>
                <span>
                  {selected.listingType === "codigo" ? s.pCodeDownload : s.pApiAccess}
                </span>
              </div>
            </div>

            <p className="modal-sub">
              {selected.listingType === "codigo" ? (
                <>
                  {s.pCodeA}{selected.agent.name}{s.pCodeB}
                  <strong>{selected.codeLicense}</strong>{s.pCodeC}
                  <strong>{s.pCodeD}</strong>{s.pCodeE}
                </>
              ) : (
                <>
                  {s.pAccessA}{selected.agent.name}{s.pAccessB}
                  <strong>{s.pAccessC}</strong>{s.pAccessD}
                </>
              )}
            </p>

            <div className="modal-warning">
              <span className="warn-icon">!</span>
              {selected.listingType === "codigo" ? s.pWarnCode : s.pWarnAccess}
            </div>

            <label className="consent-check">
              <input
                type="checkbox"
                checked={buyAccepted}
                onChange={(e) => setBuyAccepted(e.target.checked)}
              />
              <span>
                {s.pConsentA}
                <Link href="/terminos#compradores" target="_blank">
                  {s.pConsentLink}
                </Link>
                {selected.listingType === "codigo" ? s.pConsentCode : s.pConsentAccess}
              </span>
            </label>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setSelected(null)} disabled={processing}>{s.pCancel}</button>
              <button className="btn-primary" onClick={confirmPurchase} disabled={processing || !buyAccepted}>
                <span>
                  {processing ? s.pProcessing : selected.listingType === "codigo" ? s.pConfirmBuy : s.pConfirmAccess}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
