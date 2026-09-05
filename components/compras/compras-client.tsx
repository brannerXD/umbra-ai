"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Download, FileText, GitBranch, KeyRound, RefreshCw, X } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/language-provider"
import { useToast } from "@/components/toast-provider"
import { getCodeDownloadUrl, getPurchasedAgents, issueLicense } from "@/lib/services"
import { safeExternalUrl } from "@/lib/utils"
import { formatTime } from "@/lib/umbra"
import type { AgentVersion, PurchasedAgent } from "@/lib/types"

type Tab = "readme" | "docs" | "deps" | "versiones"
// Textos de la pagina en ambos idiomas.
const T = {
  es: {
    kicker: "Marketplace",
    title: "Mis Agentes Comprados",
    subtitle: "Aquí solo entras tú. Descarga el código, revisa la documentación y mantente al día con las nuevas versiones.",
    guest: "Inicia sesión para ver los agentes que has comprado.",
    signIn: "Iniciar sesión",
    loading: "Cargando tus compras…",
    emptyTitle: "Todavía no has comprado ningún agente.",
    explore: "Explorar el marketplace →",
    statAgents: "Agentes",
    statCode: "Con código",
    statUpdates: "Actualizaciones",
    badgeComplete: "Agente Completo",
    badgeLicense: "Licencia por URL",
    badgeUpdate: "Actualización disponible",
    bought: "Compraste:",
    latest: "Última:",
    purchasedOn: "Comprado el ",
    generating: "Generando…",
    download: "Descargar",
    accessNote: "Acceso activo vía API de Umbra",
    details: "Ver detalles",
    licenseLabel: "Licencia:",
    repo: "Repositorio",
    tabReadme: "README",
    tabDocs: "Documentación",
    tabDeps: "Dependencias",
    tabVersions: "Versiones",
    noReadme: "Este agente no incluye README.",
    noDocs: "Sin documentación adicional.",
    noDeps: "No se especificaron dependencias.",
    noVersions: "No hay versiones descargables.",
    tagBought: "comprada",
    tagLatest: "última",
    errLink: "No se pudo generar el enlace de descarga.",
    apiTitle: "Acceso por API",
    apiIntro: "Llama a tu agente con esta llave. El endpoint del vendedor queda oculto: las peticiones pasan por Umbra.",
    issueKey: "Generar llave",
    rotateKey: "Rotar llave",
    issuing: "Generando…",
    keyOnce: "Guarda esta llave ahora: por seguridad solo se muestra una vez. Si la pierdes, genera otra.",
    copy: "Copiar",
    copied: "Copiada",
    yourKey: "Tu llave",
    noKeyYet: "Aún no has generado tu llave de acceso.",
    calls: "llamadas",
    lastUse: "Último uso:",
    never: "sin usar",
    howTo: "Cómo llamarla",
    revoked: "Llave revocada",
    errIssue: "No se pudo generar la llave.",
    okIssue: "Llave generada. Cópiala antes de cerrar.",
  },
  en: {
    kicker: "Marketplace",
    title: "My Purchased Agents",
    subtitle: "Only you can see this. Download the code, review the documentation, and stay up to date with new versions.",
    guest: "Sign in to see the agents you have purchased.",
    signIn: "Sign in",
    loading: "Loading your purchases…",
    emptyTitle: "You have not purchased any agent yet.",
    explore: "Explore the marketplace →",
    statAgents: "Agents",
    statCode: "With code",
    statUpdates: "Updates",
    badgeComplete: "Complete Agent",
    badgeLicense: "URL License",
    badgeUpdate: "Update available",
    bought: "You bought:",
    latest: "Latest:",
    purchasedOn: "Purchased on ",
    generating: "Generating…",
    download: "Download",
    accessNote: "Active access via the Umbra API",
    details: "View details",
    licenseLabel: "License:",
    repo: "Repository",
    tabReadme: "README",
    tabDocs: "Documentation",
    tabDeps: "Dependencies",
    tabVersions: "Versions",
    noReadme: "This agent does not include a README.",
    noDocs: "No additional documentation.",
    noDeps: "No dependencies were specified.",
    noVersions: "There are no downloadable versions.",
    tagBought: "purchased",
    tagLatest: "latest",
    errLink: "Could not generate the download link.",
    apiTitle: "API access",
    apiIntro: "Call your agent with this key. The seller endpoint stays hidden: requests go through Umbra.",
    issueKey: "Generate key",
    rotateKey: "Rotate key",
    issuing: "Generating…",
    keyOnce: "Save this key now: for security it is shown only once. If you lose it, generate another one.",
    copy: "Copy",
    copied: "Copied",
    yourKey: "Your key",
    noKeyYet: "You have not generated your access key yet.",
    calls: "calls",
    lastUse: "Last use:",
    never: "never used",
    howTo: "How to call it",
    revoked: "Key revoked",
    errIssue: "Could not generate the key.",
    okIssue: "Key generated. Copy it before closing.",
  },
} as const


