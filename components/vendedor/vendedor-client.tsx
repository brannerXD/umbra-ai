"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { CircleDollarSign, Download, Package, Users } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { getSellerStats } from "@/lib/services"
import { formatTime } from "@/lib/umbra"
import type { SellerStats } from "@/lib/types"

export function VendedorClient() {
  const { user, loading: authLoading, openAuth } = useAuth()
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
            <p className="vendedor-kicker">Marketplace</p>
            <h1 className="vendedor-title">Panel del vendedor</h1>
          </header>
          <div className="vendedor-empty">
            <p>Inicia sesión para ver tus métricas de vendedor.</p>
            <button className="btn-primary" onClick={() => openAuth("signin")}><span>Iniciar sesión</span></button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="vendedor">
      <div className="container vendedor-inner">
        <header className="vendedor-head">
          <p className="vendedor-kicker">Marketplace</p>
          <h1 className="vendedor-title">Panel del vendedor</h1>
          <p className="vendedor-subtitle">El desempeño de los agentes que has publicado en el marketplace.</p>
        </header>

        {loading ? (
          <div className="vendedor-empty"><p>Cargando tus métricas…</p></div>
        ) : !stats || stats.listingsTotal === 0 ? (
          <div className="vendedor-empty">
            <p>Aún no tienes agentes publicados en el marketplace.</p>
            <Link href="/app#ranking" className="btn-primary"><span>Ir a mis agentes →</span></Link>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="vendedor-kpis">
              <div className="vendedor-kpi">
                <Package className="vendedor-kpi-icon" aria-hidden />
                <span className="vendedor-kpi-num">{stats.salesTotal}</span>
                <span className="vendedor-kpi-label">Ventas</span>
              </div>
              <div className="vendedor-kpi">
                <CircleDollarSign className="vendedor-kpi-icon" aria-hidden />
                <span className="vendedor-kpi-num">{money(stats.revenueTotal)}</span>
                <span className="vendedor-kpi-label">Ingresos</span>
              </div>
              <div className="vendedor-kpi">
                <Download className="vendedor-kpi-icon" aria-hidden />
                <span className="vendedor-kpi-num">{stats.downloadsTotal}</span>
                <span className="vendedor-kpi-label">Descargas</span>
              </div>
              <div className="vendedor-kpi">
                <Users className="vendedor-kpi-icon" aria-hidden />
                <span className="vendedor-kpi-num">{stats.listingsTotal}</span>
                <span className="vendedor-kpi-label">Publicados</span>
              </div>
            </div>

            <div className="vendedor-cols">
              {/* Ventas por agente */}
              <section className="vendedor-panel">
                <h2 className="vendedor-panel-title">Ventas por agente</h2>
                {stats.salesByAgent.length === 0 ? (
                  <p className="vendedor-muted">Sin datos todavía.</p>
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
                <h2 className="vendedor-panel-title">Versión más descargada</h2>
                {stats.topVersion ? (
                  <div className="vendedor-topver">
                    <span className="vendedor-topver-num">{stats.topVersion.version}</span>
                    <span className="vendedor-topver-sub">{stats.topVersion.downloads} descargas</span>
                  </div>
                ) : (
                  <p className="vendedor-muted">Aún no hay descargas registradas.</p>
                )}
              </section>
            </div>

            {/* Compradores */}
            <section className="vendedor-panel">
              <h2 className="vendedor-panel-title">Compradores</h2>
              {stats.buyers.length === 0 ? (
                <p className="vendedor-muted">Todavía no tienes compradores.</p>
              ) : (
                <div className="vendedor-table">
                  <div className="vendedor-tr vendedor-th">
                    <span>Comprador</span>
                    <span>Agente</span>
                    <span>Precio</span>
                    <span>Fecha</span>
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
