import { renderToBuffer } from "@react-pdf/renderer"
import { NextResponse } from "next/server"
import QRCode from "qrcode"
import {
  CertificateMobilePdf,
  CertificatePdf,
  type CertSeal,
  verifyUrl,
} from "@/components/certificado/certificate-pdf"
import {
  MIN_COMPS_FOR_CERTIFICATE,
  anchorCertificate,
  getAgentById,
  issueCertificate,
} from "@/lib/services"
import type { Lang } from "@/lib/i18n"

// Emitir incluye esperar la confirmación de Solana (~1–3 s).
export const maxDuration = 30

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

  // Cada certificado se sella en Solana con su propio hash. Si la red falla,
  // el PDF sale igual (con el sello "en proceso") y el cron lo sella después:
  // el QR lleva a /verificar, que siempre muestra el estado real.
  const anchored =
    issuance.onchainSignature && issuance.certHash
      ? { hash: issuance.certHash, signature: issuance.onchainSignature, cluster: issuance.onchainCluster }
      : await anchorCertificate(issuance.id)

  let qr: string | null = null
  try {
    qr = await QRCode.toDataURL(`https://${verifyUrl(issuance.id)}`, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
      color: { dark: "#0A0A0A", light: "#F5F5F0" },
    })
  } catch {
    /* sin QR: el enlace impreso sigue sirviendo */
  }

  const seal: CertSeal = {
    hash: anchored?.hash ?? null,
    signature: anchored?.signature ?? null,
    cluster: anchored?.cluster ?? null,
    qr,
  }

  const document = isMobile ? (
    <CertificateMobilePdf agent={agent} issuance={issuance} lang={lang} seal={seal} />
  ) : (
    <CertificatePdf agent={agent} issuance={issuance} lang={lang} seal={seal} />
  )
  const buffer = await renderToBuffer(document)

  const slug = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const suffix = isMobile ? (lang === "en" ? "-mobile" : "-movil") : ""
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${lang === "en" ? "certificate" : "certificado"}-${slug}${suffix}.pdf"`,
      // Cada descarga es una emisión distinta: nunca cachear.
      "Cache-Control": "no-store",
    },
  })
}
