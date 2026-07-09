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
