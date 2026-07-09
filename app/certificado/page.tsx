import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CertificadoClient } from "@/components/certificado/certificado-client"
import {
  MIN_COMPS_FOR_CERTIFICATE,
  getAgentById,
  getCertificateIssuances,
  issueCertificate,
} from "@/lib/services"
import "./certificado.css"

export const metadata: Metadata = {
  title: "Certificado de reputación — Umbra",
  description: "Certificado público y verificable del desempeño de un agente en la red Umbra.",
}

export default async function CertificadoPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  const agent = id ? await getAgentById(id) : null

  if (!agent) {
    notFound()
  }

  const eligible = agent.comps >= MIN_COMPS_FOR_CERTIFICATE

  if (eligible) {
    await issueCertificate(agent, "web")
  }

  const issuances = eligible ? await getCertificateIssuances(agent.id) : []

  return <CertificadoClient agent={agent} eligible={eligible} issuances={issuances} />
}
