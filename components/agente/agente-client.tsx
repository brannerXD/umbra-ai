"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { CountUp } from "@/components/count-up"
import { ScoreChart } from "./score-chart"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { formatPrice, formatTime } from "@/lib/umbra"
import { createListing, updateAgentDescription } from "@/lib/services"
import type { Agent, MarketplaceListingWithAgent } from "@/lib/types"

const HIST_LIMIT = 5

type HistFilter = "all" | "win" | "other"

export function AgenteClient({
  agent: initialAgent,
  rankPosition,
  listing: initialListing,
}: {
  agent: Agent
  rankPosition: number
  listing: MarketplaceListingWithAgent | null
}) {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [description, setDescription] = useState(initialAgent.description)
  const [listing, setListing] = useState<MarketplaceListingWithAgent | null>(initialListing)
  const [histFilter, setHistFilter] = useState<HistFilter>("all")
  const [showAll, setShowAll] = useState(false)

  // Modales
  const [editOpen, setEditOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [descDraft, setDescDraft] = useState(description)
  const [priceDraft, setPriceDraft] = useState("")
  const [priceUnit, setPriceUnit] = useState<"USD" | "COP">("USD")
  const [licenseDraft, setLicenseDraft] = useState("Licencia exclusiva")
  const [publishing, setPublishing] = useState(false)
  const [savingDesc, setSavingDesc] = useState(false)

  const isOwner = !!user && initialAgent.ownerId === user.id

  const winPts = initialAgent.wins * 10
  const partPts = initialAgent.comps * 2
  const avgPts = initialAgent.avgScore * 0.5
  const totalPts = Math.round(winPts + partPts + avgPts)

  const filtered = useMemo(() => {
    let items = initialAgent.history || []
    if (histFilter === "win") items = items.filter((h) => h.result === "win")
    if (histFilter === "other") items = items.filter((h) => h.result !== "win")
    return items
  }, [initialAgent.history, histFilter])

  const toShow = showAll ? filtered : filtered.slice(0, HIST_LIMIT)

  async function saveDescription() {
    setSavingDesc(true)
    const ok = await updateAgentDescription(initialAgent.id, descDraft)
    setSavingDesc(false)
    if (!ok) {
      showToast("No se pudo guardar la descripción.", "warn")
      return
    }
    setDescription(descDraft)
    setEditOpen(false)
    showToast("Descripcion actualizada.", "success")
  }

  async function publishListing() {
    const price = Number.parseFloat(priceDraft)
    if (!price || price <= 0) {
      showToast("Ingresa un precio valido.", "warn")
      return
    }
    setPublishing(true)
    const description = `Acceso a ${initialAgent.name}, listado por su creador.`
    const ok = await createListing({
      agentId: initialAgent.id,
      price,
      priceUnit,
      licenseType: licenseDraft,
      description,
    })
    setPublishing(false)
    if (!ok) {
      showToast("No se pudo publicar el listado. Intenta de nuevo.", "warn")
      return
    }
    setListing({
      agentId: initialAgent.id,
      listed: true,
      price,
      priceUnit,
      licenseType: licenseDraft,
      description,
      sellerName: user?.email?.split("@")[0] ?? "Usuario",
      listedAt: new Date(),
      agent: initialAgent,
    })
    setListOpen(false)
    showToast(`${initialAgent.name} fue listado en el marketplace por ${formatPrice(price, priceUnit)}.`, "success")
  }

  return (
    <main>
      <div className="breadcrumb-bar">
        <div className="container">
          <Link href="/#ranking" className="breadcrumb-link">
            ← Volver al ranking
          </Link>
        </div>
      </div>

      <section className="agent-hero">
        <div className="container">
          <div className="agent-hero-inner">
            <div className="agent-avatar-wrap">
              <div className="agent-avatar-lg">{initialAgent.name.slice(0, 2).toUpperCase()}</div>
            </div>
            <div className="agent-info">
              <div className="agent-top-row">
                <h1 className="agent-name">{initialAgent.name}</h1>
                {rankPosition > 0 && (
                  <span className="agent-rank-badge">{`#${rankPosition} Global`}</span>
                )}
              </div>
              <span className="cat-tag">{initialAgent.categoryLabel}</span>
              <p className="agent-desc">{description}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-card stat-card-main" style={{ animationDelay: "0ms" }}>
              <span className="stat-card-num">
                <CountUp target={initialAgent.score} />
              </span>
              <span className="stat-card-label">Score total</span>
            </div>
            <div className="stat-card" style={{ animationDelay: "60ms" }}>
              <span className="stat-card-num">
                <CountUp target={initialAgent.wins} />
              </span>
              <span className="stat-card-label">Victorias</span>
            </div>
            <div className="stat-card" style={{ animationDelay: "120ms" }}>
              <span className="stat-card-num">
                <CountUp target={initialAgent.comps} />
              </span>
              <span className="stat-card-label">Competencias</span>
            </div>
            <div className="stat-card" style={{ animationDelay: "180ms" }}>
              <span className="stat-card-num">{initialAgent.avgScore.toFixed(1)}</span>
              <span className="stat-card-label">Promedio /100</span>
            </div>
          </div>
        </div>
      </section>

      <section className="breakdown-section">
        <div className="container">
          <h2 className="section-title-sm">Desglose del Score</h2>
          <div className="breakdown-box">
            <div className="breakdown-row">
              <span className="breakdown-concept">Victorias</span>
              <span className="breakdown-calc">{`${initialAgent.wins} × 10 pts`}</span>
              <span className="breakdown-pts">{`+${winPts} pts`}</span>
            </div>
            <div className="breakdown-row">
              <span className="breakdown-concept">Participacion</span>
              <span className="breakdown-calc">{`${initialAgent.comps} × 2 pts`}</span>
              <span className="breakdown-pts">{`+${partPts} pts`}</span>
            </div>
            <div className="breakdown-row">
              <span className="breakdown-concept">Score promedio</span>
              <span className="breakdown-calc">{`${initialAgent.avgScore} × 0.5`}</span>
              <span className="breakdown-pts">{`+${avgPts.toFixed(1)} pts`}</span>
            </div>
            <div className="breakdown-divider" />
            <div className="breakdown-row total">
              <span className="breakdown-concept">TOTAL</span>
              <span className="breakdown-calc" />
              <span className="breakdown-pts">{`${totalPts} pts`}</span>
            </div>
          </div>
        </div>
      </section>

      {listing && (
        <section className="listing-section">
          <div className="container">
            <div className="listing-box">
              <div className="listing-info">
                <div className="section-eyebrow">En venta</div>
                <h2 className="section-title" style={{ fontSize: "1.5rem" }}>
                  Este agente esta en el marketplace
                </h2>
                <p className="section-sub">{listing.description}</p>
              </div>
              <div className="listing-action">
                <span className="listing-price">{formatPrice(listing.price, listing.priceUnit)}</span>
                <Link href="/marketplace" className="btn-primary">
                  <span>Ver en marketplace →</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {isOwner && (
        <section className="owner-panel">
          <div className="container">
            <div className="owner-box">
              <span className="owner-badge">Este es tu agente</span>
              <div className="owner-endpoint">
                <span className="owner-label">Endpoint actual:</span>
                <span className="owner-endpoint-val">●●●●●●●●●●●●●●</span>
              </div>
              <button
                className="btn-ghost btn-sm"
                onClick={() => {
                  setDescDraft(description)
                  setEditOpen(true)
                }}
              >
                Editar descripcion
              </button>
              {!listing && (
                <button className="btn-ghost btn-sm" onClick={() => setListOpen(true)}>
                  Listar en marketplace
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="chart-section">
        <div className="container">
          <h2 className="section-title-sm">Evolucion del Score</h2>
          <ScoreChart evolution={initialAgent.scoreEvolution} />
        </div>
      </section>

      <section className="history-section">
        <div className="container">
          <div className="history-header">
            <h2 className="section-title-sm">Historial de Competencias</h2>
            <div className="history-tabs">
              {(
                [
                  ["all", "Todas"],
                  ["win", "Victorias"],
                  ["other", "Otras"],
                ] as [HistFilter, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={`tab-btn-sm${histFilter === key ? " active" : ""}`}
                  onClick={() => {
                    setHistFilter(key)
                    setShowAll(false)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="history-empty">
              <p>Este agente aun no ha competido.</p>
              <Link href="/competencias" className="btn-ghost btn-sm">
                Ver competencias disponibles →
              </Link>
            </div>
          ) : (
            <>
              <div className="history-list">
                {toShow.map((h, i) => (
                  <Link
                    key={`${h.compId}-${i}`}
                    href={`/detalle?id=${h.compId}`}
                    className={`history-item${h.result === "win" ? " hist-win" : ""}`}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="hist-result-badge">{`${h.position}°`}</div>
                    <div className="hist-info">
                      <div className="hist-comp-name">{h.compName}</div>
                      <div className="hist-meta">
                        <span className="hist-time">{formatTime(h.time)}</span>
                        <span className="hist-score">{`Score: ${h.score}/100`}</span>
                        <span className="hist-response-time">{`· ${h.responseTime}s`}</span>
                      </div>
                    </div>
                    <div className="hist-right">
                      <span className="hist-pts">{`+${h.pts} pts`}</span>
                      <span className="hist-arrow">→</span>
                    </div>
                  </Link>
                ))}
              </div>
              {!showAll && filtered.length > HIST_LIMIT && (
                <div className="history-more">
                  <button className="btn-ghost btn-sm" onClick={() => setShowAll(true)}>
                    Ver todo el historial
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Modal editar descripcion */}
      {editOpen && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setEditOpen(false)}>
          <div className="modal-box">
            <button className="modal-close" aria-label="Cerrar" onClick={() => setEditOpen(false)}>
              ✕
            </button>
            <h3 className="modal-title">Editar descripcion</h3>
            <p className="modal-sub">Solo puedes editar la descripcion de tu agente.</p>
            <textarea
              className="modal-textarea"
              maxLength={100}
              rows={3}
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              placeholder="Describe tu agente..."
            />
            <div className="modal-char-count">{`${descDraft.length}/100`}</div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setEditOpen(false)}>
                Cancelar
              </button>
              <button className="btn-primary" disabled={savingDesc} onClick={saveDescription}>
                <span>{savingDesc ? "Guardando..." : "Guardar cambios"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal listar en marketplace */}
      {listOpen && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setListOpen(false)}>
          <div className="modal-box">
            <button className="modal-close" aria-label="Cerrar" onClick={() => setListOpen(false)}>
              ✕
            </button>
            <h3 className="modal-title">Listar agente en marketplace</h3>
            <p className="modal-sub">Define el precio y tipo de licencia para tu agente.</p>
            <div className="field-group">
              <label className="field-label">Precio</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  className="field-input"
                  placeholder="99"
                  step="0.01"
                  min="0"
                  value={priceDraft}
                  onChange={(e) => setPriceDraft(e.target.value)}
                />
                <select
                  className="field-input field-select"
                  style={{ maxWidth: 100 }}
                  value={priceUnit}
                  onChange={(e) => setPriceUnit(e.target.value as "USD" | "COP")}
                >
                  <option value="USD">USD</option>
                  <option value="COP">COP</option>
                </select>
              </div>
            </div>
            <div className="field-group">
              <label className="field-label">Tipo de licencia</label>
              <select
                className="field-input field-select"
                value={licenseDraft}
                onChange={(e) => setLicenseDraft(e.target.value)}
              >
                <option value="Licencia exclusiva">Licencia exclusiva (transferencia total)</option>
                <option value="Licencia de uso (no exclusiva)">Licencia de uso (no exclusiva)</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setListOpen(false)}>
                Cancelar
              </button>
              <button className="btn-primary" disabled={publishing} onClick={publishListing}>
                <span>{publishing ? "Publicando..." : "Publicar listado"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
