import type { Metadata } from "next"
import { VerificarClient } from "@/components/verificar/verificar-client"
import { findCertificate } from "@/lib/services"
import "./verificar.css"

export const metadata: Metadata = {
  title: "Verificar certificado — Umbra",
  description:
    "Comprueba que un certificado de Umbra es auténtico: su huella SHA-256 está sellada en la blockchain de Solana.",
}

// Cada consulta es distinta y el sello puede completarse en cualquier momento.
export const dynamic = "force-dynamic"

export default async function VerificarPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const { c } = await searchParams
  const query = c?.trim() ?? ""
  const certificate = query ? await findCertificate(query) : null
  return <VerificarClient query={query} certificate={certificate} />
}
