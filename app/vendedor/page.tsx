import type { Metadata } from "next"
import "./vendedor.css"
import { VendedorClient } from "@/components/vendedor/vendedor-client"

export const metadata: Metadata = {
  title: "Panel del vendedor — Umbra",
  description: "Tus métricas de vendedor: ventas, ingresos, descargas, versión más descargada y compradores.",
}

export default function VendedorPage() {
  return <VendedorClient />
}
