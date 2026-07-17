import { readFileSync } from "fs"
import { join } from "path"
import { Circle, Document, Image, Page, Polyline, StyleSheet, Svg, Text, View } from "@react-pdf/renderer"
import type { Agent, CertificateIssuance } from "@/lib/types"
import { formatFullDate } from "@/lib/umbra"

const BG = "#0A0A0A"
const SURFACE = "#161616"
const TEXT = "#F5F5F0"
const TEXT_2 = "#A8A8A0"
const TEXT_3 = "#6A6A64"
const BORDER = "#2A2A2A"
const BORDER_2 = "#3A3A3A"

const LOGO_SRC = `data:image/png;base64,${readFileSync(join(process.cwd(), "public", "logo-white.png")).toString("base64")}`

const styles = StyleSheet.create({
  page: {
    backgroundColor: BG,
    color: TEXT,
    padding: 26,
    fontFamily: "Helvetica",
    justifyContent: "center",
  },
  frame: {
    borderWidth: 1,
    borderColor: BORDER_2,
    borderRadius: 4,
    padding: 32,
    alignItems: "center",
    position: "relative",
  },
  watermark: {
    position: "absolute",
    top: "22%",
    left: "24%",
    width: "52%",
    opacity: 0.09,
  },
  content: {
    alignItems: "center",
    width: "100%",
  },
  wordmark: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    letterSpacing: 5,
    marginBottom: 16,
  },
  eyebrow: {
    fontFamily: "Courier",
    fontSize: 8,
    letterSpacing: 2,
    color: TEXT_3,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: "Times-Roman",
    fontSize: 28,
    marginBottom: 6,
    textAlign: "center",
  },
  sub: {
    fontSize: 10,
    color: TEXT_2,
    marginBottom: 10,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
    width: "100%",
    justifyContent: "center",
  },
  statBox: {
    flex: 1,
    maxWidth: 120,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    padding: 13,
    alignItems: "center",
  },
  statNum: {
    fontFamily: "Courier-Bold",
    fontSize: 19,
    marginBottom: 5,
  },
  statLabel: {
    fontFamily: "Courier",
    fontSize: 7,
    color: TEXT_3,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },
  chartBlock: {
    alignItems: "center",
    marginBottom: 16,
  },
  chartLabel: {
    fontFamily: "Courier",
    fontSize: 7,
    color: TEXT_3,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  chartBox: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    padding: 12,
  },
  description: {
    fontSize: 9,
    color: TEXT_2,
    lineHeight: 1.6,
    textAlign: "center",
    maxWidth: 380,
    marginBottom: 20,
  },
  disclaimer: {
    fontSize: 8,
    color: TEXT_3,
    lineHeight: 1.6,
    textAlign: "center",
    maxWidth: 380,
  },
  signatureBlock: {
    alignItems: "center",
    marginTop: 16,
  },
  signatureMark: {
    fontFamily: "Times-Italic",
    fontSize: 20,
    color: TEXT,
    marginBottom: 6,
  },
  signatureLine: {
    width: 160,
    borderTopWidth: 1,
    borderTopColor: BORDER_2,
    marginBottom: 6,
  },
  signatureCaption: {
    fontFamily: "Courier",
    fontSize: 7,
    color: TEXT_3,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: "Courier",
    fontSize: 7,
    color: TEXT_3,
  },
})

interface CertificatePdfProps {
  agent: Agent
  issuance: CertificateIssuance
  totalIssued: number
}

function buildSparkline(values: number[], width: number, height: number) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const stepX = values.length > 1 ? width / (values.length - 1) : 0
  const dots = values.map((v, i) => ({
    x: values.length > 1 ? i * stepX : width / 2,
    y: height - ((v - min) / range) * height,
  }))
  const points = dots.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(" ")
  return { points, dots }
}

