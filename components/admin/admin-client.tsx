"use client"

import { type FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { MessageSquare, Trophy, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import {
  type AdminStats,
  createCompetition,
  getAdminFeedback,
  getAdminStats,
  getGrowth,
  getUserActivity,
  setFeedbackPublished,
} from "@/lib/services"
import { supabase } from "@/lib/supabase"
import type { Category, Competition, FeedbackEntry, GrowthData, UserActivity } from "@/lib/types"

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "texto", label: "Análisis de Texto" },
  { value: "codigo", label: "Generación de Código" },
  { value: "razonamiento", label: "Razonamiento" },
  { value: "prediccion", label: "Predicción" },
  { value: "otro", label: "Otro" },
]

const STATUS_LABEL: Record<string, string> = {
  "en-curso": "En curso",
  proxima: "Próxima",
  completada: "Completada",
}

// Paleta de marca: acento cálido + tinta/gris, sobre superficie oscura.
const ACCENT = "#C9A24B"
const INK = "#F5F5F0"
const MUTED = "#6A6A64"

// Rangos disponibles para las graficas de crecimiento.
const RANGOS = [
  { dias: 7, label: "7 dias" },
  { dias: 30, label: "30 dias" },
  { dias: 90, label: "90 dias" },
] as const

// Series que se pueden dibujar. Se separan trafico de producto para que una no
// aplaste a la otra en la escala.
// Slots categoricos en orden fijo. El color sigue a la entidad, nunca al rango:
// filtrar una serie no repinta las demas.
const SERIES = [
  { key: "usuarios", label: "Usuarios", color: "var(--series-1)" },
  { key: "agentes", label: "Agentes", color: "var(--series-2)" },
  { key: "competencias", label: "Competencias", color: "var(--series-3)" },
  { key: "compras", label: "Compras", color: "var(--series-4)" },
  { key: "llamadas", label: "Llamadas API", color: "var(--series-5)" },
] as const

const EVENTO_LABEL: Record<string, string> = {
  agente: "Registro agente",
  competencia: "Compitio",
  compra: "Compra",
  llamada_api: "Llamada API",
  descarga: "Descarga",
  opinion: "Opinion",
}

function fechaCorta(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })
}
const STATUS_COLOR: Record<string, string> = {
  completada: "#57534A",
  "en-curso": "#C9A24B",
  proxima: "#F5F5F0",
}

interface TipProps {
  active?: boolean
  payload?: { value: number; payload: { label?: string; name?: string } }[]
}
function leyendaEnTinta(value: string) {
  return <span style={{ color: "var(--viz-axis)" }}>{value}</span>
}

function ChartTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="chart-tip">
      <span className="chart-tip-label">{p.payload.label ?? p.payload.name}</span>
      <span className="chart-tip-value">{p.value}</span>
    </div>
  )
}

