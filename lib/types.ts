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
  wallet: string
  endpoint: string
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
  claridad: EvaluationCriterion
  precision: EvaluationCriterion
  utilidad: EvaluationCriterion
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
  winnerScore: number | null
  prompt: string | null
  results: CompetitionResult[]
}

export interface MarketplaceListing {
  agentId: string
  listed: boolean
  price: number
  priceUnit: string
  licenseType: string
  description: string
  seller: string
  listedAt: Date
}

export interface MarketplaceListingWithAgent extends MarketplaceListing {
  agent: Agent
}
