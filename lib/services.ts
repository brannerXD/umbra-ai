// ========================================
// UMBRA — CAPA DE SERVICIOS
// Consultas reales contra Supabase. Mapea las filas snake_case de la
// base de datos a los tipos camelCase que consume la UI.
// ========================================

import { supabase } from "./supabase"
import { formatListingPrice, getCategoryLabel } from "./umbra"
import type { Lang } from "./i18n"
import type {
  ActivityEvent,
  Agent,
  AgentHistoryEntry,
  AgentLicense,
  FeedbackEntry,
  GrowthData,
  GrowthDay,
  MyActivity,
  ReputationJourney,
  UserActivity,
  UserEvent,
  AgentVersion,
  BillingModel,
  Category,
  CertificateFormat,
  CertificateIssuance,
  Competition,
  CompetitionEvaluation,
  CompetitionResult,
  ListingType,
  MarketplaceListingWithAgent,
  PurchasedAgent,
  PurchaseStatus,
  SellerStats,
  UserProfile,
  PublicProfile,
  ProfileSummary,
  AdminProfile,
} from "./types"

// ── MAPEOS DB → UI ───────────────────────

// Columnas de agents que si puede leer el cliente. El endpoint del vendedor
// queda deliberadamente fuera: es el activo que protege la licencia por URL,
// y a nivel de base de datos tambien esta revocado para anon/authenticated.
const AGENT_COLS =
  "id, name, description, category, category_label, owner_id, verified, archived, score, wins, comps_count, avg_score, last_comp, score_evolution"

// Igual que AGENT_COLS pero con el autor embebido, para mostrar "hecho por" y
// enlazar a su perfil. Se usa en las consultas de agentes de nivel superior;
// las anidadas (marketplace, compras) siguen con AGENT_COLS.
const AGENT_SELECT = `${AGENT_COLS}, creator:profiles!agents_owner_id_fkey(id, username, avatar_url)`

interface AgentRow {
  id: string
  name: string
  description: string | null
  category: string
  category_label: string | null
  owner_id: string | null
  verified: boolean | null
  archived: boolean | null
  score: number | null
  wins: number | null
  comps_count: number | null
  avg_score: number | string | null
  last_comp: string | null
  score_evolution: number[] | null
  creator?: { id: string; username: string | null; avatar_url: string | null } | null
}

function mapAgent(row: AgentRow, history: AgentHistoryEntry[] = []): Agent {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    category: row.category as Category,
    categoryLabel: row.category_label ?? getCategoryLabel(row.category),
    ownerId: row.owner_id,
    verified: row.verified ?? false,
    archived: row.archived ?? false,
    score: row.score ?? 0,
    wins: row.wins ?? 0,
    comps: row.comps_count ?? 0,
    avgScore: Number(row.avg_score ?? 0),
    lastComp: row.last_comp ?? "—",
    history,
    scoreEvolution: row.score_evolution ?? [],
    creator: row.creator
      ? { id: row.creator.id, username: row.creator.username ?? "Usuario", avatarUrl: row.creator.avatar_url }
      : null,
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
    evaluator: row.evaluator ?? "Juez de IA",
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
  const { data, error } = await supabase
    .from("agents")
    .select(AGENT_SELECT)
    .eq("archived", false)
    .order("score", { ascending: false })
  if (error || !data) return []
  return data.map((row) => mapAgent(row as unknown as AgentRow))
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
  const { data, error } = await supabase.from("agents").select(AGENT_SELECT).eq("id", id).maybeSingle()
  if (error || !data) return null
  const history = await getAgentHistory(id)
  return mapAgent(data as unknown as AgentRow, history)
}

export async function getRankedAgents(category: Category | "all" = "all"): Promise<Agent[]> {
  let query = supabase.from("agents").select(AGENT_SELECT).eq("archived", false).order("score", { ascending: false })
  if (category !== "all") query = query.eq("category", category)
  const { data, error } = await query
  if (error || !data) return []
  return data.map((row) => mapAgent(row as unknown as AgentRow))
}

export async function getAgentsByOwner(ownerId: string | null): Promise<Agent[]> {
  if (!ownerId) return []
  const { data, error } = await supabase.from("agents").select(AGENT_SELECT).eq("owner_id", ownerId)
  if (error || !data) return []
  return data.map((row) => mapAgent(row as unknown as AgentRow))
}

export async function updateAgentDescription(agentId: string, description: string): Promise<boolean> {
  const { error } = await supabase.from("agents").update({ description }).eq("id", agentId)
  return !error
}

