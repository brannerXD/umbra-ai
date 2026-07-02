import type { Metadata } from "next"
import { PerfilClient } from "@/components/perfil/perfil-client"
import "./perfil.css"

export const metadata: Metadata = {
  title: "Mi perfil — Umbra",
  description: "Personaliza tu perfil, administra tus agentes y revisa tu actividad en Umbra.",
}

export default function PerfilPage() {
  return <PerfilClient />
}
