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

// Los datos cambian cuando se crea o corre una competencia, pero no cada segundo.
// Con ISR (revalidate) se sirve desde caché y se reconsulta como mucho cada 30s:
// las competencias nuevas aparecen en <=30s y la base no se satura por recargas
// (antes, con force-dynamic, cada visita golpeaba la BD y se podía tumbar).
export const revalidate = 30

export default async function CompetenciasPage() {
  const [competitions, allAgents] = await Promise.all([listCompetitions(), getRankedAgents()])

  // Umbral de "Recientes": competencias iniciadas en las últimas 12 h. Se calcula
  // en el server (con ISR se refresca al revalidar) y se pasa al cliente para que
  // ambos filtren con el mismo valor y no haya desajuste de hidratación.
  const recentCutoffMs = Date.now() - 12 * 60 * 60 * 1000

  return (
    <main>
      <CompetenciasHeader />

      <CompetenciasClient
        competitions={competitions}
        allAgents={allAgents}
        recentCutoffMs={recentCutoffMs}
      />
    </main>
  )
}
