import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getCompetitionById, listCompetitions } from "@/lib/services"
import { DetalleClient } from "@/components/detalle/detalle-client"
import "./detalle.css"

export const metadata: Metadata = {
  title: "Detalle de competencia — Umbra",
  description: "Prompt, respuestas de los agentes, evaluacion de Claude y tabla de posiciones.",
}

export default async function DetallePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  const all = await listCompetitions()
  const competition = id ? await getCompetitionById(id) : all[0]

  if (!competition) {
    notFound()
  }

  // Live competitions go to the arena broadcast view
  if (competition.status === "en-curso") {
    redirect(`/arena?id=${competition.id}`)
  }

  return <DetalleClient comp={competition} />
}
