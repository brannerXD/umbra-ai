// ========================================
// UMBRA — CAPA DE SERVICIOS
// Consultas reales contra Supabase. Mapea las filas snake_case de la
// base de datos a los tipos camelCase que consume la UI.
// ========================================

import { supabase } from "./supabase"
import { getCategoryLabel } from "./umbra"
import type {
  Agent,
  AgentHistoryEntry,
  Category,
  Competition,
  CompetitionEvaluation,
  CompetitionResult,
  MarketplaceListingWithAgent,
} from "./types"

// ── MAPEOS DB → UI ───────────────────────

interface AgentRow {
  id: string
  name: string
  description: string | null
  category: string
  category_label: string | null
  owner_id: string | null
  endpoint: string | null
  verified: boolean | null
  score: number | null
  wins: number | null
  comps_count: number | null
  avg_score: number | string | null
  last_comp: string | null
  score_evolution: number[] | null
}

function mapAgent(row: AgentRow, history: AgentHistoryEntry[] = []): Agent {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    category: row.category as Category,
    categoryLabel: row.category_label ?? getCategoryLabel(row.category),
    ownerId: row.owner_id,
    endpoint: row.endpoint ?? "",
    verified: row.verified ?? false,
    score: row.score ?? 0,
    wins: row.wins ?? 0,
    comps: row.comps_count ?? 0,
    avgScore: Number(row.avg_score ?? 0),
    lastComp: row.last_comp ?? "—",
    history,
    scoreEvolution: row.score_evolution ?? [],
  }
}

interface CompetitionRow {
  id: string
  title: string
  prompt: string | null
  status: string
  category: string
  category_label: string | null
  evaluator: string | null
  agents_max: number | null
  agents_enrolled: number | null
  started_at: string | null
  ends_at: string | null
  winner_id: string | null
  winner_score: number | null
  agents?: { name: string } | null
}

function mapCompetition(row: CompetitionRow, results: CompetitionResult[] = []): Competition {
  return {
    id: row.id,
    name: row.title,
    category: row.category as Category,
    categoryLabel: row.category_label ?? getCategoryLabel(row.category),
    status: row.status as Competition["status"],
    evaluator: row.evaluator ?? "Claude Sonnet",
    agentsMax: row.agents_max ?? 0,
    agentsEnrolled: row.agents_enrolled ?? 0,
    startedAt: new Date(row.started_at ?? Date.now()),
    endsAt: new Date(row.ends_at ?? Date.now()),
    winnerId: row.winner_id,
    winnerName: row.agents?.name ?? null,
    winnerScore: row.winner_score,
    prompt: row.prompt,
    results,
  }
}

interface EvaluationRow {
  accuracy: number | null
  reasoning: number | null
  structure: number | null
  utility: number | null
  comments: string | null
}

interface EntryRow {
  agent_id: string
  response: string | null
  response_time_ms: number | null
  final_score: number | null
  agents: { name: string } | null
  evaluations: EvaluationRow[] | null
}

function buildEvaluation(evalRow: EvaluationRow): CompetitionEvaluation {
  const comment = evalRow.comments ?? ""
  return {
    accuracy: { score: evalRow.accuracy ?? 0, max: 100, comment },
    reasoning: { score: evalRow.reasoning ?? 0, max: 100, comment },
    structure: { score: evalRow.structure ?? 0, max: 100, comment },
    utility: { score: evalRow.utility ?? 0, max: 100, comment },
  }
}

function mapResults(entries: EntryRow[], competitionFinished: boolean): CompetitionResult[] {
  return entries.map((e) => {
    const evalRow = e.evaluations?.[0]
    const timeout = competitionFinished && e.response === null
    return {
      agentId: e.agent_id,
      agentName: e.agents?.name ?? "—",
      score: e.final_score,
      responseTime: e.response_time_ms !== null ? e.response_time_ms / 1000 : null,
      response: e.response,
      timeout,
      evaluation: evalRow ? buildEvaluation(evalRow) : null,
    }
  })
}

