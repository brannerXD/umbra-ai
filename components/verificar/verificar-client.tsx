"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { useI18n } from "@/components/language-provider"
import {
  type CertificateCheck,
  type CertificateRecord,
  attesterWallet,
  clusterLabel,
  explorerTxUrl,
  verifyCertificate,
} from "@/lib/solana"
import { formatFullDate } from "@/lib/umbra"

const STR = {
  es: {
    kicker: "Verificación pública",
    title: "Verificar un certificado",
    lead: "Pega el número de certificado, su hash SHA-256 o el enlace del código QR. La comprobación se hace en tu navegador, consultando directamente la blockchain de Solana.",
    placeholder: "N.º de certificado, hash o enlace",
    submit: "Verificar",
    notFound: "No encontramos ningún certificado con ese dato. Revisa que esté completo.",
    issuedTo: "Emitido a",
    issuedOn: "Emitido el",
    certNo: "Certificado N.º",
    score: "Score",
    wins: "Victorias",
    comps: "Competencias",
    avg: "Promedio",
    steps: "Comprobaciones",
    step1: "Huella SHA-256 recalculada desde los datos del certificado",
    step2: "Coincide con la huella registrada al emitirlo",
    step3: "Coincide con el sello escrito en Solana",
    step4: "Transacción firmada por la wallet oficial de Umbra",
    running: "Verificando en Solana…",
    ok: "Certificado auténtico. Sus datos son exactamente los que se sellaron en la blockchain de Solana: nadie —ni siquiera Umbra— los ha alterado.",
    mismatch: "No coincide. Los datos de este certificado no corresponden al sello publicado en Solana.",
    unreachable: "No se pudo consultar la red de Solana en este momento. Intenta de nuevo.",
    pending: "Este certificado aún no tiene su sello en Solana (se completa en minutos). Vuelve a intentarlo más tarde.",
    retry: "Verificar de nuevo",
    hash: "Hash SHA-256",
    tx: "Transacción",
    explorer: "Ver en el explorador de Solana ↗",
    agent: "Ver perfil del agente",
    network: "Red",
    how: "¿Cómo funciona?",
    howBody:
      "Al emitir un certificado, Umbra calcula una huella SHA-256 de sus datos y la escribe en una transacción de Solana. Aquí tu navegador recalcula esa huella y la compara con la que quedó en la cadena. Si coinciden, el certificado es auténtico e inalterado.",
  },
  en: {
    kicker: "Public verification",
    title: "Verify a certificate",
    lead: "Paste the certificate number, its SHA-256 hash or the QR code link. The check runs in your browser, querying the Solana blockchain directly.",
    placeholder: "Certificate No., hash or link",
    submit: "Verify",
    notFound: "We couldn't find a certificate with that value. Check that it's complete.",
    issuedTo: "Issued to",
    issuedOn: "Issued on",
    certNo: "Certificate No.",
    score: "Score",
    wins: "Wins",
    comps: "Competitions",
    avg: "Average",
    steps: "Checks",
    step1: "SHA-256 fingerprint recomputed from the certificate data",
    step2: "Matches the fingerprint recorded at issuance",
    step3: "Matches the seal written on Solana",
    step4: "Transaction signed by Umbra's official wallet",
    running: "Verifying on Solana…",
    ok: "Authentic certificate. Its data is exactly what was sealed on the Solana blockchain: nobody —not even Umbra— has altered it.",
    mismatch: "Mismatch. This certificate's data doesn't match the seal published on Solana.",
    unreachable: "Couldn't reach the Solana network right now. Try again.",
    pending: "This certificate isn't sealed on Solana yet (it takes a few minutes). Try again later.",
    retry: "Verify again",
    hash: "SHA-256 hash",
    tx: "Transaction",
    explorer: "View on Solana explorer ↗",
    agent: "View agent profile",
    network: "Network",
    how: "How does it work?",
    howBody:
      "When a certificate is issued, Umbra computes a SHA-256 fingerprint of its data and writes it to a Solana transaction. Here your browser recomputes that fingerprint and compares it with the one on-chain. If they match, the certificate is authentic and unaltered.",
  },
}

type Status = "idle" | "running" | CertificateCheck["result"]

function shortAddr(a: string) {
  return `${a.slice(0, 4)}…${a.slice(-4)}`
}

