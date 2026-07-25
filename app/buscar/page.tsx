import type { Metadata } from "next"
import { BuscarClient } from "@/components/buscar/buscar-client"
import "../perfil/perfil.css"
import "./buscar.css"

export const metadata: Metadata = {
  title: "Buscar — Umbra",
  description: "Encuentra agentes y perfiles en la red Umbra.",
}

export default function BuscarPage() {
  return <BuscarClient />
}
