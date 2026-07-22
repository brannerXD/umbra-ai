// ========================================
// UMBRA — TIPOS DEL DOMINIO
// ========================================

export type Category = "texto" | "codigo" | "prediccion" | "razonamiento" | "otro"
export type CompetitionStatus = "en-curso" | "proxima" | "completada"
export type HistoryResult = "win" | "other"

export interface AgentHistoryEntry {
  compId: string
  result: HistoryResult
  position: number
  score: number
  responseTime: number
  pts: number
  compName: string
  time: string
}

export interface Agent {
  id: string
  name: string
  description: string
  category: Category
  categoryLabel: string
  ownerId: string | null
  verified: boolean
  archived: boolean
  score: number
  wins: number
  comps: number
  avgScore: number
  lastComp: string
  history: AgentHistoryEntry[]
  scoreEvolution: number[]
}

export interface EvaluationCriterion {
  score: number
  max: number
  comment: string
}

export interface CompetitionEvaluation {
  accuracy: EvaluationCriterion
  reasoning: EvaluationCriterion
  structure: EvaluationCriterion
  utility: EvaluationCriterion
}

export interface CompetitionResult {
  agentId: string
  agentName: string
  score: number | null
  responseTime: number | null
  response: string | null
  timeout?: boolean
  evaluation?: CompetitionEvaluation | null
}

export interface Competition {
  id: string
  name: string
  category: Category
  categoryLabel: string
  status: CompetitionStatus
  evaluator: string
  agentsMax: number
  agentsEnrolled: number
  startedAt: Date
  endsAt: Date
  winnerId: string | null
  winnerName: string | null
  winnerScore: number | null
  prompt: string | null
  results: CompetitionResult[]
}

// Qué se publica en el marketplace:
//  - "acceso": usar el agente vía la API de Umbra. El creador lo sigue hospedando
//    y la reputación aplica (es el mismo agente que compitió).
//  - "codigo": comprar el código del agente completo. Pago único + licencia.
//    NO hereda la reputación: la ganó ese despliegue, no el archivo.
export type ListingType = "acceso" | "codigo"

// Cómo se cobra. El acceso siempre es NO exclusivo: el mismo agente se
// licencia a muchos compradores. "unico" es el pago único del código.
export type BillingModel = "mensual" | "uso" | "unico"

// Licencia bajo la que se vende el código.
export type CodeLicense = "Uso personal" | "Comercial" | "MIT"

export const CODE_LICENSES: CodeLicense[] = ["Uso personal", "Comercial", "MIT"]

// Estado de una compra. Hoy toda compra queda "completada" (sin cobro real,
// como el resto del marketplace); el campo deja listo el flujo para pagos.
export type PurchaseStatus = "pendiente" | "completada" | "reembolsada"

// Una versión publicada del código de un Agente Completo (v1.0, v1.1, v2.0...).
// Cada versión conserva su propio ZIP inmutable, así las compras viejas siguen
// pudiendo descargar exactamente lo que compraron.
export interface AgentVersion {
  id: string
  listingId: string
  version: string
  codePath: string
  changelog: string | null
  createdAt: Date
}

export interface MarketplaceListing {
  agentId: string
  listingId: string
  listed: boolean
  listingType: ListingType
  price: number
  priceUnit: string
  billingModel: BillingModel
  /** Solo para listingType "codigo". */
  codeLicense: string | null
  /** Ruta en el bucket privado `agent-code` (apunta a la última versión). Solo "codigo". */
  codePath: string | null
  description: string
  sellerName: string
  listedAt: Date
  // ── Metadata extendida ──
  /** Imagen de producto (URL pública del bucket `agent-images`). */
  imageUrl: string | null
  /** Documentación / guía de uso. */
  documentation: string | null
  /** Modelos compatibles — sobre todo para listados "acceso" (URL). */
  compatibleModels: string[] | null
  /** Repositorio Git opcional — para "codigo". */
  gitRepo: string | null
  /** Tecnologías utilizadas — para "codigo". */
  technologies: string[] | null
  /** Dependencias (texto libre / requirements) — para "codigo". */
  dependencies: string | null
  /** README del proyecto — para "codigo". */
  readme: string | null
}