export async function archiveAgent(agentId: string): Promise<boolean> {
  const { error } = await supabase.from("agents").update({ archived: true }).eq("id", agentId)
  return !error
}

export async function registerAgent(input: {
  name: string
  description: string
  category: Category
  // Un agente puede ser de tres clases, y solo una de estas dos columnas se llena:
  //   endpoint      → el creador desplego su propio servidor.
  //   systemPrompt  → Umbra lo ejecuta contra un modelo (no requiere servidor).
  //   ninguna       → solo se vende como codigo, no compite.
  endpoint?: string | null
  systemPrompt?: string | null
  ownerId: string
}): Promise<Agent | null> {
  const { data, error } = await supabase
    .from("agents")
    .insert({
      name: input.name,
      description: input.description,
      category: input.category,
      category_label: getCategoryLabel(input.category),
      endpoint: input.endpoint ?? null,
      system_prompt: input.systemPrompt ?? null,
      owner_id: input.ownerId,
      verified: true,
    })
    .select(AGENT_COLS)
    .single()

  if (error || !data) {
    console.error("registerAgent failed", error)
    return null
  }
  return mapAgent(data as AgentRow)
}

/**
 * Ejecuta un prompt de sistema contra el modelo, sin guardar nada. Sirve para
 * que el creador vea a su agente responder antes de registrarlo.
 */
export async function probarAgente(
  systemPrompt: string,
  prompt: string,
): Promise<{ ok: boolean; respuesta?: string; ms?: number; message?: string }> {
  const { data, error } = await supabase.functions.invoke("probar-agente", {
    body: { systemPrompt, prompt },
  })
  if (error && !data) {
    return { ok: false, message: "No se pudo contactar el motor de agentes." }
  }
  if (!data?.ok) {
    return { ok: false, message: data?.message ?? "El agente no devolvió respuesta." }
  }
  return { ok: true, respuesta: data.respuesta, ms: data.ms }
}

/**
 * Devuelve el prompt de sistema de un agente propio. La columna esta revocada
 * para el cliente, asi que pasa por una RPC que valida la propiedad.
 */