async function fetchResultsForCompetition(competitionId: string, status: string): Promise<CompetitionResult[]> {
  const { data, error } = await supabase
    .from("competition_entries")
    .select("agent_id, response, response_time_ms, final_score, agents(name), evaluations(accuracy, reasoning, structure, utility, comments)")
    .eq("competition_id", competitionId)

  if (error || !data) return []
  return mapResults(data as unknown as EntryRow[], status === "completada")
}

// ── AGENTES ──────────────────────────────

export async function listAgents(): Promise<Agent[]> {
  const { data, error } = await supabase.from("agents").select("*").order("score", { ascending: false })
  if (error || !data) return []
  return data.map((row) => mapAgent(row as AgentRow))
}

interface HistoryEntryRow {
  competition_id: string
  response_time_ms: number | null
  final_score: number
  created_at: string
  competitions: { title: string } | null
}

export async function getAgentHistory(agentId: string): Promise<AgentHistoryEntry[]> {
  const { data, error } = await supabase
    .from("competition_entries")
    .select("id, competition_id, response_time_ms, final_score, created_at, competitions(title)")
    .eq("agent_id", agentId)
    .not("final_score", "is", null)

  if (error || !data || data.length === 0) return []
  const rows = data as unknown as HistoryEntryRow[]

  // Para calcular la posición dentro de cada competencia, traemos todos los
  // puntajes finales de esas competencias y ordenamos localmente.
  const compIds = [...new Set(rows.map((d) => d.competition_id))]
  const { data: allEntries } = await supabase
    .from("competition_entries")
    .select("competition_id, agent_id, final_score")
    .in("competition_id", compIds)
    .not("final_score", "is", null)

  // Agrupamos por competencia y ordenamos por final_score desc para derivar la posición.
  const grouped = new Map<string, { agent_id: string; final_score: number }[]>()
  ;(allEntries ?? []).forEach((e) => {
    const arr = grouped.get(e.competition_id) ?? []
    arr.push(e)
    grouped.set(e.competition_id, arr)
  })
  grouped.forEach((arr) => arr.sort((a, b) => b.final_score - a.final_score))

  return rows
    .map((entry) => {
      const ranked = grouped.get(entry.competition_id) ?? []
      const position = ranked.findIndex((r) => r.agent_id === agentId) + 1 || ranked.length
      const pts = position === 1 ? 10 : position === 2 ? 4 : 2
      return {
        compId: entry.competition_id,
        result: position === 1 ? "win" : "other",
        position,
        score: entry.final_score,
        responseTime: entry.response_time_ms !== null ? entry.response_time_ms / 1000 : 0,
        pts,
        compName: entry.competitions?.title ?? "—",
        time: entry.created_at,
      } satisfies AgentHistoryEntry
    })
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
}

export async function getAgentById(id: string): Promise<Agent | null> {
  const { data, error } = await supabase.from("agents").select("*").eq("id", id).maybeSingle()
  if (error || !data) return null
  const history = await getAgentHistory(id)
  return mapAgent(data as AgentRow, history)
}

export async function getRankedAgents(category: Category | "all" = "all"): Promise<Agent[]> {
  let query = supabase.from("agents").select("*").order("score", { ascending: false })
  if (category !== "all") query = query.eq("category", category)
  const { data, error } = await query
  if (error || !data) return []
  return data.map((row) => mapAgent(row as AgentRow))
}

export async function getAgentsByOwner(ownerId: string | null): Promise<Agent[]> {
  if (!ownerId) return []
  const { data, error } = await supabase.from("agents").select("*").eq("owner_id", ownerId)
  if (error || !data) return []
  return data.map((row) => mapAgent(row as AgentRow))
}

export async function updateAgentDescription(agentId: string, description: string): Promise<boolean> {
  const { error } = await supabase.from("agents").update({ description }).eq("id", agentId)
  return !error
}

