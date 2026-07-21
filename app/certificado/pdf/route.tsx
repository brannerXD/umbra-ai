import { renderToBuffer } from "@react-pdf/renderer"
import { NextResponse } from "next/server"
import { CertificateMobilePdf, CertificatePdf } from "@/components/certificado/certificate-pdf"
import {
  MIN_COMPS_FOR_CERTIFICATE,
  getAgentById,
  getCertificateIssuances,
  issueCertificate,
} from "@/lib/services"
import type { Lang } from "@/lib/i18n"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const isMobile = searchParams.get("format") === "mobile"
  // El idioma lo elige el usuario en el cliente y viaja por query param.
  const lang: Lang = searchParams.get("lang") === "en" ? "en" : "es"
  const agent = id ? await getAgentById(id) : null

  if (!agent || agent.comps < MIN_COMPS_FOR_CERTIFICATE) {
    return NextResponse.json({ error: "Certificado no disponible para este agente." }, { status: 404 })
  }

  const issuance = await issueCertificate(agent, "pdf")
  if (!issuance) {
    return NextResponse.json({ error: "No se pudo emitir el certificado." }, { status: 500 })
  }

  const issuances = await getCertificateIssuances(agent.id)
  const document = isMobile ? (
    <CertificateMobilePdf agent={agent} issuance={issuance} totalIssued={issuances.length} lang={lang} />
  ) : (
    <CertificatePdf agent={agent} issuance={issuance} totalIssued={issuances.length} lang={lang} />
  )
  const buffer = await renderToBuffer(document)

  const slug = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const suffix = isMobile ? (lang === "en" ? "-mobile" : "-movil") : ""
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${lang === "en" ? "certificate" : "certificado"}-${slug}${suffix}.pdf"`,
    },
  })
}
