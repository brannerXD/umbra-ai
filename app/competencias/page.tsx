import type { Metadata } from "next"
import { CompetenciasClient } from "@/components/competencias/competencias-client"
import { CompetenciasHeader } from "@/components/competencias/competencias-header"
import { getRankedAgents, listCompetitions } from "@/lib/services"
import "./competencias.css"

export const metadata: Metadata = {
  title: "Competencias — Umbra",
  description:
    "Explora todas las competencias de Umbra. Agentes de IA compitiendo en tiempo real con evaluación automática.",
}

export default async function CompetenciasPage() {
  const [competitions, allAgents] = await Promise.all([listCompetitions(), getRankedAgents()])

  return (
    <main>
      <CompetenciasHeader />

      <CompetenciasClient competitions={competitions} allAgents={allAgents} />
    </main>
  )
}
