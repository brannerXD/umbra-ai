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
  endpoint: string
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
  /** Ruta en el bucket privado `agent-code`. Solo para listingType "codigo". */
  codePath: string | null
  description: string
  sellerName: string
  listedAt: Date
}

export interface MarketplaceListingWithAgent extends MarketplaceListing {
  agent: Agent
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