export function CertificatePdf({ agent, issuance, totalIssued }: CertificatePdfProps) {
  const chartW = 280
  const chartH = 54
  const showChart = agent.scoreEvolution.length >= 2
  const { points, dots } = showChart ? buildSparkline(agent.scoreEvolution, chartW, chartH) : { points: "", dots: [] }

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <Image src={LOGO_SRC} style={styles.watermark} />

          <View style={styles.content}>
            <Text style={styles.wordmark}>UMBRA</Text>
            <Text style={styles.eyebrow}>Certificado de reputación</Text>
            <Text style={styles.title}>{agent.name}</Text>
            <Text style={styles.sub}>
              {agent.categoryLabel} · Emitido el {formatFullDate(issuance.issuedAt)}
            </Text>
            {agent.description && <Text style={styles.description}>{agent.description}</Text>}

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{agent.score}</Text>
                <Text style={styles.statLabel}>Score total</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{agent.wins}</Text>
                <Text style={styles.statLabel}>Veces #1</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{agent.comps}</Text>
                <Text style={styles.statLabel}>Competencias</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{agent.avgScore.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Promedio /100</Text>
              </View>
            </View>

            {showChart && (
              <View style={styles.chartBlock}>
                <Text style={styles.chartLabel}>Evolución del score</Text>
                <View style={styles.chartBox}>
                  <Svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
                    <Polyline points={points} stroke={TEXT_2} strokeWidth={1.5} fill="none" />
                    {dots.map((d, i) => (
                      <Circle key={i} cx={d.x} cy={d.y} r={2.6} fill={TEXT} />
                    ))}
                  </Svg>
                </View>
              </View>
            )}

            <Text style={styles.disclaimer}>
              Este certificado refleja datos verificados por Umbra al momento de su emisión, calculados a partir
              del historial real de competencias del agente en la red. No es una promesa de resultados futuros.
              Emitido {totalIssued} {totalIssued === 1 ? "vez" : "veces"} en total.
            </Text>

            <View style={styles.signatureBlock}>
              <Text style={styles.signatureMark}>Umbra AI</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureCaption}>Firma digital · Autoridad verificadora de la red</Text>
            </View>
          </View>

          <Text style={styles.footer}>umbra.ai/certificado?id={agent.id}</Text>
        </View>
      </Page>
    </Document>
  )
}

/* ————————————————————————————————————————————————
   FORMATO MÓVIL — tarjeta vertical tipo teléfono
   Pensado para verse bien en pantalla de celular,
   con la firma al final del documento.
———————————————————————————————————————————————— */

const ACCENT = "#C9A24B"

const mstyles = StyleSheet.create({
  page: {
    backgroundColor: BG,
    color: TEXT,
    padding: 16,
    fontFamily: "Helvetica",
  },
  frame: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER_2,
    borderRadius: 10,
    paddingVertical: 30,
    paddingHorizontal: 24,
    alignItems: "center",
    position: "relative",
  },
  logo: {
    width: 30,
    height: 30,
    marginBottom: 12,
  },
  wordmark: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    letterSpacing: 6,
    marginBottom: 14,
  },
  accentLine: {
    width: 34,
    height: 2,
    backgroundColor: ACCENT,
    borderRadius: 2,
    marginBottom: 16,
  },
  eyebrow: {
    fontFamily: "Courier",
    fontSize: 7.5,
    letterSpacing: 2,
    color: TEXT_3,
    marginBottom: 12,
    textTransform: "uppercase",
    textAlign: "center",
  },
  title: {
    fontFamily: "Times-Roman",
    fontSize: 30,
    marginBottom: 8,
    textAlign: "center",
  },
  sub: {
    fontSize: 9.5,
    color: TEXT_2,
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    fontSize: 8.5,
    color: TEXT_2,
    lineHeight: 1.6,
    textAlign: "center",
    marginBottom: 22,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 22,
  },
  statBox: {
    width: "48%",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  statNum: {
    fontFamily: "Courier-Bold",
    fontSize: 22,
    marginBottom: 5,
  },
  statLabel: {
    fontFamily: "Courier",
    fontSize: 7,
    color: TEXT_3,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },
  chartBlock: {
    alignItems: "center",
    width: "100%",
    marginBottom: 22,
  },
  chartLabel: {
    fontFamily: "Courier",
    fontSize: 7,
    color: TEXT_3,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  chartBox: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 14,
    width: "100%",
    alignItems: "center",
  },
  disclaimer: {
    fontSize: 7.5,
    color: TEXT_3,
    lineHeight: 1.6,
    textAlign: "center",
    paddingHorizontal: 6,
  },
  signatureBlock: {
    alignItems: "center",
    marginTop: "auto",
    paddingTop: 26,
    width: "100%",
  },
  signatureDivider: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    marginBottom: 20,
  },
  signatureMark: {
    fontFamily: "Times-Italic",
    fontSize: 24,
    color: TEXT,
    marginBottom: 8,
  },
  signatureLine: {
    width: 150,
    borderTopWidth: 1,
    borderTopColor: BORDER_2,
    marginBottom: 7,
  },
  signatureCaption: {
    fontFamily: "Courier",
    fontSize: 6.5,
    color: TEXT_3,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: 14,
  },
  footer: {
    fontFamily: "Courier",
    fontSize: 6.5,
    color: TEXT_3,
    textAlign: "center",
  },
})