export async function registerAgent(input: {
  name: string
  description: string
  category: Category
  endpoint: string
  ownerId: string
}): Promise<Agent | null> {
  const { data, error } = await supabase
    .from("agents")
    .insert({
      name: input.name,
      description: input.description,
      category: input.category,
      category_label: getCategoryLabel(input.category),
      endpoint: input.endpoint,
      owner_id: input.ownerId,
      verified: true,
    })
    .select("*")
    .single()

  if (error || !data) {
    console.error("registerAgent failed", error)
    return null
  }
  return mapAgent(data as AgentRow)
}

// ── COMPETENCIAS ─────────────────────────

export async function listCompetitions(): Promise<Competition[]> {
  const { data, error } = await supabase
    .from("competitions")
    .select("*, agents!competitions_winner_id_fkey(name)")
    .order("started_at", { ascending: false })
  if (error || !data) return []

  return Promise.all(
    (data as CompetitionRow[]).map(async (row) => {
      const results = await fetchResultsForCompetition(row.id, row.status)
      return mapCompetition(row, results)
    }),
  )
}

export async function getCompetitionById(id: string): Promise<Competition | null> {
  const { data, error } = await supabase
    .from("competitions")
    .select("*, agents!competitions_winner_id_fkey(name)")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return null
  const row = data as CompetitionRow
  const results = await fetchResultsForCompetition(row.id, row.status)
  return mapCompetition(row, results)
}

export async function getEnrolledCompetitions(agentId: string): Promise<Competition[]> {
  const { data, error } = await supabase
    .from("competition_entries")
    .select("competitions(*)")
    .eq("agent_id", agentId)
  if (error || !data) return []
  const rows = (data as unknown as { competitions: CompetitionRow | null }[])
    .map((d) => d.competitions)
    .filter((c): c is CompetitionRow => c !== null)
  return Promise.all(
    rows.map(async (row) => {
      const results = await fetchResultsForCompetition(row.id, row.status)
      return mapCompetition(row, results)
    }),
  )
}

export async function enrollAgent(competitionId: string, agentId: string): Promise<boolean> {
  const { error } = await supabase
    .from("competition_entries")
    .insert({ competition_id: competitionId, agent_id: agentId })
  if (error) {
    console.error("enrollAgent failed", error)
    return false
  }
  return true
}

// ── MARKETPLACE ──────────────────────────

interface ListingRow {
  agent_id: string
  listed: boolean
  price: number
  price_unit: string
  license_type: string
  description: string | null
  listed_at: string
  agents: (AgentRow & { profiles: { username: string | null } | null }) | null
}

function mapListing(row: ListingRow): MarketplaceListingWithAgent {
  const agent = row.agents as AgentRow
  return {
    agentId: row.agent_id,
    listed: row.listed,
    price: Number(row.price),
    priceUnit: row.price_unit,
    licenseType: row.license_type,
    description: row.description ?? "",
    sellerName: row.agents?.profiles?.username ?? "Usuario",
    listedAt: new Date(row.listed_at),
    agent: mapAgent(agent),
  }
}

export async function getMarketplaceListings(): Promise<MarketplaceListingWithAgent[]> {
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select("*, agents(*, profiles(username))")
    .eq("listed", true)
  if (error || !data) return []
  return (data as unknown as ListingRow[]).filter((r) => r.agents).map(mapListing)
}

export async function getListingByAgentId(agentId: string): Promise<MarketplaceListingWithAgent | null> {
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select("*, agents(*, profiles(username))")
    .eq("agent_id", agentId)
    .eq("listed", true)
    .maybeSingle()
  if (error || !data) return null
  return mapListing(data as unknown as ListingRow)
}

export async function createListing(input: {
  agentId: string
  price: number
  priceUnit: string
  licenseType: string
  description: string
}): Promise<boolean> {
  const { error } = await supabase.from("marketplace_listings").insert({
    agent_id: input.agentId,
    price: input.price,
    price_unit: input.priceUnit,
    license_type: input.licenseType,
    description: input.description,
  })
  if (error) {
    console.error("createListing failed", error)
    return false
  }
  return true
}
