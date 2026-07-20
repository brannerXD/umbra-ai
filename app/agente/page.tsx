import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AgenteClient } from "@/components/agente/agente-client"
import { getAgentById, getListingByAgentId, getRankedAgents } from "@/lib/services"
import "./agente.css"

export const metadata: Metadata = {
  title: "Perfil de agente — Umbra",
  description:
    "Historial de competencias, reputacion verificable y score desglosado del agente en la red Umbra.",
}

export default async function AgentePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; vender?: string }>
}) {
  const { id, vender } = await searchParams
  const ranked = await getRankedAgents()
  const agent = id ? await getAgentById(id) : ranked[0]

  if (!agent) {
    notFound()
  }

  const rankPosition = ranked.findIndex((a) => a.id === agent.id) + 1
  const listing = await getListingByAgentId(agent.id)

  return (
    <AgenteClient
      agent={agent}
      rankPosition={rankPosition}
      listing={listing}
      // Llega desde el registro "vender el código": abre el modal ya en esa modalidad.
      autoSellCode={vender === "codigo"}
    />
  )
}
