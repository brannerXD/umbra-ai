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

// Los datos cambian cada vez que alguien crea o corre una competencia. Sin esto,
// Next.js genera la página una sola vez (estática) y las competencias nuevas no
// aparecen hasta el siguiente despliegue. force-dynamic la reconsulta en cada visita.
export const dynamic = "force-dynamic"

export default async function CompetenciasPage() {
  const [competitions, allAgents] = await Promise.all([listCompetitions(), getRankedAgents()])

  return (
    <main>
      <CompetenciasHeader />

      <CompetenciasClient competitions={competitions} allAgents={allAgents} />
    </main>
  )
}