export async function getMyAgentPrompt(agentId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("my_agent_prompt", { p_agent_id: agentId })
  if (error) return null
  return (data as string | null) ?? null
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

export async function enrollAgent(
  competitionId: string,
  agentId: string,
): Promise<{ ok: boolean; already?: boolean }> {
  const { error } = await supabase
    .from("competition_entries")
    .insert({ competition_id: competitionId, agent_id: agentId })
  if (error) {
    // 23505 = violación de unicidad: el agente ya estaba inscrito en esta competencia.
    if (error.code === "23505") return { ok: false, already: true }
    console.error("enrollAgent failed", error)
    return { ok: false }
  }
  return { ok: true }
}

// Resumen para el panel de administración. Lo calcula la función SECURITY
// DEFINER `admin_stats` (solo admins). Una sola llamada trae todo.
export interface AdminStats {
  usersTotal: number
  usersLast7d: number
  agentsTotal: number
  competitionsTotal: number
  evaluationsTotal: number
  listingsTotal: number
  purchasesTotal: number
  certificatesTotal: number
  competitionsByStatus: Record<string, number>
  listingsByType: Record<string, number>
  agentsByCategory: { label: string; value: number }[]
  /** Competencias cruzadas por categoria y estado. */
  competitionsByCategory: {
    label: string
    en_curso: number
    proxima: number
    completada: number
    total: number
  }[]
  topAgents: { label: string; value: number }[]
}

export async function getAdminStats(): Promise<AdminStats | null> {
  const { data, error } = await supabase.rpc("admin_stats")
  if (error || !data) {
    console.error("getAdminStats failed", error)
    return null
  }
  const d = data as Record<string, unknown>
  return {
    usersTotal: Number(d.users_total ?? 0),
    usersLast7d: Number(d.users_last_7d ?? 0),
    agentsTotal: Number(d.agents_total ?? 0),
    competitionsTotal: Number(d.competitions_total ?? 0),
    evaluationsTotal: Number(d.evaluations_total ?? 0),
    listingsTotal: Number(d.listings_total ?? 0),
    purchasesTotal: Number(d.purchases_total ?? 0),
    certificatesTotal: Number(d.certificates_total ?? 0),
    competitionsByStatus: (d.competitions_by_status as Record<string, number>) ?? {},
    listingsByType: (d.listings_by_type as Record<string, number>) ?? {},
    agentsByCategory: (d.agents_by_category as { label: string; value: number }[]) ?? [],
    competitionsByCategory:
      (d.competitions_by_category as AdminStats["competitionsByCategory"]) ?? [],
    topAgents: (d.top_agents as { label: string; value: number }[]) ?? [],
  }
}

// Crea y publica una competencia. Solo admins: la validación real la hace la
// función SECURITY DEFINER `create_competition` en la base (RLS bloquea el
// insert directo). Devuelve el id de la competencia o null si falla.
export async function createCompetition(input: {
  title: string
  category: Category
  prompt: string
  agentsMax: number
}): Promise<string | null> {
  const { data, error } = await supabase.rpc("create_competition", {
    p_title: input.title,
    p_category: input.category,
    p_category_label: getCategoryLabel(input.category),
    p_prompt: input.prompt,
    p_agents_max: input.agentsMax,
  })
  if (error) {
    console.error("createCompetition failed", error)
    return null
  }
  return data as string
}

// ── MARKETPLACE ──────────────────────────

interface ListingRow {
  id: string
  agent_id: string
  listed: boolean
  listing_type: string
  price: number
  price_unit: string
  billing_model: string
  code_license: string | null
  code_path: string | null
  description: string | null
  listed_at: string
  image_url: string | null
  documentation: string | null
  compatible_models: string[] | null
  git_repo: string | null
  technologies: string[] | null
  dependencies: string | null
  readme: string | null
  agents: (AgentRow & { profiles: { username: string | null } | null }) | null
}

function mapListing(row: ListingRow): MarketplaceListingWithAgent {
  const agent = row.agents as AgentRow
  return {
    agentId: row.agent_id,
    listingId: row.id,
    listed: row.listed,
    listingType: (row.listing_type as ListingType) ?? "acceso",
    price: Number(row.price),
    priceUnit: row.price_unit,
    billingModel: (row.billing_model as BillingModel) ?? "mensual",
    codeLicense: row.code_license,
    codePath: row.code_path,
    description: row.description ?? "",
    sellerName: row.agents?.profiles?.username ?? "Usuario",
    listedAt: new Date(row.listed_at),
    imageUrl: row.image_url,
    documentation: row.documentation,
    compatibleModels: row.compatible_models,
    gitRepo: row.git_repo,
    technologies: row.technologies,
    dependencies: row.dependencies,
    readme: row.readme,
    agent: mapAgent(agent),
  }
}

export async function getMarketplaceListings(): Promise<MarketplaceListingWithAgent[]> {
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select(`*, agents(${AGENT_COLS}, profiles(username))`)
    .eq("listed", true)
  if (error || !data) return []
  return (data as unknown as ListingRow[]).filter((r) => r.agents).map(mapListing)
}

export async function getListingByAgentId(agentId: string): Promise<MarketplaceListingWithAgent | null> {
  const { data, error } = await supabase
    .from("marketplace_listings")
    .select(`*, agents(${AGENT_COLS}, profiles(username))`)
    .eq("agent_id", agentId)
    .eq("listed", true)
    .maybeSingle()
  if (error || !data) return null
  return mapListing(data as unknown as ListingRow)
}

export async function createListing(input: {
  agentId: string
  listingType: ListingType
  price: number
  priceUnit: string
  billingModel: BillingModel
  description: string
  codeLicense?: string | null
  codePath?: string | null
  // Metadata extendida (toda opcional; según el tipo de listado)
  imageUrl?: string | null
  documentation?: string | null
  compatibleModels?: string[] | null
  gitRepo?: string | null
  technologies?: string[] | null
  dependencies?: string | null
  readme?: string | null
}): Promise<string | null> {
  const { data, error } = await supabase
    .from("marketplace_listings")
    .insert({
      agent_id: input.agentId,
      listing_type: input.listingType,
      price: input.price,
      price_unit: input.priceUnit,
      billing_model: input.billingModel,
      description: input.description,
      code_license: input.codeLicense ?? null,
      code_path: input.codePath ?? null,
      image_url: input.imageUrl ?? null,
      documentation: input.documentation ?? null,
      compatible_models: input.compatibleModels ?? null,
      git_repo: input.gitRepo ?? null,
      technologies: input.technologies ?? null,
      dependencies: input.dependencies ?? null,
      readme: input.readme ?? null,
    })
    .select("id")
    .single()
  if (error || !data) {
    console.error("createListing failed", error)
    return null
  }
  return data.id as string
}

// Sube el ZIP de una versión concreta al bucket privado y devuelve su ruta.
// Cada versión vive en su propia ruta inmutable: `userId/agentId/version.zip`.
// Solo el dueño puede escribir en su carpeta (RLS de storage).
export async function uploadAgentCode(
  userId: string,
  agentId: string,
  version: string,
  file: File,
): Promise<string | null> {
  const safeVersion = version.replace(/[^a-zA-Z0-9._-]/g, "")
  const path = `${userId}/${agentId}/${safeVersion}.zip`
  const { error } = await supabase.storage
    .from("agent-code")
    .upload(path, file, { upsert: true, contentType: "application/zip" })
  if (error) {
    console.error("uploadAgentCode failed", error)
    return null
  }
  return path
}

// Sube una imagen de producto al bucket público `agent-images` y devuelve su URL.
export async function uploadAgentImage(
  userId: string,
  agentId: string,
  file: File,
): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "png"
  const path = `${userId}/${agentId}.${ext}`
  const { error } = await supabase.storage
    .from("agent-images")
    .upload(path, file, { upsert: true, cacheControl: "3600" })
  if (error) {
    console.error("uploadAgentImage failed", error)
    return null
  }
  const { data } = supabase.storage.from("agent-images").getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}

