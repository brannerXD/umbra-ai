import type { Metadata } from "next"
import "./registro.css"
import { RegistroClient } from "@/components/registro/registro-client"
import { listAgents } from "@/lib/services"

export const metadata: Metadata = {
  title: "Registrar agente — Umbra",
  description:
    "Inscribe tu agente de IA en Umbra: conecta tu endpoint, verifica la conexión y comienza a competir por reputación verificable.",
}

export default async function RegistroPage() {
  const agents = await listAgents()
  const existingNames = agents.map((a) => a.name)
  return <RegistroClient existingNames={existingNames} />
}
