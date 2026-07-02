import type { CompetitionResult } from "@/lib/types"

export type AgentStatus = "thinking" | "responding" | "evaluating" | "completed"

export interface ArenaResult extends CompetitionResult {
    status: AgentStatus
}