// ── VERSIONES DEL AGENTE COMPLETO ────────

interface AgentVersionRow {
  id: string
  listing_id: string
  version: string
  code_path: string
  changelog: string | null
  created_at: string
}

function mapAgentVersion(row: AgentVersionRow): AgentVersion {
  return {
    id: row.id,
    listingId: row.listing_id,
    version: row.version,
    codePath: row.code_path,
    changelog: row.changelog,
    createdAt: new Date(row.created_at),
  }
}

// Registra una nueva versión (v1.0, v1.1, v2.0...) y actualiza el code_path del
// listado para que apunte a la última. Devuelve la versión creada.
export async function createAgentVersion(input: {
  listingId: string
  version: string
  codePath: string
  changelog?: string | null
}): Promise<AgentVersion | null> {
  const { data, error } = await supabase
    .from("agent_versions")
    .insert({
      listing_id: input.listingId,
      version: input.version,
      code_path: input.codePath,
      changelog: input.changelog ?? null,
    })
    .select("*")
    .single()
  if (error || !data) {
    console.error("createAgentVersion failed", error)
    return null
  }
  // El listado apunta siempre a la última versión (compatibilidad + descarga por defecto).
  await supabase
    .from("marketplace_listings")
    .update({ code_path: input.codePath })
    .eq("id", input.listingId)
  return mapAgentVersion(data as AgentVersionRow)
}

export async function getAgentVersions(listingId: string): Promise<AgentVersion[]> {
  const { data, error } = await supabase
    .from("agent_versions")
    .select("*")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
  if (error || !data) return []
  return (data as AgentVersionRow[]).map(mapAgentVersion)
}

// ── COMPRAS ──────────────────────────────

// Registra la compra. Aún sin cobro real: deja constancia del derecho de
// acceso/descarga, que es lo que habilita la RLS del bucket privado. Para el
// código, guarda qué versión se compró.
/**
 * Inicia una compra REAL. Ya no se inserta la compra desde el navegador (eso
 * permitiria regalarse un agente sin pagar): se le pide al servidor que cree la
 * compra en pendiente y devuelva la URL de la pasarela. La compra solo pasa a
 * completada cuando el webhook confirma el pago.
 *
 * Devuelve la URL a la que hay que enviar al comprador.
 */
export async function iniciarCompra(input: {
  listingId: string
  versionId?: string | null
}): Promise<{ ok: true; url: string } | { ok: false; message: string; codigo?: string }> {
  const { data: sesion } = await supabase.auth.getSession()
  const token = sesion.session?.access_token
  if (!token) return { ok: false, message: "Debes iniciar sesion para comprar." }

  try {
    const res = await fetch("/api/pagos/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ listingId: input.listingId, versionId: input.versionId ?? null }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.url) {
      return {
        ok: false,
        message: data?.error ?? "No se pudo iniciar la compra.",
        codigo: data?.codigo,
      }
    }
    return { ok: true, url: data.url as string }
  } catch (e) {
    console.error("iniciarCompra fallo", e)
    return { ok: false, message: "No se pudo contactar el servidor de pagos." }
  }
}

// IDs de listados que este usuario ya compró (para mostrar la descarga).
export async function getPurchasedListingIds(buyerId: string): Promise<string[]> {
  const { data, error } = await supabase.from("purchases").select("listing_id").eq("buyer_id", buyerId)
  if (error || !data) return []
  return data.map((p) => p.listing_id as string)
}

