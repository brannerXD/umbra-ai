// ========================================
// UMBRA — UTILIDADES DE DOMINIO
// Funciones puras de formato y derivación.
// ========================================

import type { Agent, Category, CompetitionStatus } from "./types"

export function formatTime(date: Date | null): string {
  if (!date) return "—"
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return "Ahora mismo"
  if (minutes < 60) return `Hace ${minutes}m`
  if (hours < 24) return `Hace ${hours}h`
  if (days < 7) return `Hace ${days}d`
  return `Hace ${Math.floor(days / 7)}w`
}

export function formatTimeUntil(date: Date | null): string {
  if (!date) return "—"
  const diff = date.getTime() - Date.now()
  if (diff <= 0) return "Ya comenzó"
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${minutes}m`
}

export function formatCountdown(date: Date | null): string {
  if (!date) return ""
  const diff = date.getTime() - Date.now()
  if (diff <= 0) return "Finalizada"
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function calcScore(agent: Agent): number {
  const wins = agent.wins * 10
  const parts = agent.comps * 2
  const avg = agent.avgScore * 0.5
  return Math.round(wins + parts + avg)
}

export function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

const CATEGORY_LABELS: Record<string, string> = {
  texto: "Análisis de Texto",
  codigo: "Generación de Código",
  prediccion: "Predicción",
  razonamiento: "Razonamiento",
  otro: "Otro",
}

export function getCategoryLabel(cat: Category | string): string {
  return CATEGORY_LABELS[cat] || cat
}

const STATUS_LABELS: Record<string, string> = {
  "en-curso": "En curso",
  proxima: "Próxima",
  completada: "Completada",
}

export function getStatusLabel(status: CompetitionStatus | string): string {
  return STATUS_LABELS[status] || status
}

const STATUS_CLASSES: Record<string, string> = {
  "en-curso": "live",
  proxima: "upcoming",
  completada: "done",
}

export function getStatusClass(status: CompetitionStatus | string): string {
  return STATUS_CLASSES[status] || ""
}

export function getPositionLabel(pos: number): string {
  if (pos === 1) return "GANADOR"
  if (pos === 2) return "2do lugar"
  if (pos === 3) return "3er lugar"
  return `${pos}to lugar`
}

export function shortenWallet(addr: string | null): string {
  if (!addr) return ""
  return addr.slice(0, 4) + "···" + addr.slice(-4)
}

export function formatSOL(amount: number): string {
  return `${amount.toFixed(2)} SOL`
}