export interface MarketplaceListingWithAgent extends MarketplaceListing {
  agent: Agent
}

// Un agente que el usuario COMPRÓ (para "Mis Agentes Comprados").
/** Licencia de acceso por API. La llave en claro solo existe al emitirla. */
export interface AgentLicense {
  id: string
  keyPrefix: string
  status: "activa" | "revocada"
  callsCount: number
  lastUsedAt: Date | null
  createdAt: Date
}

export interface PurchasedAgent {
  purchaseId: string
  listing: MarketplaceListingWithAgent
  status: PurchaseStatus
  purchasedAt: Date
  /** Versión que compró (string), o null para listados "acceso". */
  boughtVersion: string | null
  /** Última versión publicada del agente. */
  latestVersion: string | null
  /** Hay una versión más nueva que la que compró. */
  hasUpdate: boolean
  /** Todas las versiones disponibles (para descargar la que corresponda). */
  versions: AgentVersion[]
  /** Licencia de API para los listados "acceso"; null si aun no la ha emitido. */
  license: AgentLicense | null
}

// Métricas del panel del vendedor (las calcula la función `seller_stats`).
export interface SellerStats {
  listingsTotal: number
  salesTotal: number
  revenueTotal: number
  downloadsTotal: number
  buyers: { buyer: string; agent: string; price: number; priceUnit: string; status: string; at: string }[]
  topVersion: { version: string; downloads: number } | null
  salesByAgent: { label: string; value: number }[]
}

export interface UserProfile {
  id: string
  email: string | null
  username: string
  avatarUrl: string | null
  bio: string
  usernameUpdatedAt: Date
}

export type ActivityEventType = "registered" | "competed" | "listed"

export interface ActivityEvent {
  type: ActivityEventType
  date: Date
  title: string
  detail: string
  agentId: string
  competitionId?: string
}

export type CertificateFormat = "web" | "pdf"

export interface CertificateIssuance {
  id: string
  agentId: string
  format: CertificateFormat
  agentName: string
  avgScore: number
  comps: number
  wins: number
  score: number
  issuedAt: Date
}

// ── OPINIONES Y ACTIVIDAD (panel de admin) ──

/** Opinion enviada por un usuario. Nace privada. */
export interface FeedbackEntry {
  id: string
  message: string
  rating: number | null
  /** El autor autorizo mostrarla publicamente. Sin esto no se puede publicar. */
  authorConsent: boolean
  published: boolean
  createdAt: Date
  author: string
}

/** Un dia de la serie de crecimiento. */
export interface GrowthDay {
  dia: string
  usuarios: number
  agentes: number
  competencias: number
  compras: number
  llamadas: number
  descargas: number
  evaluaciones: number
}

export interface GrowthData {
  days: number
  series: GrowthDay[]
  totales: Record<string, number>
}

export type UserEventType =
  | "agente"
  | "competencia"
  | "compra"
  | "llamada_api"
  | "descarga"
  | "opinion"

export interface UserEvent {
  tipo: UserEventType
  detalle: string
  cuando: string
}

/** Resumen de actividad de un usuario, derivado de las tablas existentes. */
export interface UserActivity {
  id: string
  nombre: string
  registrado: string
  eventos: number
  ultimaActividad: string | null
  ultimos: UserEvent[]
}

/** Actividad propia del usuario, para el mapa de contribuciones del perfil. */
export interface MyActivity {
  days: number
  desde: string
  hasta: string
  total: number
  /** Solo los dias con actividad: { "2026-07-02": 2 }. */
  dias: Record<string, number>
  porTipo: Record<string, number>
  ultimos: UserEvent[]
}

/** Un punto de la trayectoria: una competencia y el score tras ella. */
export interface JourneyPoint {
  fecha: string
  score: number
  puntos: number
  puntuacion: number
  puesto: number
  gano: boolean
  competencia: string
  agente: string
}

export interface JourneyMilestone {
  fecha: string
  tipo: "agente" | "listado" | "venta"
  detalle: string
}

export interface ReputationJourney {
  puntos: JourneyPoint[]
  hitos: JourneyMilestone[]
  resumen: {
    score: number
    competencias: number
    victorias: number
    mejor: number
    agentes: number
  }
}
