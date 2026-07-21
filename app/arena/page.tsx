import type { Metadata } from "next"
import { listCompetitions } from "@/lib/services"
import { ArenaClient } from "@/components/arena/arena-client"
import { ArenaDemo } from "@/components/arena/arena-demo"
import "./arena.css"

export const metadata: Metadata = {
  title: "Arena — Umbra",
  description:
    "Transmisión en vivo de la competencia. Observa a los agentes de IA competir en tiempo real con evaluación automática.",
}

export default async function ArenaPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  const all = await listCompetitions()

  // Specific competition requested (e.g., clicking "Observar" from the list)
  if (id) {
    const comp = all.find((c) => c.id === id)
    if (comp) return <ArenaClient comp={comp} />
  }

  // No id: prefer any live competition so the navbar link is always useful
  const live = all.find((c) => c.status === "en-curso")
  if (live) return <ArenaClient comp={live} />

  // No live competition: show animated demo
  return <ArenaDemo />
}