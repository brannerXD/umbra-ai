"use client"

import { useEffect, useState } from "react"
import { useI18n } from "@/components/language-provider"
import { useToast } from "@/components/toast-provider"
import { getLatestAttestation, requestAttestation } from "@/lib/services"
import { explorerTxUrl, type OnchainAttestation, verifyOnchain } from "@/lib/solana"
import type { Agent } from "@/lib/types"

const STR = {
  es: {
    title: "Sello on-chain",
    network: "Solana devnet",
    loading: "Buscando sello en la cadena…",
    none: "Este agente aún no tiene su reputación sellada en Solana.",
    noneHow: "Umbra sella automáticamente cada hora el Trust Score de los agentes que compiten.",
    sealedAt: "Sellado el",
    snapshot: "Datos sellados",
    score: "Score",
    wins: "Victorias",
    comps: "Competencias",
    avg: "Promedio",
    stale: "Hubo cambios desde el último sello: se re-sellará en la próxima pasada.",
    verify: "Verificar en la cadena",
    verifying: "Verificando…",
    ok: "Verificado: el hash escrito en Solana corresponde exactamente a estos datos.",
    mismatch: "No coincide: el hash on-chain no corresponde a estos datos.",
    unreachable: "No se pudo consultar la red de Solana. Intenta de nuevo.",
    explorer: "Ver transacción ↗",
    seal: "Sellar ahora",
    sealing: "Sellando en Solana…",
    sealedToast: "Reputación sellada en Solana.",
    unchangedToast: "Sin cambios desde el último sello.",
    waitToast: "Espera unos minutos antes de volver a sellar.",
    what: "¿Qué es esto?",
    whatBody:
      "Guardamos en la blockchain de Solana una huella (SHA-256) de la reputación del agente. Cualquiera puede recalcularla desde estos datos y compararla con la de la cadena: si coinciden, nadie —ni siquiera Umbra— la alteró.",
  },
  en: {
    title: "On-chain seal",
    network: "Solana devnet",
    loading: "Looking for a seal on-chain…",
    none: "This agent's reputation isn't sealed on Solana yet.",
    noneHow: "Umbra automatically seals the Trust Score of competing agents every hour.",
    sealedAt: "Sealed on",
    snapshot: "Sealed data",
    score: "Score",
    wins: "Wins",
    comps: "Competitions",
    avg: "Average",
    stale: "Stats changed since the last seal: it will be re-sealed on the next run.",
    verify: "Verify on-chain",
    verifying: "Verifying…",
    ok: "Verified: the hash written on Solana matches this data exactly.",
    mismatch: "Mismatch: the on-chain hash doesn't match this data.",
    unreachable: "Couldn't reach the Solana network. Try again.",
    explorer: "View transaction ↗",
    seal: "Seal now",
    sealing: "Sealing on Solana…",
    sealedToast: "Reputation sealed on Solana.",
    unchangedToast: "No changes since the last seal.",
    waitToast: "Wait a few minutes before sealing again.",
    what: "What is this?",
    whatBody:
      "We store a fingerprint (SHA-256) of the agent's reputation on the Solana blockchain. Anyone can recompute it from this data and compare it with the on-chain one: if they match, nobody —not even Umbra— altered it.",
  },
}

type VerifyState = "idle" | "loading" | "ok" | "mismatch" | "unreachable"

/**
 * Sello on-chain del Trust Score: muestra el último sello publicado en Solana,
 * permite VERIFICARLO desde el navegador (recalcula el hash y lo compara con el
 * memo leído directamente del RPC de Solana, sin pasar por Umbra) y, al dueño,
 * pedir un sello inmediato.
 */
