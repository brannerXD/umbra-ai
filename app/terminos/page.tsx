import type { Metadata } from "next"
import "./terminos.css"
import { TerminosClient } from "@/components/terminos/terminos-client"

export const metadata: Metadata = {
  title: "Términos y Condiciones — Umbra",
  description:
    "Términos y Condiciones de uso de Umbra, incluidos los términos del marketplace para listar y adquirir agentes de IA.",
}

export default function TerminosPage() {
  return <TerminosClient />
}
