"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Download, FileText, GitBranch, RefreshCw, X } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { getCodeDownloadUrl, getPurchasedAgents } from "@/lib/services"
import { formatTime } from "@/lib/umbra"
import type { AgentVersion, PurchasedAgent } from "@/lib/types"

type Tab = "readme" | "docs" | "deps" | "versiones"

export function ComprasClient() {
  const { user, loading: authLoading, openAuth } = useAuth()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [purchases, setPurchases] = useState<PurchasedAgent[]>([])
  const [selected, setSelected] = useState<PurchasedAgent | null>(null)
  const [tab, setTab] = useState<Tab>("readme")
  const [downloading, setDownloading] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!user) {
      setPurchases([])
      setLoading(false)
      return
    }
    setLoading(true)
    getPurchasedAgents(user.id).then((data) => {
      setPurchases(data)
      setLoading(false)
    })
  }, [user])

  useEffect(() => {
    if (!authLoading) load()
  }, [authLoading, load])

  async function download(p: PurchasedAgent, version: AgentVersion) {
    setDownloading(version.id)
    const url = await getCodeDownloadUrl(version.codePath, {
      listingId: p.listing.listingId,
      versionId: version.id,
    })
    setDownloading(null)
    if (!url) {
      showToast("No se pudo generar el enlace de descarga.", "warn")
      return
    }
    window.open(url, "_blank", "noopener,noreferrer")
  }

  // La versión "recomendada" para descargar: la última publicada.
  const latestVersion = (p: PurchasedAgent) => p.versions[0] ?? null

  const codePurchases = purchases.filter((p) => p.listing.listingType === "codigo")
  const withUpdates = codePurchases.filter((p) => p.hasUpdate).length

  function openDetails(p: PurchasedAgent) {
    setTab("readme")
    setSelected(p)
  }

  // ── Estados de carga / vacío ──
  if (!authLoading && !user) {
    return (
      <main className="compras">
        <div className="container compras-inner">
          <header className="compras-head">
            <p className="compras-kicker">Marketplace</p>
            <h1 className="compras-title">Mis Agentes Comprados</h1>
          </header>
          <div className="compras-empty">
            <p>Inicia sesión para ver los agentes que has comprado.</p>
            <button className="btn-primary" onClick={() => openAuth("signin")}>
              <span>Iniciar sesión</span>
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="compras">
      <div className="container compras-inner">
        <header className="compras-head">
          <p className="compras-kicker">Marketplace</p>
          <h1 className="compras-title">Mis Agentes Comprados</h1>
          <p className="compras-subtitle">
            Aquí solo entras tú. Descarga el código, revisa la documentación y mantente al día con las nuevas versiones.
          </p>
        </header>

        {loading ? (
          <div className="compras-empty"><p>Cargando tus compras…</p></div>
        ) : purchases.length === 0 ? (
          <div className="compras-empty">
            <p>Todavía no has comprado ningún agente.</p>
            <Link href="/marketplace" className="btn-primary"><span>Explorar el marketplace →</span></Link>
          </div>
        ) : (
          <>
            {/* Resumen */}
            <div className="compras-summary">
              <div className="compras-stat">
                <span className="compras-stat-num">{purchases.length}</span>
                <span className="compras-stat-label">Agentes</span>
              </div>
              <div className="compras-stat">
                <span className="compras-stat-num">{codePurchases.length}</span>
                <span className="compras-stat-label">Con código</span>
              </div>
              <div className="compras-stat">
                <span className="compras-stat-num">{withUpdates}</span>
                <span className="compras-stat-label">Actualizaciones</span>
              </div>
            </div>

            {/* Tarjetas */}
            <div className="compras-grid">
              {purchases.map((p) => {
                const isCode = p.listing.listingType === "codigo"
                const latest = latestVersion(p)
                return (
                  <article key={p.purchaseId} className="compra-card">
                    <div className="compra-card-top">
                      {p.listing.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.listing.imageUrl} alt="" className="compra-card-img" />
                      ) : (
                        <div className="compra-card-img compra-card-img-fallback">
                          {p.listing.agent.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="compra-card-headings">
                        <h3 className="compra-card-name">{p.listing.agent.name}</h3>
                        <span className="cat-tag">{p.listing.agent.categoryLabel}</span>
                      </div>
                    </div>

                    <div className="compra-card-badges">
                      <span className={`compra-badge ${isCode ? "compra-badge-code" : "compra-badge-access"}`}>
                        {isCode ? "Agente Completo" : "Licencia por URL"}
                      </span>
                      {p.hasUpdate && (
                        <span className="compra-badge compra-badge-update">
                          <RefreshCw aria-hidden /> Actualización disponible
                        </span>
                      )}
                    </div>

                    {isCode && (
                      <div className="compra-card-meta">
                        <span>Compraste: <strong>{p.boughtVersion ?? "v1.0"}</strong></span>
                        {latest && <span>Última: <strong>{latest.version}</strong></span>}
                      </div>
                    )}
                    <div className="compra-card-date">Comprado el {formatTime(p.purchasedAt.toISOString())}</div>

                    <div className="compra-card-actions">
                      {isCode && latest ? (
                        <button
                          className="btn-primary btn-sm"
                          disabled={downloading === latest.id}
                          onClick={() => download(p, latest)}
                        >
                          <span>
                            <Download aria-hidden style={{ width: 14, height: 14, verticalAlign: "-2px", marginRight: 6 }} />
                            {downloading === latest.id ? "Generando…" : `Descargar ${latest.version}`}
                          </span>
                        </button>
                      ) : (
                        <span className="compra-access-note">Acceso activo vía API de Umbra</span>
                      )}
                      <button className="btn-ghost btn-sm" onClick={() => openDetails(p)}>
                        Ver detalles
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal de detalles */}
      {selected && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal-box compra-modal">
            <button className="modal-close" aria-label="Cerrar" onClick={() => setSelected(null)}>
              <X aria-hidden />
            </button>
            <h3 className="modal-title">{selected.listing.agent.name}</h3>
            <p className="modal-sub">
              {selected.listing.codeLicense ? `Licencia: ${selected.listing.codeLicense}` : "Licencia por URL"}
              {selected.listing.gitRepo && (
                <>
                  {" · "}
                  <a href={selected.listing.gitRepo} target="_blank" rel="noopener noreferrer" className="compra-git">
                    <GitBranch aria-hidden style={{ width: 13, height: 13, verticalAlign: "-2px" }} /> Repositorio
                  </a>
                </>
              )}
            </p>

            {selected.listing.technologies && selected.listing.technologies.length > 0 && (
              <div className="compra-tech-row">
                {selected.listing.technologies.map((t) => (
                  <span key={t} className="compra-tech">{t}</span>
                ))}
              </div>
            )}

            <div className="compra-tabs">
              {([
                ["readme", "README"],
                ["docs", "Documentación"],
                ["deps", "Dependencias"],
                ["versiones", "Versiones"],
              ] as [Tab, string][]).map(([key, label]) => (
                <button
                  key={key}
                  className={`compra-tab${tab === key ? " active" : ""}`}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="compra-tab-body">
              {tab === "readme" && (
                <pre className="compra-doc">{selected.listing.readme || "Este agente no incluye README."}</pre>
              )}
              {tab === "docs" && (
                <pre className="compra-doc">{selected.listing.documentation || "Sin documentación adicional."}</pre>
              )}
              {tab === "deps" && (
                <pre className="compra-doc">{selected.listing.dependencies || "No se especificaron dependencias."}</pre>
              )}
              {tab === "versiones" && (
                <div className="compra-versions">
                  {selected.versions.length === 0 && <p className="compra-doc">No hay versiones descargables.</p>}
                  {selected.versions.map((v) => (
                    <div key={v.id} className="compra-version-row">
                      <div className="compra-version-info">
                        <span className="compra-version-name">
                          {v.version}
                          {v.version === selected.boughtVersion && <span className="compra-version-tag">comprada</span>}
                          {v.version === selected.latestVersion && <span className="compra-version-tag latest">última</span>}
                        </span>
                        {v.changelog && <span className="compra-version-log">{v.changelog}</span>}
                      </div>
                      <button
                        className="btn-ghost btn-sm"
                        disabled={downloading === v.id}
                        onClick={() => download(selected, v)}
                      >
                        <FileText aria-hidden style={{ width: 14, height: 14, verticalAlign: "-2px", marginRight: 6 }} />
                        {downloading === v.id ? "Generando…" : "Descargar"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