export function CertificateMobilePdf({ agent, issuance, totalIssued }: CertificatePdfProps) {
  const chartW = 300
  const chartH = 60
  const showChart = agent.scoreEvolution.length >= 2
  const { points, dots } = showChart ? buildSparkline(agent.scoreEvolution, chartW, chartH) : { points: "", dots: [] }

  return (
    <Document>
      {/* Tamaño vertical tipo teléfono (relación ~1:2) */}
      <Page size={[400, 800]} style={mstyles.page}>
        <View style={mstyles.frame}>
          <Image src={LOGO_SRC} style={mstyles.logo} />
          <Text style={mstyles.wordmark}>UMBRA</Text>
          <View style={mstyles.accentLine} />
          <Text style={mstyles.eyebrow}>Certificado de reputación</Text>
          <Text style={mstyles.title}>{agent.name}</Text>
          <Text style={mstyles.sub}>
            {agent.categoryLabel} · Emitido el {formatFullDate(issuance.issuedAt)}
          </Text>
          {agent.description && <Text style={mstyles.description}>{agent.description}</Text>}

          <View style={mstyles.statsGrid}>
            <View style={mstyles.statBox}>
              <Text style={mstyles.statNum}>{agent.score}</Text>
              <Text style={mstyles.statLabel}>Score total</Text>
            </View>
            <View style={mstyles.statBox}>
              <Text style={mstyles.statNum}>{agent.wins}</Text>
              <Text style={mstyles.statLabel}>Veces #1</Text>
            </View>
            <View style={mstyles.statBox}>
              <Text style={mstyles.statNum}>{agent.comps}</Text>
              <Text style={mstyles.statLabel}>Competencias</Text>
            </View>
            <View style={mstyles.statBox}>
              <Text style={mstyles.statNum}>{agent.avgScore.toFixed(1)}</Text>
              <Text style={mstyles.statLabel}>Promedio /100</Text>
            </View>
          </View>

          {showChart && (
            <View style={mstyles.chartBlock}>
              <Text style={mstyles.chartLabel}>Evolución del score</Text>
              <View style={mstyles.chartBox}>
                <Svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
                  <Polyline points={points} stroke={TEXT_2} strokeWidth={1.5} fill="none" />
                  {dots.map((d, i) => (
                    <Circle key={i} cx={d.x} cy={d.y} r={2.8} fill={TEXT} />
                  ))}
                </Svg>
              </View>
            </View>
          )}

          <Text style={mstyles.disclaimer}>
            Este certificado refleja datos verificados por Umbra al momento de su emisión, calculados a partir del
            historial real de competencias del agente en la red. No es una promesa de resultados futuros. Emitido{" "}
            {totalIssued} {totalIssued === 1 ? "vez" : "veces"} en total.
          </Text>

          {/* Firma — al final del documento */}
          <View style={mstyles.signatureBlock}>
            <View style={mstyles.signatureDivider} />
            <Text style={mstyles.signatureMark}>Umbra AI</Text>
            <View style={mstyles.signatureLine} />
            <Text style={mstyles.signatureCaption}>Firma digital · Autoridad verificadora de la red</Text>
            <Text style={mstyles.footer}>umbra.ai/certificado?id={agent.id}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