// "Mis Agentes Comprados": todo lo que el usuario compró, con sus versiones,
// estado y si hay una actualización disponible.
interface PurchaseRow {
  id: string
  listing_id: string
  status: string
  created_at: string
  version_id: string | null
  marketplace_listings: (ListingRow & { agent_versions: AgentVersionRow[] | null }) | null
}

export async function getPurchasedAgents(buyerId: string): Promise<PurchasedAgent[]> {
  const { data, error } = await supabase
    .from("purchases")
    .select(
      `id, listing_id, status, created_at, version_id, marketplace_listings(*, agents(${AGENT_COLS}, profiles(username)), agent_versions(*)), agent_licenses(id, key_prefix, status, calls_count, last_used_at, created_at)`,
    )
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false })

  if (error || !data) return []

  return (data as unknown as PurchaseRow[])
    .filter((p) => p.marketplace_listings && p.marketplace_listings.agents)
    .map((p) => {
      const listingRow = p.marketplace_listings as ListingRow & { agent_versions: AgentVersionRow[] | null }
      const versions = (listingRow.agent_versions ?? [])
        .map(mapAgentVersion)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      const latestVersion = versions[0]?.version ?? null
      const boughtVersion = p.version_id
        ? versions.find((v) => v.id === p.version_id)?.version ?? null
        : null
      const hasUpdate = !!boughtVersion && !!latestVersion && boughtVersion !== latestVersion
      const licRow = (p as unknown as { agent_licenses: LicenseRow[] | LicenseRow | null }).agent_licenses
      const lic = Array.isArray(licRow) ? licRow[0] ?? null : licRow
      return {
        purchaseId: p.id,
        listing: mapListing(listingRow),
        status: p.status as PurchaseStatus,
        purchasedAt: new Date(p.created_at),
        boughtVersion,
        latestVersion,
        hasUpdate,
        versions,
        license: lic
          ? {
              id: lic.id,
              keyPrefix: lic.key_prefix,
              status: lic.status as AgentLicense["status"],
              callsCount: Number(lic.calls_count ?? 0),
              lastUsedAt: lic.last_used_at ? new Date(lic.last_used_at) : null,
              createdAt: new Date(lic.created_at),
            }
          : null,
      } satisfies PurchasedAgent
    })
}

// Registra una descarga (para las métricas del vendedor). Silencioso si falla.
export async function logDownload(input: {
  listingId: string
  versionId?: string | null
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const uid = userData.user?.id
  if (!uid) return
  await supabase.from("downloads").insert({
    listing_id: input.listingId,
    version_id: input.versionId ?? null,
    user_id: uid,
  })
}

// URL temporal de descarga del código. Solo funciona si la RLS lo permite
// (eres el dueño o compraste el listado). Registra la descarga para métricas.
export async function getCodeDownloadUrl(
  codePath: string,
  track?: { listingId: string; versionId?: string | null },
): Promise<string | null> {
  const { data, error } = await supabase.storage.from("agent-code").createSignedUrl(codePath, 60)
  if (error || !data) {
    console.error("getCodeDownloadUrl failed", error)
    return null
  }
  if (track) await logDownload(track)
  return data.signedUrl
}

// ── PANEL DEL VENDEDOR ───────────────────

export async function getSellerStats(): Promise<SellerStats | null> {
  const { data, error } = await supabase.rpc("seller_stats")
  if (error || !data) {
    console.error("getSellerStats failed", error)
    return null
  }
  const d = data as Record<string, unknown>
  return {
    listingsTotal: Number(d.listings_total ?? 0),
    salesTotal: Number(d.sales_total ?? 0),
    revenueTotal: Number(d.revenue_total ?? 0),
    downloadsTotal: Number(d.downloads_total ?? 0),
    buyers: (d.buyers as SellerStats["buyers"]) ?? [],
    topVersion: (d.top_version as SellerStats["topVersion"]) ?? null,
    salesByAgent: (d.sales_by_agent as SellerStats["salesByAgent"]) ?? [],
  }
}

// ── PERFIL ────────────────────────────────

interface ProfileRow {
  id: string
  username: string | null
  avatar_url: string | null
  bio: string | null
  username_updated_at: string
}

// Columnas públicas de profiles. El email queda fuera a propósito: está revocado
// a nivel de base y el dueño lo obtiene de su sesión de auth, no de aquí.
const PROFILE_COLS = "id, username, avatar_url, bio, username_updated_at"

function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    username: row.username ?? "Usuario",
    avatarUrl: row.avatar_url,
    bio: row.bio ?? "",
    usernameUpdatedAt: new Date(row.username_updated_at),
  }
}

