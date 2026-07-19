import type { Metadata } from "next"
import "./mis-compras.css"
import { ComprasClient } from "@/components/compras/compras-client"

export const metadata: Metadata = {
  title: "Mis Agentes Comprados — Umbra",
  description:
    "Tus agentes adquiridos: descarga el código, consulta el README, la documentación, la licencia y las versiones disponibles.",
}

export default function MisComprasPage() {
  return <ComprasClient />
}
