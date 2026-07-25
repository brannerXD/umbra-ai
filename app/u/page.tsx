import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPublicProfile } from "@/lib/services"
import { PerfilPublicoClient } from "@/components/perfil/perfil-publico-client"
import "../perfil/perfil.css"

export const metadata: Metadata = {
  title: "Perfil — Umbra",
  description: "Perfil público de un miembro de la red Umbra: sus agentes y su reputación.",
}

// El perfil depende de datos que cambian (agentes, scores). Debe consultarse fresco.
export const dynamic = "force-dynamic"

export default async function PerfilPublicoPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  const profile = id ? await getPublicProfile(id) : null

  if (!profile) {
    notFound()
  }

  return <PerfilPublicoClient profile={profile} />
}
