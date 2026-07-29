import type { Metadata } from "next"
import { ArchivoClient } from "@/components/competencias/archivo-client"
import { listCompetitions } from "@/lib/services"
import "../competencias.css"

export const metadata: Metadata = {
  title: "Archivo de competencias — Umbra",
  description:
    "Busca en el histórico completo de competencias de Umbra por nombre, agente participante, fecha y categoría.",
}

// Mismo criterio que /competencias: ISR, se sirve desde caché y se reconsulta
// como mucho cada 30s. El archivo puede crecer mucho; nunca golpea la BD por recarga.
export const revalidate = 30

export default async function ArchivoPage() {
  const competitions = await listCompetitions()
  const completed = competitions.filter((c) => c.status === "completada")

  return (
    <main>
      <ArchivoClient competitions={completed} />
    </main>
  )
}
