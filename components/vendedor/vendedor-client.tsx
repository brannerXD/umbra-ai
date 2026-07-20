"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { CircleDollarSign, Download, Package, Users } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/language-provider"
import { getSellerStats } from "@/lib/services"
import { formatTime } from "@/lib/umbra"
import type { SellerStats } from "@/lib/types"
// Textos de la pagina en ambos idiomas.
const T = {
  es: {
    kicker: "Marketplace",
    title: "Panel del vendedor",
    subtitle: "El desempeño de los agentes que has publicado en el marketplace.",
    guest: "Inicia sesión para ver tus métricas de vendedor.",
    signIn: "Iniciar sesión",
    loading: "Cargando tus métricas…",
    emptyTitle: "Aún no tienes agentes publicados en el marketplace.",
    goAgents: "Ir a mis agentes →",
    kpiSales: "Ventas",
    kpiRevenue: "Ingresos",
    kpiDownloads: "Descargas",
    kpiListed: "Publicados",
    salesByAgent: "Ventas por agente",
    noData: "Sin datos todavía.",
    topVersion: "Versión más descargada",
    downloads: "descargas",
    noDownloads: "Aún no hay descargas registradas.",
    buyers: "Compradores",
    noBuyers: "Todavía no tienes compradores.",
    thBuyer: "Comprador",
    thAgent: "Agente",
    thPrice: "Precio",
    thDate: "Fecha",
  },
  en: {
    kicker: "Marketplace",
    title: "Seller dashboard",
    subtitle: "How the agents you published on the marketplace are performing.",
    guest: "Sign in to see your seller metrics.",
    signIn: "Sign in",
    loading: "Loading your metrics…",
    emptyTitle: "You have not published any agent on the marketplace yet.",
    goAgents: "Go to my agents →",
    kpiSales: "Sales",
    kpiRevenue: "Revenue",
    kpiDownloads: "Downloads",
    kpiListed: "Published",
    salesByAgent: "Sales by agent",
    noData: "No data yet.",
    topVersion: "Most downloaded version",
    downloads: "downloads",
    noDownloads: "No downloads recorded yet.",
    buyers: "Buyers",
    noBuyers: "You have no buyers yet.",
    thBuyer: "Buyer",
    thAgent: "Agent",
    thPrice: "Price",
    thDate: "Date",
  },
} as const


export function VendedorClient() {
  const { user, loading: authLoading, openAuth } = useAuth()
  const { lang } = useI18n()
  const s = T[lang]
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<SellerStats | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    getSellerStats().then((s) => {
      setStats(s)
      setLoading(false)
    })
  }, [authLoading, user])

  const money = (n: number) => `$${n.toLocaleString("es-CO")}`
  const maxSales = stats ? Math.max(1, ...stats.salesByAgent.map((s) => s.value)) : 1

  if (!authLoading && !user) {
    return (
      <main className="vendedor">
        <div className="container vendedor-inner">
          <header className="vendedor-head">
            <p className="vendedor-kicker">{s.kicker}</p>
            <h1 className="vendedor-title">{s.title}</h1>
          </header>
          <div className="vendedor-empty">
            <p>{s.guest}</p>
            <button className="btn-primary" onClick={() => openAuth("signin")}><span>{s.signIn}</span></button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="vendedor">
      <div className="container vendedor-inner">
        <header className="vendedor-head">
          <p className="vendedor-kicker">{s.kicker}</p>
          <h1 className="vendedor-title">{s.title}</h1>
          <p className="vendedor-subtitle">{s.subtitle}</p>
        </header>

        {loading ? (
          <div className="vendedor-empty"><p>{s.loading}</p></div>
        ) : !stats || stats.listingsTotal === 0 ? (
          <div className="vendedor-empty">
            <p>{s.emptyTitle}</p>
            <Link href="/app#ranking" className="btn-primary"><span>{s.goAgents}</span></Link>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="vendedor-kpis">
              <div className="vendedor-kpi">
                <Package className="vendedor-kpi-icon" aria-hidden />
                <span className="vendedor-kpi-num">{stats.salesTotal}</span>
                <span className="vendedor-kpi-label">{s.kpiSales}</span>
              </div>
              <div className="vendedor-kpi">
                <CircleDollarSign className="vendedor-kpi-icon" aria-hidden />
                <span className="vendedor-kpi-num">{money(stats.revenueTotal)}</span>
                <span className="vendedor-kpi-label">{s.kpiRevenue}</span>
              </div>
              <div className="vendedor-kpi">
                <Download className="vendedor-kpi-icon" aria-hidden />
                <span className="vendedor-kpi-num">{stats.downloadsTotal}</span>
                <span className="vendedor-kpi-label">{s.kpiDownloads}</span>
              </div>
              <div className="vendedor-kpi">
                <Users className="vendedor-kpi-icon" aria-hidden />
                <span className="vendedor-kpi-num">{stats.listingsTotal}</span>
                <span className="vendedor-kpi-label">{s.kpiListed}</span>
              </div>
            </div>

            <div className="vendedor-cols">
              {/* Ventas por agente */}
              <section className="vendedor-panel">
                <h2 className="vendedor-panel-title">{s.salesByAgent}</h2>
                {stats.salesByAgent.length === 0 ? (
                  <p className="vendedor-muted">{s.noData}</p>
                ) : (
                  <div className="vendedor-bars">
                    {stats.salesByAgent.map((s) => (
                      <div key={s.label} className="vendedor-bar-row">
                        <span className="vendedor-bar-label">{s.label}</span>
                        <div className="vendedor-bar-track">
                          <div className="vendedor-bar-fill" style={{ width: `${(s.value / maxSales) * 100}%` }} />
                        </div>
                        <span className="vendedor-bar-val">{s.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Versión más descargada */}
              <section className="vendedor-panel vendedor-panel-top">
                <h2 className="vendedor-panel-title">{s.topVersion}</h2>
                {stats.topVersion ? (
                  <div className="vendedor-topver">
                    <span className="vendedor-topver-num">{stats.topVersion.version}</span>
                    <span className="vendedor-topver-sub">{stats.topVersion.downloads} {s.downloads}</span>
                  </div>
                ) : (
                  <p className="vendedor-muted">{s.noDownloads}</p>
                )}
              </section>
            </div>

            {/* Compradores */}
            <section className="vendedor-panel">
              <h2 className="vendedor-panel-title">{s.buyers}</h2>
              {stats.buyers.length === 0 ? (
                <p className="vendedor-muted">{s.noBuyers}</p>
              ) : (
                <div className="vendedor-table">
                  <div className="vendedor-tr vendedor-th">
                    <span>{s.thBuyer}</span>
                    <span>{s.thAgent}</span>
                    <span>{s.thPrice}</span>
                    <span>{s.thDate}</span>
                  </div>
                  {stats.buyers.map((b, i) => (
                    <div key={i} className="vendedor-tr">
                      <span className="vendedor-td-strong">{b.buyer}</span>
                      <span>{b.agent}</span>
                      <span>{money(Number(b.price))} {b.priceUnit}</span>
                      <span className="vendedor-muted">{formatTime(b.at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
