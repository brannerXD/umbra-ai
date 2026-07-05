import { renderToBuffer } from "@react-pdf/renderer"
import { NextResponse } from "next/server"
import { CertificatePdf } from "@/components/certificado/certificate-pdf"
import {
  MIN_COMPS_FOR_CERTIFICATE,
  getAgentById,
  getCertificateIssuances,
  issueCertificate,
} from "@/lib/services"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  const agent = id ? await getAgentById(id) : null

  if (!agent || agent.comps < MIN_COMPS_FOR_CERTIFICATE) {
    return NextResponse.json({ error: "Certificado no disponible para este agente." }, { status: 404 })
  }

  const issuance = await issueCertificate(agent, "pdf")
  if (!issuance) {
    return NextResponse.json({ error: "No se pudo emitir el certificado." }, { status: 500 })
  }

  const issuances = await getCertificateIssuances(agent.id)
  const buffer = await renderToBuffer(
    <CertificatePdf agent={agent} issuance={issuance} totalIssued={issuances.length} />,
  )

  const slug = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificado-${slug}.pdf"`,
    },
  })
}