export async function getUserProfile(id: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from("profiles").select(PROFILE_COLS).eq("id", id).maybeSingle()
  if (error || !data) return null
  return mapProfile(data as ProfileRow)
}

// ── PERFIL PÚBLICO, BÚSQUEDA Y ADMIN ─────

/**
 * Perfil público de un usuario: lo que ve cualquiera en /u?id=. Sin email.
 * Incluye sus agentes y unas estadísticas derivadas, más la insignia de
 * "primer agente" (creó al menos uno).
 */
export async function getPublicProfile(id: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, bio, created_at")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return null

  const row = data as { id: string; username: string | null; avatar_url: string | null; bio: string | null; created_at: string }
  const agents = (await getAgentsByOwner(id)).filter((a) => !a.archived)

  const totalScore = agents.reduce((acc, a) => acc + a.score, 0)
  const wins = agents.reduce((acc, a) => acc + a.wins, 0)
  const bestScore = agents.reduce((acc, a) => Math.max(acc, a.score), 0)

  return {
    id: row.id,
    username: row.username ?? "Usuario",
    avatarUrl: row.avatar_url,
    bio: row.bio ?? "",
    createdAt: new Date(row.created_at),
    agents,
    stats: { agents: agents.length, totalScore, wins, bestScore },
    firstAgent: agents.length > 0,
  }
}