export function VerificarClient({
  query,
  certificate,
}: {
  query: string
  certificate: CertificateRecord | null
}) {
  const { lang } = useI18n()
  const s = STR[lang === "en" ? "en" : "es"]
  const router = useRouter()
  const [input, setInput] = useState(query)
  const [status, setStatus] = useState<Status>("idle")
  const [check, setCheck] = useState<CertificateCheck | null>(null)

  const run = async (c: CertificateRecord) => {
    setStatus("running")
    setCheck(null)
    const r = await verifyCertificate(c)
    setCheck(r)
    setStatus(r.result)
  }

  // Verificación automática al abrir el enlace (p. ej. desde el QR).
  useEffect(() => {
    if (certificate) void run(certificate)
  }, [certificate])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const v = input.trim()
    if (v) router.push(`/verificar?c=${encodeURIComponent(v)}`)
  }

  const c = certificate
  const stepState = (ok: boolean | null) => (ok === null ? "is-wait" : ok ? "is-ok" : "is-bad")

  return (
    <main className="verify">
      <div className="container verify-inner">
        <p className="section-eyebrow">{s.kicker}</p>
        <h1 className="page-title">{s.title}</h1>
        <p className="page-sub verify-lead">{s.lead}</p>

        <form className="verify-form" onSubmit={onSubmit}>
          <input
            className="verify-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={s.placeholder}
            aria-label={s.placeholder}
            spellCheck={false}
            autoComplete="off"
          />
          <button type="submit" className="btn-primary">
            <span>{s.submit}</span>
          </button>
        </form>

        {query && !c && <p className="verify-notfound">{s.notFound}</p>}

        {c && (
          <section className="onchain-box verify-card is-sealed" aria-live="polite">
            <div className="verify-head">
              <div>
                <p className="verify-meta">
                  {s.certNo} <code>{c.id}</code>
                </p>
                <p className="verify-name">
                  {s.issuedTo} <strong>{c.agentName}</strong>
                </p>
                <p className="verify-meta">
                  {s.issuedOn} {formatFullDate(new Date(c.issuedAt), lang)}
                </p>
              </div>
              {c.cluster && <span className="onchain-net">{clusterLabel(c.cluster)}</span>}
            </div>

            <dl className="onchain-snap">
              <div>
                <dt>{s.score}</dt>
                <dd>{c.score}</dd>
              </div>
              <div>
                <dt>{s.wins}</dt>
                <dd>{c.wins}</dd>
              </div>
              <div>
                <dt>{s.comps}</dt>
                <dd>{c.comps}</dd>
              </div>
              <div>
                <dt>{s.avg}</dt>
                <dd>{Number(c.avgScore).toFixed(1)}</dd>
              </div>
            </dl>

            <div>
              <h2 className="section-title-sm verify-steps-title">{s.steps}</h2>
              <ol className="verify-steps">
                <li className={check ? "is-ok" : "is-wait"}>{s.step1}</li>
                <li className={stepState(check ? check.hashMatches : null)}>{s.step2}</li>
                <li
                  className={stepState(
                    !check || status === "pending" || status === "unreachable" ? null : status === "ok",
                  )}
                >
                  {s.step3}
                </li>
                <li className={stepState(check?.signerOk ?? null)}>
                  {s.step4} <code className="verify-wallet">{shortAddr(attesterWallet(c.cluster ?? "devnet"))}</code>
                </li>
              </ol>
            </div>

            {status === "running" && <p className="onchain-result verify-running">{s.running}</p>}
            {status === "ok" && <p className="onchain-result is-ok">✓ {s.ok}</p>}
            {status === "mismatch" && <p className="onchain-result is-mismatch">✕ {s.mismatch}</p>}
            {status === "unreachable" && <p className="onchain-result is-unreachable">✕ {s.unreachable}</p>}
            {status === "pending" && <p className="onchain-note">{s.pending}</p>}

            <dl className="verify-proof">
              {c.certHash && (
                <div>
                  <dt>{s.hash}</dt>
                  <dd>
                    <code>{c.certHash}</code>
                  </dd>
                </div>
              )}
              {c.signature && (
                <div>
                  <dt>{s.tx}</dt>
                  <dd>
                    <code>{c.signature}</code>
                  </dd>
                </div>
              )}
            </dl>

            <div className="onchain-actions">
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => run(c)}
                disabled={status === "running"}
              >
                {s.retry}
              </button>
              {c.signature && (
                <a
                  className="onchain-link"
                  href={explorerTxUrl(c.signature, c.cluster ?? undefined)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.explorer}
                </a>
              )}
              <Link className="onchain-link" href={`/agente?id=${c.agentId}`}>
                {s.agent}
              </Link>
            </div>
          </section>
        )}

        <details className="onchain-what verify-how">
          <summary>{s.how}</summary>
          <p>{s.howBody}</p>
        </details>
      </div>
    </main>
  )
}
