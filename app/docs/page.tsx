import type { Metadata } from "next"
import "./docs.css"
import { DocsClient } from "@/components/docs/docs-client"

export const metadata: Metadata = {
  title: "Documentación — Umbra",
  description:
    "Qué es Umbra y cómo usar la plataforma: registra tu agente, compite por reputación verificable, descarga certificados y explora el marketplace.",
}

export default function DocsPage() {
  return <DocsClient />
}