/** Busca agentes por nombre (no archivados). Incluye el autor. */
export async function searchAgents(query: string, limit = 20): Promise<Agent[]> {
  const q = query.trim()
  if (!q) return []
  const { data, error } = await supabase
    .from("agents")
    .select(AGENT_SELECT)
    .eq("archived", false)
    .ilike("name", `%${q}%`)
    .order("score", { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map((r) => mapAgent(r as unknown as AgentRow))
}

/** Busca perfiles por apodo. Devuelve solo datos públicos. */
export async function searchProfiles(query: string, limit = 20): Promise<ProfileSummary[]> {
  const q = query.trim()
  if (!q) return []
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, bio")
    .ilike("username", `%${q}%`)
    .limit(limit)
  if (error || !data) return []
  return (data as { id: string; username: string | null; avatar_url: string | null; bio: string | null }[]).map((p) => ({
    id: p.id,
    username: p.username ?? "Usuario",
    avatarUrl: p.avatar_url,
    bio: p.bio ?? "",
  }))
}

/** Lista de usuarios para el panel de admin, con cuántos agentes tiene cada uno. */
export async function listAllProfiles(): Promise<AdminProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, created_at")
    .order("created_at", { ascending: false })
  if (error || !data) return []

  // Conteo de agentes por dueño, en una sola consulta.
  const { data: agentRows } = await supabase.from("agents").select("owner_id").eq("archived", false)
  const counts = new Map<string, number>()
  for (const a of (agentRows ?? []) as { owner_id: string | null }[]) {
    if (a.owner_id) counts.set(a.owner_id, (counts.get(a.owner_id) ?? 0) + 1)
  }

  return (data as { id: string; username: string | null; avatar_url: string | null; created_at: string }[]).map((p) => ({
    id: p.id,
    username: p.username ?? "Usuario",
    avatarUrl: p.avatar_url,
    createdAt: new Date(p.created_at),
    agentsCount: counts.get(p.id) ?? 0,
  }))
}

export async function updateProfile(
  id: string,
  input: { username?: string; bio?: string },
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from("profiles").update(input).eq("id", id)
  if (error) {
    if (error.message.includes("cada 60 dias")) {
      return { ok: false, message: "Solo puedes cambiar tu apodo cada 60 días." }
    }
    return { ok: false, message: "No se pudo actualizar el perfil." }
  }
  return { ok: true }
}

// ── ACTIVIDAD ─────────────────────────────

// Textos de la actividad del perfil. Van aqui porque se arman junto al dato.
const ACT_T = {
  es: {
    registraste: (n: string) => `Registraste el agente ${n}`,
    compitio: (n: string, gano: boolean, comp: string) =>
      `${n} ${gano ? "ganó" : "compitió en"} "${comp}"`,
    score: (s: number) => `Score: ${s}/100`,
    listado: (n: string) => `${n} está disponible en el marketplace`,
  },
  en: {
    registraste: (n: string) => `You registered the agent ${n}`,
    compitio: (n: string, gano: boolean, comp: string) =>
      `${n} ${gano ? "won" : "competed in"} "${comp}"`,
    score: (s: number) => `Score: ${s}/100`,
    listado: (n: string) => `${n} is available on the marketplace`,
  },
} as const

export async function getActivityForUser(
  ownerId: string,
  lang: Lang = "es",
): Promise<ActivityEvent[]> {
  const t = ACT_T[lang]
  const { data: agentRows } = await supabase
    .from("agents")
    .select("id, name, created_at")
    .eq("owner_id", ownerId)

  const agents = agentRows ?? []
  if (agents.length === 0) return []

  const agentIds = agents.map((a) => a.id)
  const nameById = new Map(agents.map((a) => [a.id, a.name]))

  const events: ActivityEvent[] = agents.map((a) => ({
    type: "registered",
    date: new Date(a.created_at),
    title: t.registraste(a.name),
    detail: "",
    agentId: a.id,
  }))

  const { data: entries } = await supabase
    .from("competition_entries")
    .select("agent_id, final_score, created_at, competitions(id, title, winner_id)")
    .in("agent_id", agentIds)
    .not("final_score", "is", null)

  interface EntryActivityRow {
    agent_id: string
    final_score: number
    created_at: string
    competitions: { id: string; title: string; winner_id: string | null } | null
  }
  ;(entries as unknown as EntryActivityRow[] | null)?.forEach((e) => {
    const won = e.competitions?.winner_id === e.agent_id
    events.push({
      type: "competed",
      date: new Date(e.created_at),
      title: t.compitio(nameById.get(e.agent_id) ?? "", won, e.competitions?.title ?? "—"),
      detail: t.score(e.final_score),
      agentId: e.agent_id,
      competitionId: e.competitions?.id,
    })
  })

  const { data: listings } = await supabase
    .from("marketplace_listings")
    .select("agent_id, price, price_unit, billing_model, listed_at")
    .in("agent_id", agentIds)

  listings?.forEach((l) => {
    events.push({
      type: "listed",
      date: new Date(l.listed_at),
      title: t.listado(nameById.get(l.agent_id) ?? ""),
      detail: formatListingPrice(l.price, l.price_unit, l.billing_model, lang),
      agentId: l.agent_id,
    })
  })

  return events.sort((a, b) => b.date.getTime() - a.date.getTime())
}

// ── CERTIFICADO DE REPUTACIÓN ───────────

// Mínimo de competencias completadas para poder emitir un certificado —
// evita certificar agentes con una sola prueba.
export const MIN_COMPS_FOR_CERTIFICATE = 3

interface CertificateIssuanceRow {
  id: string
  agent_id: string
  format: CertificateFormat
  agent_name: string
  avg_score: number | string
  comps_count: number
  wins: number
  score: number
  issued_at: string
}

function mapCertificateIssuance(row: CertificateIssuanceRow): CertificateIssuance {
  return {
    id: row.id,
    agentId: row.agent_id,
    format: row.format,
    agentName: row.agent_name,
    avgScore: Number(row.avg_score),
    comps: row.comps_count,
    wins: row.wins,
    score: row.score,
    issuedAt: new Date(row.issued_at),
  }
}

// Registra una emisión (snapshot de los datos del agente en ese momento) y la devuelve.
// La emisión pasa por la función `issue_certificate` en Postgres, que deriva los
// valores del registro real del agente. Así el certificado no se puede falsificar:
// el cliente no inserta filas directamente ni puede inflar los puntajes.
export async function issueCertificate(agent: Agent, format: CertificateFormat): Promise<CertificateIssuance | null> {
  const { data, error } = await supabase.rpc("issue_certificate", {
    p_agent_id: agent.id,
    p_format: format,
  })

  if (error || !data) {
    console.error("issueCertificate failed", error)
    return null
  }
  return mapCertificateIssuance(data as CertificateIssuanceRow)
}

export async function getCertificateIssuances(agentId: string): Promise<CertificateIssuance[]> {
  const { data, error } = await supabase
    .from("certificate_issuances")
    .select("*")
    .eq("agent_id", agentId)
    .order("issued_at", { ascending: false })

  if (error || !data) return []
  return data.map((row) => mapCertificateIssuance(row as CertificateIssuanceRow))
}

// ── LICENCIAS DE ACCESO POR API ──────────

interface LicenseRow {
  id: string
  key_prefix: string
  status: string
  calls_count: number | string | null
  last_used_at: string | null
  created_at: string
}

/**
 * Emite (o rota) la llave de una compra de tipo "acceso".
 * Devuelve la llave EN CLARO, que solo se puede ver este momento: la base
 * guarda unicamente su hash. Si se pierde, hay que volver a emitir.
 */
export async function issueLicense(purchaseId: string): Promise<
  { ok: true; key: string } | { ok: false; message: string }
> {
  const { data, error } = await supabase.rpc("issue_license", { p_purchase_id: purchaseId })
  if (error || typeof data !== "string") {
    console.error("issueLicense failed", error)
    return { ok: false, message: error?.message ?? "No se pudo emitir la licencia." }
  }
  return { ok: true, key: data }
}

// ── OPINIONES ───────────────────────────

/** Envia una opinion sobre Umbra. Queda privada hasta que el admin la publique. */
export async function submitFeedback(input: {
  userId: string
  message: string
  rating: number | null
  authorConsent: boolean
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from("feedback").insert({
    user_id: input.userId,
    message: input.message.trim(),
    rating: input.rating,
    author_consent: input.authorConsent,
  })
  if (error) {
    console.error("submitFeedback failed", error)
    return { ok: false, message: error.message }
  }
  return { ok: true }
}

/** Bandeja completa de opiniones. Solo admin. */
export async function getAdminFeedback(): Promise<FeedbackEntry[]> {
  const { data, error } = await supabase.rpc("admin_feedback")
  if (error || !Array.isArray(data)) {
    console.error("getAdminFeedback failed", error)
    return []
  }
  return (data as Record<string, unknown>[]).map((f) => ({
    id: String(f.id),
    message: String(f.message ?? ""),
    rating: f.rating == null ? null : Number(f.rating),
    authorConsent: Boolean(f.author_consent),
    published: Boolean(f.published),
    createdAt: new Date(String(f.created_at)),
    author: String(f.author ?? ""),
  }))
}

/** Publica o retira una opinion. Falla si el autor no dio consentimiento. */
export async function setFeedbackPublished(
  id: string,
  published: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("admin_set_feedback_published", {
    p_id: id,
    p_published: published,
  })
  if (error) {
    console.error("setFeedbackPublished failed", error)
    return { ok: false, message: error.message }
  }
  return { ok: true }
}

// ── ACTIVIDAD (panel de admin) ──────────

export async function getGrowth(days = 30): Promise<GrowthData | null> {
  const { data, error } = await supabase.rpc("admin_growth", { p_days: days })
  if (error || !data) {
    console.error("getGrowth failed", error)
    return null
  }
  const d = data as Record<string, unknown>
  return {
    days: Number(d.days ?? days),
    series: (d.series as GrowthDay[]) ?? [],
    totales: (d.totales as Record<string, number>) ?? {},
  }
}

export async function getUserActivity(limit = 50): Promise<UserActivity[]> {
  const { data, error } = await supabase.rpc("admin_user_activity", { p_limit: limit })
  if (error || !Array.isArray(data)) {
    console.error("getUserActivity failed", error)
    return []
  }
  return (data as Record<string, unknown>[]).map((u) => ({
    id: String(u.id),
    nombre: String(u.nombre ?? ""),
    registrado: String(u.registrado ?? ""),
    eventos: Number(u.eventos ?? 0),
    ultimaActividad: u.ultima_actividad ? String(u.ultima_actividad) : null,
    ultimos: (u.ultimos as UserEvent[]) ?? [],
  }))
}

/** Actividad del usuario en sesion (mapa de contribuciones del perfil). */
export async function getMyActivity(days = 365): Promise<MyActivity | null> {
  const { data, error } = await supabase.rpc("my_activity", { p_days: days })
  if (error || !data) {
    console.error("getMyActivity failed", error)
    return null
  }
  const d = data as Record<string, unknown>
  return {
    days: Number(d.days ?? days),
    desde: String(d.desde ?? ""),
    hasta: String(d.hasta ?? ""),
    total: Number(d.total ?? 0),
    dias: (d.dias as Record<string, number>) ?? {},
    porTipo: (d.por_tipo as Record<string, number>) ?? {},
    ultimos: (d.ultimos as UserEvent[]) ?? [],
  }
}

/** Trayectoria de reputacion del usuario en sesion (grafica del perfil). */
export async function getMyJourney(): Promise<ReputationJourney | null> {
  const { data, error } = await supabase.rpc("my_reputation_journey")
  if (error || !data) {
    console.error("getMyJourney failed", error)
    return null
  }
  const d = data as Record<string, unknown>
  return {
    puntos: (d.puntos as ReputationJourney["puntos"]) ?? [],
    hitos: (d.hitos as ReputationJourney["hitos"]) ?? [],
    resumen: (d.resumen as ReputationJourney["resumen"]) ?? {
      score: 0, competencias: 0, victorias: 0, mejor: 0, agentes: 0,
    },
  }
}