export function AdminClient({ competitions }: { competitions: Competition[] }) {
  const router = useRouter()
  const { isAdmin, loading } = useAuth()
  const { showToast } = useToast()

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Crecimiento, actividad por usuario y bandeja de opiniones.
  const [growth, setGrowth] = useState<GrowthData | null>(null)
  const [rango, setRango] = useState<number>(30)
  const [activity, setActivity] = useState<UserActivity[]>([])
  const [expandido, setExpandido] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([])
  const [panelesCargando, setPanelesCargando] = useState(true)

  const [title, setTitle] = useState("")
  const [category, setCategory] = useState<Category>("texto")
  const [prompt, setPrompt] = useState("")
  const [agentsMax, setAgentsMax] = useState(6)
  const [creating, setCreating] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)

  // Guardia de cliente: si no es admin, fuera. (La seguridad real está en las
  // funciones SECURITY DEFINER y en RLS; esto solo oculta la interfaz.)
  useEffect(() => {
    if (!loading && !isAdmin) router.replace("/app")
  }, [loading, isAdmin, router])

  useEffect(() => {
    if (loading || !isAdmin) return
    let active = true
    getAdminStats().then((s) => {
      if (!active) return
      setStats(s)
      setStatsLoading(false)
    })
    return () => {
      active = false
    }
  }, [loading, isAdmin])

  // Opiniones y actividad: se cargan una vez.
  useEffect(() => {
    if (loading || !isAdmin) return
    let active = true
    Promise.all([getUserActivity(50), getAdminFeedback()]).then(([a, f]) => {
      if (!active) return
      setActivity(a)
      setFeedback(f)
      setPanelesCargando(false)
    })
    return () => {
      active = false
    }
  }, [loading, isAdmin])

  // El crecimiento se vuelve a pedir cada vez que cambia el rango.
  useEffect(() => {
    if (loading || !isAdmin) return
    let active = true
    getGrowth(rango).then((g) => {
      if (active) setGrowth(g)
    })
    return () => {
      active = false
    }
  }, [loading, isAdmin, rango])

  async function togglePublicada(f: FeedbackEntry) {
    const res = await setFeedbackPublished(f.id, !f.published)
    if (!res.ok) {
      showToast(res.message || "No se pudo cambiar la opinion.", "warn")
      return
    }
    setFeedback((prev) =>
      prev.map((x) => (x.id === f.id ? { ...x, published: !x.published } : x)),
    )
    showToast(f.published ? "Opinion retirada." : "Opinion publicada.", "success")
  }

  if (loading) {
    return (
      <main className="admin-shell container">
        <p className="admin-muted">Cargando…</p>
      </main>
    )
  }
  if (!isAdmin) return null

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !prompt.trim()) {
      showToast("El título y el prompt son obligatorios.", "warn")
      return
    }
    setCreating(true)
    const id = await createCompetition({ title: title.trim(), category, prompt: prompt.trim(), agentsMax })
    setCreating(false)
    if (!id) {
      showToast("No se pudo publicar la competencia.", "warn")
      return
    }
    showToast("Competencia publicada.", "success")
    setTitle("")
    setPrompt("")
    setAgentsMax(6)
    setCategory("texto")
    router.refresh()
  }

  async function runCompetition(id: string) {
    setRunningId(id)
    const { data, error } = await supabase.functions.invoke("run-competition", {
      body: { competitionId: id },
    })
    setRunningId(null)
    if (error || !data?.ok) {
      showToast(data?.message ?? "No se pudo ejecutar la competencia.", "warn")
      return
    }
    showToast("Competencia ejecutada. Resultados actualizados.", "success")
    router.refresh()
  }

  const kpis = stats
    ? [
        { label: "Usuarios", value: stats.usersTotal, hint: `+${stats.usersLast7d} en 7 días` },
        { label: "Agentes", value: stats.agentsTotal, hint: "activos" },
        { label: "Competencias", value: stats.competitionsTotal, hint: "publicadas" },
        { label: "Evaluaciones", value: stats.evaluationsTotal, hint: "del juez" },
        { label: "Listados", value: stats.listingsTotal, hint: "en el marketplace" },
        { label: "Ventas", value: stats.purchasesTotal, hint: "compras" },
        { label: "Certificados", value: stats.certificatesTotal, hint: "emitidos" },
      ]
    : []

  const statusData = stats
    ? Object.entries(stats.competitionsByStatus).map(([key, value]) => ({
        key,
        name: STATUS_LABEL[key] ?? key,
        value,
      }))
    : []

  return (
    <main className="admin-shell">
      <div className="container">
        <header className="admin-head">
          <span className="section-eyebrow">Panel de administración</span>
          <h1 className="page-title">Resumen de Umbra</h1>
          <p className="page-sub">Estadísticas de la red y gestión de competencias. Solo visible para admins.</p>
        </header>

        {/* KPIs */}
        <div className="kpi-grid">
          {statsLoading
            ? Array.from({ length: 7 }).map((_, i) => <div key={i} className="kpi-tile kpi-skeleton" />)
            : kpis.map((k) => (
                <div key={k.label} className="kpi-tile">
                  <span className="kpi-value">{k.value.toLocaleString("es-CO")}</span>
                  <span className="kpi-label">{k.label}</span>
                  <span className="kpi-hint">{k.hint}</span>
                </div>
              ))}
        </div>

        {/* Gráficos */}
        {stats && (
          <div className="charts-grid">
            <div className="chart-card">
              <h2 className="chart-title">Agentes por categoría</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.agentsByCategory} layout="vertical" margin={{ left: 4, right: 34, top: 4, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={132}
                    tick={{ fill: MUTED, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip cursor={{ fill: "rgba(245,245,240,0.05)" }} content={<ChartTip />} />
                  <Bar dataKey="value" fill={ACCENT} radius={[0, 4, 4, 0]} barSize={15}>
                    <LabelList dataKey="value" position="right" fill={INK} fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h2 className="chart-title">Competencias por categoría y estado</h2>
              {stats.competitionsByCategory.length === 0 ? (
                <div className="admin-vacio">
                  <Trophy className="admin-vacio-icono" aria-hidden />
                  <p className="admin-vacio-titulo">Todavía no hay competencias.</p>
                  <p className="admin-vacio-sub">Crea la primera desde el formulario de abajo.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={stats.competitionsByCategory}
                    layout="vertical"
                    margin={{ left: 4, right: 20, top: 4, bottom: 4 }}
                  >
                    <XAxis type="number" allowDecimals={false} hide />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={132}
                      tick={{ fill: "var(--viz-axis)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip cursor={{ fill: "rgba(128,128,128,0.08)" }} content={<ChartTip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} formatter={leyendaEnTinta} />
                    {/* Apiladas por estado. El stroke del color de la superficie
                        crea el separador de 2px sin dibujar un borde. */}
                    <Bar dataKey="en_curso" name="En curso" stackId="e"
                         fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} barSize={17} />
                    <Bar dataKey="proxima" name="Próximas" stackId="e"
                         fill="var(--series-4)" stroke="var(--surface)" strokeWidth={2} barSize={17} />
                    <Bar dataKey="completada" name="Completadas" stackId="e"
                         fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} barSize={17}
                         radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="total" position="right" fill="var(--text-2)" fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="chart-card chart-card-wide">
              <h2 className="chart-title">Top agentes por score</h2>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={stats.topAgents} layout="vertical" margin={{ left: 4, right: 34, top: 4, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={110}
                    tick={{ fill: MUTED, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip cursor={{ fill: "rgba(245,245,240,0.05)" }} content={<ChartTip />} />
                  <Bar dataKey="value" fill={INK} radius={[0, 4, 4, 0]} barSize={15}>
                    <LabelList dataKey="value" position="right" fill={MUTED} fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Crecimiento ── */}
        <section className="admin-section">
          <div className="admin-section-head">
            <h2 className="chart-title">Crecimiento</h2>
            <div className="admin-range">
              {RANGOS.map((r) => (
                <button
                  key={r.dias}
                  type="button"
                  className={`tab-btn-sm${rango === r.dias ? " active" : ""}`}
                  onClick={() => setRango(r.dias)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {!growth ? (
            <div className="chart-card kpi-skeleton" style={{ height: 260 }} />
          ) : (
            <div className="chart-card">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={growth.series} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    {SERIES.map((s) => (
                      <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
                  <XAxis
                    dataKey="dia"
                    tickFormatter={fechaCorta}
                    tick={{ fill: "var(--viz-axis)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "var(--viz-axis)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={38}
                  />
                  <Tooltip content={<ChartTip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={leyendaEnTinta} />
                  {SERIES.map((s) => (
                    <Area
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.label}
                      stroke={s.color}
                      fill={`url(#g-${s.key})`}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
              <p className="admin-muted admin-note">
                Actividad diaria de los ultimos {growth.days} dias. Las visitas y clics los mide
                Vercel Analytics aparte; esto es actividad de producto.
              </p>
            </div>
          )}
        </section>

        {/* ── Actividad por usuario ── */}
        <section className="admin-section">
          <h2 className="chart-title">Actividad por usuario</h2>
          {panelesCargando ? (
            <div className="chart-card kpi-skeleton" style={{ height: 160 }} />
          ) : activity.length === 0 ? (
            <div className="admin-vacio">
              <Users className="admin-vacio-icono" aria-hidden />
              <p className="admin-vacio-titulo">Todavía no hay usuarios registrados.</p>
              <p className="admin-vacio-sub">
                En cuanto alguien cree su cuenta verás aquí lo que hace.
              </p>
            </div>
          ) : (
            <div className="admin-card">
              <div className="actividad-tabla">
                <div className="actividad-fila actividad-head">
                  <span>Usuario</span>
                  <span>Registro</span>
                  <span>Eventos</span>
                  <span>Ultima actividad</span>
                  <span />
                </div>
                {activity.map((u) => (
                  <div key={u.id}>
                    <div className="actividad-fila">
                      <span className="actividad-nombre">{u.nombre}</span>
                      <span className="admin-muted">{fechaCorta(u.registrado)}</span>
                      <span>{u.eventos}</span>
                      <span className="admin-muted">{fechaCorta(u.ultimaActividad)}</span>
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        disabled={u.eventos === 0}
                        onClick={() => setExpandido(expandido === u.id ? null : u.id)}
                      >
                        {expandido === u.id ? "Ocultar" : "Ver"}
                      </button>
                    </div>
                    {expandido === u.id && (
                      <div className="actividad-detalle">
                        {u.ultimos.length === 0 ? (
                          <p className="admin-muted">Sin actividad registrada.</p>
                        ) : (
                          u.ultimos.map((e, i) => (
                            <div key={i} className="actividad-evento">
                              <span className={`actividad-tipo tipo-${e.tipo}`}>
                                {EVENTO_LABEL[e.tipo] ?? e.tipo}
                              </span>
                              <span className="actividad-detalle-txt">{e.detalle}</span>
                              <span className="admin-muted">{fechaCorta(e.cuando)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Opiniones ── */}
        <section className="admin-section">
          <h2 className="chart-title">Opiniones sobre Umbra</h2>
          {panelesCargando ? (
            <div className="chart-card kpi-skeleton" style={{ height: 140 }} />
          ) : feedback.length === 0 ? (
            <div className="admin-vacio">
              <MessageSquare className="admin-vacio-icono" aria-hidden />
              <p className="admin-vacio-titulo">Nadie ha dejado su opinión todavía.</p>
              <p className="admin-vacio-sub">
                Aparecerán aquí cuando alguien use el botón “Danos tu opinión” del pie de página.
              </p>
            </div>
          ) : (
            <div className="opiniones-lista">
              {feedback.map((f) => (
                <article key={f.id} className="admin-card opinion-card">
                  <div className="opinion-head">
                    <span className="opinion-autor">{f.author}</span>
                    {f.rating !== null && (
                      <span className="opinion-rating">{"★".repeat(f.rating)}</span>
                    )}
                    <span className="admin-muted">{fechaCorta(f.createdAt.toISOString())}</span>
                    {f.published && <span className="opinion-badge publicada">Publicada</span>}
                    {!f.authorConsent && (
                      <span className="opinion-badge sin-permiso">Sin permiso para publicar</span>
                    )}
                  </div>
                  <p className="opinion-msg">{f.message}</p>
                  <div className="opinion-acciones">
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={!f.authorConsent && !f.published}
                      title={
                        !f.authorConsent && !f.published
                          ? "El autor no autorizo publicarla"
                          : undefined
                      }
                      onClick={() => togglePublicada(f)}
                    >
                      {f.published ? "Retirar" : "Publicar"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Gestión de competencias */}
        <div className="admin-grid">
          <form className="admin-card admin-form" onSubmit={handleCreate}>
            <h2 className="admin-card-title">Nueva competencia</h2>

            <label className="admin-field">
              <span>Título</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Resumen ejecutivo de un informe"
                maxLength={120}
              />
            </label>

            <div className="admin-row">
              <label className="admin-field">
                <span>Categoría</span>
                <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-field admin-field-sm">
                <span>Máx. agentes</span>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={agentsMax}
                  onChange={(e) => setAgentsMax(Number(e.target.value))}
                />
              </label>
            </div>

            <label className="admin-field">
              <span>Prompt de la prueba</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="La instrucción exacta que recibirán todos los agentes…"
                rows={6}
                maxLength={4000}
              />
              <span className="admin-hint">{prompt.length}/4000 · se revela cuando comienza la competencia.</span>
            </label>

            <button type="submit" className="btn-primary" disabled={creating}>
              <span>{creating ? "Publicando…" : "Publicar competencia"}</span>
            </button>
          </form>

          <div className="admin-card">
            <h2 className="admin-card-title">Publicadas ({competitions.length})</h2>
            {competitions.length === 0 ? (
              <p className="admin-muted">Aún no hay competencias.</p>
            ) : (
              <ul className="admin-list">
                {competitions.map((c) => (
                  <li key={c.id} className="admin-list-item">
                    <div className="admin-list-main">
                      <Link href={`/detalle?id=${c.id}`} className="admin-list-name">
                        {c.name}
                      </Link>
                      <span className="admin-list-meta">
                        {c.categoryLabel} ·{" "}
                        <span className={`admin-badge admin-badge-${c.status}`}>
                          {STATUS_LABEL[c.status] ?? c.status}
                        </span>{" "}
                        · {c.agentsEnrolled} inscritos
                      </span>
                    </div>
                    {c.status === "proxima" && (
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        disabled={runningId === c.id || c.agentsEnrolled === 0}
                        onClick={() => runCompetition(c.id)}
                        title={c.agentsEnrolled === 0 ? "Necesita al menos un agente inscrito" : "Ejecutar ahora"}
                      >
                        {runningId === c.id ? "Ejecutando…" : "Correr →"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
