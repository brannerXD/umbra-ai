// ========================================
// UMBRA — CAPA DE SERVICIOS
// Abstracción async sobre los datos. Hoy resuelve sobre mock data en
// memoria; mañana cada función puede apuntar a Supabase, un indexador
// on-chain de Solana, o el evaluador de Claude sin tocar la UI.
// ========================================

import { agents, competitions, marketplace } from "./data"
import type {
  Agent,
  Category,
  Competition,
  MarketplaceListingWithAgent,
} from "./types"

// Pequeña latencia simulada opcional para futuras transiciones.
function resolve<T>(value: T): Promise<T> {
  return Promise.resolve(value)
}

// ── AGENTES ──────────────────────────────
export function listAgents(): Promise<Agent[]> {
  return resolve(agents)
}

export function getAgentById(id: string): Promise<Agent | null> {
  return resolve(agents.find((a) => a.id === id) || null)
}

export function getRankedAgents(category: Category | "all" = "all"): Promise<Agent[]> {
  let result = [...agents]
  if (category !== "all") result = result.filter((a) => a.category === category)
  result.sort((a, b) => b.score - a.score)
  return resolve(result)
}

export function getAgentsByWallet(wallet: string | null): Promise<Agent[]> {
  if (!wallet) return resolve([])
  return resolve(agents.filter((a) => a.wallet === wallet))
}

// ── COMPETENCIAS ─────────────────────────
export function listCompetitions(): Promise<Competition[]> {
  return resolve(competitions)
}

export function getCompetitionById(id: string): Promise<Competition | null> {
  return resolve(competitions.find((c) => c.id === id) || null)
}

export function getEnrolledCompetitions(agentId: string): Promise<Competition[]> {
  return resolve(
    competitions.filter((c) => c.results?.some((r) => r.agentId === agentId)),
  )
}

// ── MARKETPLACE ──────────────────────────
export function getMarketplaceListings(): Promise<MarketplaceListingWithAgent[]> {
  const listings = marketplace
    .filter((m) => m.listed)
    .map((m) => {
      const agent = agents.find((a) => a.id === m.agentId)
      return agent ? { ...m, agent } : null
    })
    .filter((m): m is MarketplaceListingWithAgent => m !== null)
  return resolve(listings)
}

export function getListingByAgentId(
  agentId: string,
): Promise<MarketplaceListingWithAgent | null> {
  const listing = marketplace.find((m) => m.agentId === agentId && m.listed)
  if (!listing) return resolve(null)
  const agent = agents.find((a) => a.id === agentId)
  return resolve(agent ? { ...listing, agent } : null)
}

// ── SÍNCRONO (para render directo en cliente sin estados de carga) ──
// Conveniencia mientras la fuente es local; al migrar a backend se
// reemplazan por las versiones async de arriba con SWR/Suspense.
export const sync = {
  agents: () => agents,
  competitions: () => competitions,
  agentById: (id: string) => agents.find((a) => a.id === id) || null,
  competitionById: (id: string) => competitions.find((c) => c.id === id) || null,
  rankedAgents: (category: Category | "all" = "all") => {
    let result = [...agents]
    if (category !== "all") result = result.filter((a) => a.category === category)
    return result.sort((a, b) => b.score - a.score)
  },
  enrolledCompetitions: (agentId: string) =>
    competitions.filter((c) => c.results?.some((r) => r.agentId === agentId)),
  marketplaceListings: (): MarketplaceListingWithAgent[] =>
    marketplace
      .filter((m) => m.listed)
      .map((m) => {
        const agent = agents.find((a) => a.id === m.agentId)
        return agent ? { ...m, agent } : null
      })
      .filter((m): m is MarketplaceListingWithAgent => m !== null),
  listingByAgentId: (agentId: string): MarketplaceListingWithAgent | null => {
    const listing = marketplace.find((m) => m.agentId === agentId && m.listed)
    if (!listing) return null
    const agent = agents.find((a) => a.id === agentId)
    return agent ? { ...listing, agent } : null
  },
}
