"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { CountUp } from "@/components/count-up"
import { ScoreChart } from "./score-chart"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { formatListingPrice, formatTime, getBillingLabel } from "@/lib/umbra"
import {
  MIN_COMPS_FOR_CERTIFICATE,
  archiveAgent,
  createAgentVersion,
  createListing,
  updateAgentDescription,
  uploadAgentCode,
  uploadAgentImage,
} from "@/lib/services"
import { CODE_LICENSES } from "@/lib/types"
import type { Agent, BillingModel, ListingType, MarketplaceListingWithAgent } from "@/lib/types"

const MAX_CODE_BYTES = 25 * 1024 * 1024
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

const HIST_LIMIT = 5

type HistFilter = "all" | "win" | "other"

// Convierte texto separado por comas o saltos de línea en una lista limpia.
function parseList(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

export function AgenteClient({
  agent: initialAgent,
  rankPosition,
  listing: initialListing,
  autoSellCode = false,
}: {
  agent: Agent
  rankPosition: number
  listing: MarketplaceListingWithAgent | null
  /** Abre el modal de publicación ya en modalidad "Agente Completo". */
  autoSellCode?: boolean
}) {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [description, setDescription] = useState(initialAgent.description)
  const [listing, setListing] = useState<MarketplaceListingWithAgent | null>(initialListing)
  const [histFilter, setHistFilter] = useState<HistFilter>("all")
  const [showAll, setShowAll] = useState(false)

  // Modales
  const [editOpen, setEditOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [descDraft, setDescDraft] = useState(description)
  const [priceDraft, setPriceDraft] = useState("")
  const [priceUnit, setPriceUnit] = useState<"USD" | "COP">("USD")
  const [listingTypeDraft, setListingTypeDraft] = useState<ListingType>("acceso")
  const [billingDraft, setBillingDraft] = useState<BillingModel>("mensual")
  const [licenseDraft, setLicenseDraft] = useState<string>(CODE_LICENSES[0])
  const [codeFile, setCodeFile] = useState<File | null>(null)
  const codeInputRef = useRef<HTMLInputElement>(null)
  const [publishing, setPublishing] = useState(false)
  const [listAccepted, setListAccepted] = useState(false)
  // Metadata extendida del listado
  const [sellDescDraft, setSellDescDraft] = useState("")
  const [docDraft, setDocDraft] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [modelsDraft, setModelsDraft] = useState("") // solo URL
  const [readmeDraft, setReadmeDraft] = useState("") // solo código
  const [techDraft, setTechDraft] = useState("") // solo código
  const [depsDraft, setDepsDraft] = useState("") // solo código
  const [gitRepoDraft, setGitRepoDraft] = useState("") // solo código
  // Publicar una nueva versión (v1.1, v2.0...) de un Agente Completo
  const [verOpen, setVerOpen] = useState(false)
  const [verDraft, setVerDraft] = useState("")
  const [changelogDraft, setChangelogDraft] = useState("")
  const [verFile, setVerFile] = useState<File | null>(null)
  const verInputRef = useRef<HTMLInputElement>(null)
  const [publishingVer, setPublishingVer] = useState(false)
  const [savingDesc, setSavingDesc] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const isOwner = !!user && initialAgent.ownerId === user.id

  // Al venir del registro con "vender el código", abrimos el modal ya configurado.
  const autoOpened = useRef(false)
  useEffect(() => {
    if (autoOpened.current || !autoSellCode || !isOwner || listing) return
    autoOpened.current = true
    setListingTypeDraft("codigo")
    setListAccepted(false)
    setListOpen(true)
  }, [autoSellCode, isOwner, listing])

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
    const isCode = listingTypeDraft === "codigo"
    if (isCode && !codeFile) {
      showToast("Sube el .zip con el código de tu agente.", "warn")
      return
    }
    if (isCode && !readmeDraft.trim()) {
      showToast("Agrega un README para tu Agente Completo.", "warn")
      return
    }
    if (!user) return

    setPublishing(true)

    // El código va a un bucket privado; solo quien compre podrá descargarlo.
    // La primera versión publicada es la v1.0.
    const INITIAL_VERSION = "v1.0"
    let codePath: string | null = null
    if (isCode && codeFile) {
      codePath = await uploadAgentCode(user.id, initialAgent.id, INITIAL_VERSION, codeFile)
      if (!codePath) {
        setPublishing(false)
        showToast("No se pudo subir el código. Intenta de nuevo.", "warn")
        return
      }
    }

    // Imagen de producto (opcional) → bucket público.
    let imageUrl: string | null = null
    if (imageFile) {
      imageUrl = await uploadAgentImage(user.id, initialAgent.id, imageFile)
    }

    const billingModel: BillingModel = isCode ? "unico" : billingDraft
    const technologies = isCode ? parseList(techDraft) : null
    const compatibleModels = !isCode ? parseList(modelsDraft) : null
    const description =
      sellDescDraft.trim() ||
      (isCode
        ? `Código completo de ${initialAgent.name} — licencia ${licenseDraft}.`
        : `Acceso a ${initialAgent.name}, listado por su creador.`)

    const listingId = await createListing({
      agentId: initialAgent.id,
      listingType: listingTypeDraft,
      price,
      priceUnit,
      billingModel,
      description,
      codeLicense: isCode ? licenseDraft : null,
      codePath,
      imageUrl,
      documentation: docDraft.trim() || null,
      compatibleModels: compatibleModels && compatibleModels.length ? compatibleModels : null,
      gitRepo: isCode ? gitRepoDraft.trim() || null : null,
      technologies: technologies && technologies.length ? technologies : null,
      dependencies: isCode ? depsDraft.trim() || null : null,
      readme: isCode ? readmeDraft.trim() || null : null,
    })
    if (!listingId) {
      setPublishing(false)
      showToast("No se pudo publicar el listado. Intenta de nuevo.", "warn")
      return
    }

    // Registra la primera versión del código (v1.0) ligada al listado.
    if (isCode && codePath) {
      await createAgentVersion({
        listingId,
        version: INITIAL_VERSION,
        codePath,
        changelog: "Versión inicial.",
      })
    }

    setPublishing(false)
    setListing({
      agentId: initialAgent.id,
      listingId,
      listed: true,
      listingType: listingTypeDraft,
      price,
      priceUnit,
      billingModel,
      codeLicense: isCode ? licenseDraft : null,
      codePath,
      description,
      sellerName: user?.email?.split("@")[0] ?? "Usuario",
      listedAt: new Date(),
      imageUrl,
      documentation: docDraft.trim() || null,
      compatibleModels: compatibleModels && compatibleModels.length ? compatibleModels : null,
      gitRepo: isCode ? gitRepoDraft.trim() || null : null,
      technologies: technologies && technologies.length ? technologies : null,
      dependencies: isCode ? depsDraft.trim() || null : null,
      readme: isCode ? readmeDraft.trim() || null : null,
      agent: initialAgent,
    })
    setListOpen(false)
    showToast(
      `${initialAgent.name} está disponible en el marketplace por ${formatListingPrice(price, priceUnit, billingModel)}.`,
      "success",
    )
  }

  async function publishVersion() {
    const version = verDraft.trim()
    if (!version) {
      showToast("Escribe el número de versión (ej: v1.1).", "warn")
      return
    }
    if (!verFile) {
      showToast("Sube el .zip de la nueva versión.", "warn")
      return
    }
    if (!user || !listing) return

    setPublishingVer(true)
    const codePath = await uploadAgentCode(user.id, initialAgent.id, version, verFile)
    if (!codePath) {
      setPublishingVer(false)
      showToast("No se pudo subir el código. Intenta de nuevo.", "warn")
      return
    }
    const created = await createAgentVersion({
      listingId: listing.listingId,
      version,
      codePath,
      changelog: changelogDraft.trim() || null,
    })
    setPublishingVer(false)
    if (!created) {
      showToast("No se pudo publicar la versión. ¿Ya existe ese número?", "warn")
      return
    }
    // El listado ahora apunta a la última versión.
    setListing({ ...listing, codePath })
    setVerOpen(false)
    setVerDraft("")
    setChangelogDraft("")
    setVerFile(null)
    showToast(`Versión ${version} publicada. Tus compradores ya pueden actualizarse.`, "success")
  }

  // Selector de imagen de producto (compartido por ambos modos).
  function onImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    e.target.value = ""
    if (f && !f.type.startsWith("image/")) {
      showToast("Selecciona un archivo de imagen.", "warn")
      return
    }
    if (f && f.size > MAX_IMAGE_BYTES) {
      showToast("La imagen debe pesar menos de 3MB.", "warn")
      return
    }
    setImageFile(f)
  }

  async function confirmArchiveAgent() {
    setArchiving(true)
    const ok = await archiveAgent(initialAgent.id)
    setArchiving(false)
    if (!ok) {
      showToast("No se pudo archivar el agente.", "warn")
      return
    }
    showToast(`${initialAgent.name} fue archivado.`, "success")
    setArchiveOpen(false)
    router.refresh()
  }

  return (
    <main>
      <div className="breadcrumb-bar">
        <div className="container">
          <Link href="/app#ranking" className="breadcrumb-link">
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
          {isOwner && initialAgent.comps >= MIN_COMPS_FOR_CERTIFICATE && (
            <div className="cert-link-row">
              <Link href={`/certificado?id=${initialAgent.id}`} className="btn-ghost btn-sm">
                Emitir certificado de reputación →
              </Link>
            </div>
          )}
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
                <div className="section-eyebrow">{getBillingLabel(listing.billingModel)}</div>
                <h2 className="section-title" style={{ fontSize: "1.5rem" }}>
                  Este agente está disponible en el marketplace
                </h2>
                <p className="section-sub">{listing.description}</p>
              </div>
              <div className="listing-action">
                <span className="listing-price">
                  {formatListingPrice(listing.price, listing.priceUnit, listing.billingModel)}
                </span>
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
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setListAccepted(false)
                    setListOpen(true)
                  }}
                >
                  Listar en marketplace
                </button>
              )}
              {listing?.listingType === "codigo" && (
                <button className="btn-ghost btn-sm" onClick={() => setVerOpen(true)}>
                  Publicar nueva versión
                </button>
              )}
              {!initialAgent.archived && (
                <button className="btn-ghost btn-sm" onClick={() => setArchiveOpen(true)}>
                  Archivar agente
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
          <div className="modal-box sell-modal">
            <button className="modal-close" aria-label="Cerrar" onClick={() => setListOpen(false)}>
              ✕
            </button>
            <h3 className="modal-title">Publicar en el marketplace</h3>
            <p className="modal-sub">
              Elige la modalidad: <strong>Licencia por URL</strong> (tú sigues hospedando el agente) o{" "}
              <strong>Agente Completo</strong> (vendes el código para que el comprador lo ejecute).
            </p>

            <div className="sell-modal-body">
              {/* Selector de modalidad */}
              <div className="sell-type-toggle">
                <button
                  type="button"
                  className={`sell-type-opt${listingTypeDraft === "acceso" ? " active" : ""}`}
                  onClick={() => setListingTypeDraft("acceso")}
                >
                  <span className="sell-type-title">Licencia por URL</span>
                  <span className="sell-type-desc">Uso vía la API de Umbra</span>
                </button>
                <button
                  type="button"
                  className={`sell-type-opt${listingTypeDraft === "codigo" ? " active" : ""}`}
                  onClick={() => setListingTypeDraft("codigo")}
                >
                  <span className="sell-type-title">Agente Completo</span>
                  <span className="sell-type-desc">Código fuente descargable</span>
                </button>
              </div>

              {listingTypeDraft === "acceso" ? (
                <>
                  <div className="field-group">
                    <label className="field-label">Cómo quieres cobrar</label>
                    <select
                      className="field-input field-select"
                      value={billingDraft}
                      onChange={(e) => setBillingDraft(e.target.value as BillingModel)}
                    >
                      <option value="mensual">Suscripción mensual</option>
                      <option value="uso">Por uso (cada 1.000 llamadas)</option>
                    </select>
                    <p className="field-hint">
                      El acceso es no exclusivo y puedes retirarlo cuando quieras. Tu endpoint nunca se expone.
                    </p>
                  </div>
                  <div className="field-group">
                    <label className="field-label">Modelos compatibles</label>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="GPT-4o, Claude Sonnet, Gemini..."
                      value={modelsDraft}
                      onChange={(e) => setModelsDraft(e.target.value)}
                    />
                    <p className="field-hint">Separa con comas. Opcional.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="field-group">
                    <label className="field-label">Código del agente (.zip) *</label>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ width: "100%" }}
                      onClick={() => codeInputRef.current?.click()}
                    >
                      <span>{codeFile ? codeFile.name : "Elegir archivo .zip"}</span>
                    </button>
                    <input
                      ref={codeInputRef}
                      type="file"
                      accept=".zip,application/zip"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null
                        e.target.value = ""
                        if (f && f.size > MAX_CODE_BYTES) {
                          showToast("El archivo debe pesar menos de 25MB.", "warn")
                          return
                        }
                        setCodeFile(f)
                      }}
                    />
                    <p className="field-hint">
                      Máximo 25MB. Se guarda privado: solo quien lo compre podrá descargarlo. Se publica como v1.0.
                    </p>
                  </div>
                  <div className="field-group">
                    <label className="field-label">Repositorio Git</label>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="https://github.com/tu-usuario/tu-agente (opcional)"
                      value={gitRepoDraft}
                      onChange={(e) => setGitRepoDraft(e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">README *</label>
                    <textarea
                      className="field-input sell-textarea"
                      rows={4}
                      placeholder="Qué hace tu agente, cómo instalarlo y ejecutarlo..."
                      value={readmeDraft}
                      onChange={(e) => setReadmeDraft(e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Tecnologías utilizadas</label>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="Python, LangChain, FastAPI..."
                      value={techDraft}
                      onChange={(e) => setTechDraft(e.target.value)}
                    />
                    <p className="field-hint">Separa con comas.</p>
                  </div>
                  <div className="field-group">
                    <label className="field-label">Dependencias</label>
                    <textarea
                      className="field-input sell-textarea"
                      rows={3}
                      placeholder="requirements.txt, paquetes npm, servicios externos..."
                      value={depsDraft}
                      onChange={(e) => setDepsDraft(e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">Licencia</label>
                    <select
                      className="field-input field-select"
                      value={licenseDraft}
                      onChange={(e) => setLicenseDraft(e.target.value)}
                    >
                      {CODE_LICENSES.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <p className="field-hint">
                      El código no hereda tu reputación: la ganó este despliegue, no el archivo.
                    </p>
                  </div>
                </>
              )}

              {/* Comunes a ambas modalidades */}
              <div className="field-group">
                <label className="field-label">Descripción</label>
                <textarea
                  className="field-input sell-textarea"
                  rows={2}
                  placeholder="Resume en una frase para qué sirve tu agente."
                  value={sellDescDraft}
                  onChange={(e) => setSellDescDraft(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Documentación</label>
                <textarea
                  className="field-input sell-textarea"
                  rows={3}
                  placeholder="Guía de uso, endpoints, ejemplos... (opcional)"
                  value={docDraft}
                  onChange={(e) => setDocDraft(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Imagen de producto</label>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ width: "100%" }}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <span>{imageFile ? imageFile.name : "Elegir imagen"}</span>
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={onImagePick}
                />
                <p className="field-hint">Se muestra en el marketplace. Máx 3MB. Opcional.</p>
              </div>

              <div className="field-group">
                <label className="field-label">
                  {listingTypeDraft === "codigo"
                    ? "Precio (pago único)"
                    : billingDraft === "uso"
                      ? "Precio por 1.000 llamadas"
                      : "Precio por mes"}{" "}
                  *
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    className="field-input"
                    placeholder={listingTypeDraft === "codigo" ? "149" : billingDraft === "uso" ? "2.50" : "29"}
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
                <p className="field-hint">
                  Umbra le cobra al comprador y te transfiere lo recaudado menos la comisión de la plataforma.
                </p>
              </div>

              <label className="consent-check">
                <input
                  type="checkbox"
                  checked={listAccepted}
                  onChange={(e) => setListAccepted(e.target.checked)}
                />
                <span>
                  Confirmo que soy el titular de este agente y acepto los{" "}
                  <Link href="/terminos#vendedores" target="_blank">
                    Términos del Marketplace para vendedores
                  </Link>
                  .
                </span>
              </label>
            </div>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setListOpen(false)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                disabled={publishing || !listAccepted}
                onClick={publishListing}
              >
                <span>{publishing ? "Publicando..." : "Publicar listado"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal publicar nueva versión */}
      {verOpen && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setVerOpen(false)}>
          <div className="modal-box">
            <button className="modal-close" aria-label="Cerrar" onClick={() => setVerOpen(false)}>
              ✕
            </button>
            <h3 className="modal-title">Publicar nueva versión</h3>
            <p className="modal-sub">
              La versión anterior se conserva: quien la compró seguirá pudiendo descargarla, y todos verán que hay
              una actualización disponible.
            </p>
            <div className="field-group">
              <label className="field-label">Número de versión *</label>
              <input
                type="text"
                className="field-input"
                placeholder="v1.1, v2.0..."
                value={verDraft}
                onChange={(e) => setVerDraft(e.target.value)}
              />
            </div>
            <div className="field-group">
              <label className="field-label">Código (.zip) *</label>
              <button
                type="button"
                className="btn-ghost"
                style={{ width: "100%" }}
                onClick={() => verInputRef.current?.click()}
              >
                <span>{verFile ? verFile.name : "Elegir archivo .zip"}</span>
              </button>
              <input
                ref={verInputRef}
                type="file"
                accept=".zip,application/zip"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  e.target.value = ""
                  if (f && f.size > MAX_CODE_BYTES) {
                    showToast("El archivo debe pesar menos de 25MB.", "warn")
                    return
                  }
                  setVerFile(f)
                }}
              />
            </div>
            <div className="field-group">
              <label className="field-label">Novedades (changelog)</label>
              <textarea
                className="field-input sell-textarea"
                rows={3}
                placeholder="Qué cambió en esta versión..."
                value={changelogDraft}
                onChange={(e) => setChangelogDraft(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setVerOpen(false)}>
                Cancelar
              </button>
              <button className="btn-primary" disabled={publishingVer} onClick={publishVersion}>
                <span>{publishingVer ? "Publicando..." : "Publicar versión"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal archivar agente */}
      {archiveOpen && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setArchiveOpen(false)}>
          <div className="modal-box">
            <button className="modal-close" aria-label="Cerrar" onClick={() => setArchiveOpen(false)}>
              ✕
            </button>
            <h3 className="modal-title">Archivar {initialAgent.name}</h3>
            <p className="modal-sub">
              Desaparecerá del ranking público y se quitará del marketplace si estaba listado. Su historial de
              competencias se conserva. No se borra nada de forma permanente.
            </p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setArchiveOpen(false)}>
                Cancelar
              </button>
              <button className="btn-primary" disabled={archiving} onClick={confirmArchiveAgent}>
                <span>{archiving ? "Archivando..." : "Archivar agente"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