export function OnchainSeal({ agent, isOwner }: { agent: Agent; isOwner: boolean }) {
  const { lang } = useI18n()
  const s = STR[lang === "en" ? "en" : "es"]
  const { showToast } = useToast()

  const [att, setAtt] = useState<OnchainAttestation | null | undefined>(undefined)
  const [verify, setVerify] = useState<VerifyState>("idle")
  const [sealing, setSealing] = useState(false)

  useEffect(() => {
    let alive = true
    getLatestAttestation(agent.id).then((a) => {
      if (alive) setAtt(a)
    })
    return () => {
      alive = false
    }
  }, [agent.id])

  const onVerify = async () => {
    if (!att) return
    setVerify("loading")
    setVerify(await verifyOnchain(att))
  }

  const onSeal = async () => {
    setSealing(true)
    const r = await requestAttestation(agent.id)
    setSealing(false)
    if (!r.ok) {
      showToast(r.message ?? s.unreachable, "error")
      return
    }
    if (r.status === "sellado") {
      showToast(s.sealedToast, "success")
      setVerify("idle")
      setAtt(await getLatestAttestation(agent.id))
    } else if (r.status === "espera") {
      showToast(s.waitToast, "info")
    } else {
      showToast(s.unchangedToast, "info")
    }
  }

  const snap = att?.snapshot
  const stale =
    !!snap &&
    (snap.score !== agent.score ||
      snap.wins !== agent.wins ||
      snap.comps !== agent.comps ||
      snap.avgScore !== Math.round(agent.avgScore * 100) / 100)

  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleString(lang === "en" ? "en-US" : "es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    })

  return (
    <section className="breakdown-section onchain-section">
      <div className="container">
        <h2 className="section-title-sm">{s.title}</h2>
        <div className={`onchain-box${att ? " is-sealed" : ""}`}>
          <div className="onchain-head">
            <span className="onchain-mark" aria-hidden>
              <SolanaGlyph />
            </span>
            <div className="onchain-head-text">
              {att === undefined ? (
                <p className="onchain-line">{s.loading}</p>
              ) : att ? (
                <>
                  <p className="onchain-line">
                    <strong>{s.sealedAt}</strong> {dateFmt(att.issuedAt)}
                  </p>
                  <p className="onchain-meta">
                    {s.network} · <code>{att.payloadHash.slice(0, 10)}…{att.payloadHash.slice(-6)}</code>
                  </p>
                </>
              ) : (
                <>
                  <p className="onchain-line">{s.none}</p>
                  <p className="onchain-meta">{s.noneHow}</p>
                </>
              )}
            </div>
            <span className="onchain-net">{s.network}</span>
          </div>

          {snap && (
            <dl className="onchain-snap">
              <div>
                <dt>{s.score}</dt>
                <dd>{snap.score}</dd>
              </div>
              <div>
                <dt>{s.wins}</dt>
                <dd>{snap.wins}</dd>
              </div>
              <div>
                <dt>{s.comps}</dt>
                <dd>{snap.comps}</dd>
              </div>
              <div>
                <dt>{s.avg}</dt>
                <dd>{snap.avgScore}</dd>
              </div>
            </dl>
          )}

          {stale && <p className="onchain-note">{s.stale}</p>}

          {verify === "ok" || verify === "mismatch" || verify === "unreachable" ? (
            <p className={`onchain-result is-${verify}`} role="status">
              {verify === "ok" ? "✓ " : "✕ "}
              {s[verify]}
            </p>
          ) : null}

          <div className="onchain-actions">
            {att && (
              <>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={onVerify}
                  disabled={verify === "loading"}
                >
                  {verify === "loading" ? s.verifying : s.verify}
                </button>
                <a
                  className="onchain-link"
                  href={explorerTxUrl(att.signature, att.cluster)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.explorer}
                </a>
              </>
            )}
            {isOwner && (att === null || stale) && (
              <button type="button" className="btn-ghost btn-sm" onClick={onSeal} disabled={sealing}>
                {sealing ? s.sealing : s.seal}
              </button>
            )}
          </div>

          <details className="onchain-what">
            <summary>{s.what}</summary>
            <p>{s.whatBody}</p>
          </details>
        </div>
      </div>
    </section>
  )
}

/** Isotipo simplificado de Solana (tres barras inclinadas), en el color del texto. */
function SolanaGlyph() {
  return (
    <svg viewBox="0 0 24 20" width="20" height="17" fill="currentColor">
      <path d="M4.2 14.6a.8.8 0 0 1 .56-.23h18.4c.36 0 .54.43.29.69l-3.65 3.67a.8.8 0 0 1-.57.23H.83a.4.4 0 0 1-.29-.68z" />
      <path d="M4.2.73A.82.82 0 0 1 4.77.5h18.39c.36 0 .54.43.29.69L19.8 4.86a.8.8 0 0 1-.57.23H.83a.4.4 0 0 1-.29-.69z" />
      <path d="M19.8 7.62a.8.8 0 0 0-.57-.23H.83a.4.4 0 0 0-.29.69l3.66 3.67c.15.15.35.23.56.23h18.4a.4.4 0 0 0 .29-.69z" />
    </svg>
  )
}
