"use client"

import { type FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { type AdminStats, createCompetition, getAdminStats } from "@/lib/services"
import { supabase } from "@/lib/supabase"
import type { Category, Competition } from "@/lib/types"

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
const STATUS_COLOR: Record<string, string> = {
  completada: "#57534A",
  "en-curso": "#C9A24B",
  proxima: "#F5F5F0",
}

interface TipProps {
  active?: boolean
  payload?: { value: number; payload: { label?: string; name?: string } }[]
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
              <h2 className="chart-title">Competencias por estado</h2>
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={54}
                      outerRadius={82}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {statusData.map((e) => (
                        <Cell key={e.key} fill={STATUS_COLOR[e.key] ?? ACCENT} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="chart-legend">
                  {statusData.map((e) => (
                    <li key={e.key}>
                      <span className="legend-dot" style={{ background: STATUS_COLOR[e.key] ?? ACCENT }} />
                      <span className="legend-label">{e.name}</span>
                      <span className="legend-value">{e.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
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