export function ComprasClient() {
  const { user, loading: authLoading, openAuth } = useAuth()
  const { showToast } = useToast()
  const { lang } = useI18n()
  const s = T[lang]

  const [loading, setLoading] = useState(true)
  const [purchases, setPurchases] = useState<PurchasedAgent[]>([])
  const [selected, setSelected] = useState<PurchasedAgent | null>(null)
  const [tab, setTab] = useState<Tab>("readme")
  const [downloading, setDownloading] = useState<string | null>(null)
  // La llave en claro solo existe en memoria y solo tras emitirla.
  const [freshKey, setFreshKey] = useState<{ purchaseId: string; key: string } | null>(null)
  const [issuing, setIssuing] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // El ejemplo de curl muestra el dominio real desde el que abrio la pagina.
  const apiBase = typeof window === "undefined" ? "https://umbra-agents.com" : window.location.origin

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
      showToast(s.errLink, "warn")
      return
    }
    window.open(url, "_blank", "noopener,noreferrer")
  }

  async function generateKey(p: PurchasedAgent) {
    setIssuing(p.purchaseId)
    const res = await issueLicense(p.purchaseId)
    setIssuing(null)
    if (!res.ok) {
      showToast(res.message || s.errIssue, "warn")
      return
    }
    setFreshKey({ purchaseId: p.purchaseId, key: res.key })
    setCopied(false)
    showToast(s.okIssue, "success")
    load()
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* el portapapeles puede estar bloqueado; la llave sigue visible */
    }
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
            <p className="compras-kicker">{s.kicker}</p>
            <h1 className="compras-title">{s.title}</h1>
          </header>
          <div className="compras-empty">
            <p>{s.guest}</p>
            <button className="btn-primary" onClick={() => openAuth("signin")}>
              <span>{s.signIn}</span>
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
          <p className="compras-kicker">{s.kicker}</p>
          <h1 className="compras-title">{s.title}</h1>
          <p className="compras-subtitle">{s.subtitle}</p>
        </header>

        {loading ? (
          <div className="compras-empty"><p>{s.loading}</p></div>
        ) : purchases.length === 0 ? (
          <div className="compras-empty">
            <p>{s.emptyTitle}</p>
            <Link href="/marketplace" className="btn-primary"><span>{s.explore}</span></Link>
          </div>
        ) : (
          <>
            {/* Resumen */}
            <div className="compras-summary">
              <div className="compras-stat">
                <span className="compras-stat-num">{purchases.length}</span>
                <span className="compras-stat-label">{s.statAgents}</span>
              </div>
              <div className="compras-stat">
                <span className="compras-stat-num">{codePurchases.length}</span>
                <span className="compras-stat-label">{s.statCode}</span>
              </div>
              <div className="compras-stat">
                <span className="compras-stat-num">{withUpdates}</span>
                <span className="compras-stat-label">{s.statUpdates}</span>
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
                        {isCode ? s.badgeComplete : s.badgeLicense}
                      </span>
                      {p.hasUpdate && (
                        <span className="compra-badge compra-badge-update">
                          <RefreshCw aria-hidden /> {s.badgeUpdate}
                        </span>
                      )}
                    </div>

                    {isCode && (
                      <div className="compra-card-meta">
                        <span>{s.bought} <strong>{p.boughtVersion ?? "v1.0"}</strong></span>
                        {latest && <span>{s.latest} <strong>{latest.version}</strong></span>}
                      </div>
                    )}
                    <div className="compra-card-date">{s.purchasedOn}{formatTime(p.purchasedAt.toISOString())}</div>

                    <div className="compra-card-actions">
                      {isCode && latest ? (
                        <button
                          className="btn-primary btn-sm"
                          disabled={downloading === latest.id}
                          onClick={() => download(p, latest)}
                        >
                          <span>
                            <Download aria-hidden style={{ width: 14, height: 14, verticalAlign: "-2px", marginRight: 6 }} />
                            {downloading === latest.id ? s.generating : `${s.download} ${latest.version}`}
                          </span>
                        </button>
                      ) : (
                        <span className="compra-access-note">{s.accessNote}</span>
                      )}
                      <button className="btn-ghost btn-sm" onClick={() => openDetails(p)}>
                        {s.details}
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
              {selected.listing.codeLicense ? `${s.licenseLabel} ${selected.listing.codeLicense}` : s.badgeLicense}
              {safeExternalUrl(selected.listing.gitRepo) && (
                <>
                  {" · "}
                  <a href={safeExternalUrl(selected.listing.gitRepo)} target="_blank" rel="noopener noreferrer" className="compra-git">
                    <GitBranch aria-hidden style={{ width: 13, height: 13, verticalAlign: "-2px" }} /> {s.repo}
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
                ["readme", s.tabReadme],
                ["docs", s.tabDocs],
                ["deps", s.tabDeps],
                ["versiones", s.tabVersions],
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

            {selected.listing.listingType === "acceso" && (
              <section className="compra-api">
                <h4 className="compra-api-title">
                  <KeyRound aria-hidden style={{ width: 15, height: 15, verticalAlign: "-3px", marginRight: 6 }} />
                  {s.apiTitle}
                </h4>
                <p className="compra-api-intro">{s.apiIntro}</p>

                {freshKey?.purchaseId === selected.purchaseId ? (
                  <>
                    <div className="compra-key-row">
                      <code className="compra-key">{freshKey.key}</code>
                      <button className="btn-ghost btn-sm" onClick={() => copyKey(freshKey.key)}>
                        {copied ? (
                          <>
                            <Check aria-hidden style={{ width: 13, height: 13, verticalAlign: "-2px", marginRight: 4 }} />
                            {s.copied}
                          </>
                        ) : (
                          <>
                            <Copy aria-hidden style={{ width: 13, height: 13, verticalAlign: "-2px", marginRight: 4 }} />
                            {s.copy}
                          </>
                        )}
                      </button>
                    </div>
                    <p className="compra-key-warn">{s.keyOnce}</p>
                  </>
                ) : selected.license ? (
                  <div className="compra-key-row">
                    <code className="compra-key compra-key-masked">{selected.license.keyPrefix}…</code>
                    <span className="compra-key-meta">
                      {selected.license.callsCount} {s.calls} · {s.lastUse}{" "}
                      {selected.license.lastUsedAt ? formatTime(selected.license.lastUsedAt, lang) : s.never}
                    </span>
                  </div>
                ) : (
                  <p className="compra-key-meta">{s.noKeyYet}</p>
                )}

                <button
                  className="btn-ghost btn-sm"
                  disabled={issuing === selected.purchaseId}
                  onClick={() => generateKey(selected)}
                >
                  {issuing === selected.purchaseId
                    ? s.issuing
                    : selected.license
                      ? s.rotateKey
                      : s.issueKey}
                </button>

                <div className="compra-api-howto">
                  <span className="compra-api-howto-label">{s.howTo}</span>
                  <pre className="compra-doc">{`curl -X POST ${apiBase}/api/v1/run \\
  -H "Authorization: Bearer umbra_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"Hola"}'`}</pre>
                </div>
              </section>
            )}

            <div className="compra-tab-body">
              {tab === "readme" && (
                <pre className="compra-doc">{selected.listing.readme || s.noReadme}</pre>
              )}
              {tab === "docs" && (
                <pre className="compra-doc">{selected.listing.documentation || s.noDocs}</pre>
              )}
              {tab === "deps" && (
                <pre className="compra-doc">{selected.listing.dependencies || s.noDeps}</pre>
              )}
              {tab === "versiones" && (
                <div className="compra-versions">
                  {selected.versions.length === 0 && <p className="compra-doc">{s.noVersions}</p>}
                  {selected.versions.map((v) => (
                    <div key={v.id} className="compra-version-row">
                      <div className="compra-version-info">
                        <span className="compra-version-name">
                          {v.version}
                          {v.version === selected.boughtVersion && <span className="compra-version-tag">{s.tagBought}</span>}
                          {v.version === selected.latestVersion && <span className="compra-version-tag latest">{s.tagLatest}</span>}
                        </span>
                        {v.changelog && <span className="compra-version-log">{v.changelog}</span>}
                      </div>
                      <button
                        className="btn-ghost btn-sm"
                        disabled={downloading === v.id}
                        onClick={() => download(selected, v)}
                      >
                        <FileText aria-hidden style={{ width: 14, height: 14, verticalAlign: "-2px", marginRight: 6 }} />
                        {downloading === v.id ? s.generating : s.download}
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
