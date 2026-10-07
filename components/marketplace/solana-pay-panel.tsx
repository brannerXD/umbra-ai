"use client"

import { useEffect, useRef, useState } from "react"
import { useI18n } from "@/components/language-provider"
import { consultarPagoSolana, type PagoSolana } from "@/lib/services"
import { clusterLabel } from "@/lib/solana"

const T = {
  es: {
    title: "Paga con USDC en Solana",
    scan: "Escanea el QR con tu wallet (Phantom, Solflare, Backpack…) o ábrela desde el móvil.",
    open: "Abrir en mi wallet",
    amount: "Monto",
    to: "Destino",
    network: "Red",
    copy: "Copiar",
    copied: "Copiado",
    waiting: "Esperando tu pago… se confirma solo, unos 15 segundos después de enviarlo.",
    busy: "La red está ocupada; sigo intentando…",
    timeout: "No vimos el pago todavía. Si ya lo enviaste, espera un momento y recarga: se confirmará.",
    failed: "No pudimos comprobar el pago.",
    test: "Red de pruebas: aquí NO se usa dinero real.",
    cancel: "Cerrar",
    note: "Pagas directo a la tesorería de Umbra: no custodiamos tus fondos. Si el monto es menor al exacto, el pago no se acepta.",
  },
  en: {
    title: "Pay with USDC on Solana",
    scan: "Scan the QR with your wallet (Phantom, Solflare, Backpack…) or open it from your phone.",
    open: "Open in my wallet",
    amount: "Amount",
    to: "Recipient",
    network: "Network",
    copy: "Copy",
    copied: "Copied",
    waiting: "Waiting for your payment… it confirms by itself, about 15 seconds after you send it.",
    busy: "The network is busy; still trying…",
    timeout: "We haven't seen the payment yet. If you already sent it, wait a moment and reload: it will confirm.",
    failed: "We couldn't verify the payment.",
    test: "Test network: NO real money is used here.",
    cancel: "Close",
    note: "You pay Umbra's treasury directly: we never hold your funds. If the amount is less than exact, the payment isn't accepted.",
  },
} as const

const POLL_MS = 4000
const MAX_MS = 20 * 60 * 1000

interface Props {
  pago: PagoSolana
  onPaid: () => void
  onClose: () => void
}

export function SolanaPayPanel({ pago, onPaid, onClose }: Props) {
  const { lang } = useI18n()
  const s = T[lang]
  const [qr, setQr] = useState<string | null>(null)
  const [estado, setEstado] = useState<"esperando" | "ocupada" | "vencido" | "error">("esperando")
  const [copiado, setCopiado] = useState<string | null>(null)

  // El callback cambia en cada render del padre: se guarda en una ref para que
  // el sondeo no se reinicie por eso.
  const onPaidRef = useRef(onPaid)
  useEffect(() => {
    onPaidRef.current = onPaid
  })

  // Sólo se pinta como enlace una URL `solana:` (la construye nuestro servidor,
  // pero un href nunca debe quedar a merced de lo que llegue).
  const urlSegura = pago.url.startsWith("solana:") ? pago.url : null

  useEffect(() => {
    if (!urlSegura) return
    let activo = true
    import("qrcode")
      .then((m) => m.toDataURL(urlSegura, { margin: 1, width: 224, errorCorrectionLevel: "M" }))
      .then((d) => activo && setQr(d))
      .catch(() => {
        /* sin QR sigue funcionando el enlace y los datos para copiar */
      })
    return () => {
      activo = false
    }
  }, [urlSegura])

  // Sondeo: el servidor mira la cadena; aquí sólo se pregunta.
  useEffect(() => {
    let activo = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const inicio = Date.now()

    const preguntar = async () => {
      const r = await consultarPagoSolana(pago.compraId)
      if (!activo) return
      if (r.estado === "completada") {
        onPaidRef.current()
        return
      }
      if (r.estado === "error") {
        setEstado("error")
        return
      }
      if (Date.now() - inicio > MAX_MS) {
        setEstado("vencido")
        return
      }
      setEstado("esperando")
      timer = setTimeout(preguntar, POLL_MS)
    }
    timer = setTimeout(preguntar, POLL_MS)
    return () => {
      activo = false
      if (timer) clearTimeout(timer)
    }
  }, [pago.compraId])

  async function copiar(clave: string, valor: string) {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(clave)
      setTimeout(() => setCopiado((c) => (c === clave ? null : c)), 1500)
    } catch {
      /* el portapapeles puede estar bloqueado: el texto sigue visible */
    }
  }

  const corto = `${pago.destino.slice(0, 6)}…${pago.destino.slice(-6)}`

  return (
    <div className="solpay" aria-live="polite">
      <h4 className="solpay-title">{s.title}</h4>
      {pago.cluster === "devnet" && <div className="solpay-test">{s.test}</div>}
      <p className="solpay-hint">{s.scan}</p>

      <div className="solpay-body">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL generada en el navegador
          <img className="solpay-qr" src={qr} width={224} height={224} alt="QR Solana Pay" />
        ) : (
          <div className="solpay-qr solpay-qr-empty" aria-hidden="true" />
        )}

        <dl className="solpay-data">
          <div>
            <dt>{s.amount}</dt>
            <dd>
              <strong>
                {pago.monto} {pago.token}
              </strong>
            </dd>
          </div>
          <div>
            <dt>{s.to}</dt>
            <dd>
              <code title={pago.destino}>{corto}</code>
              <button type="button" className="solpay-copy" onClick={() => copiar("destino", pago.destino)}>
                {copiado === "destino" ? s.copied : s.copy}
              </button>
            </dd>
          </div>
          <div>
            <dt>{s.network}</dt>
            <dd>{clusterLabel(pago.cluster)}</dd>
          </div>
          {urlSegura && (
            <div>
              <a className="btn-primary solpay-open" href={urlSegura}>
                <span>{s.open}</span>
              </a>
            </div>
          )}
        </dl>
      </div>

      <p className={`solpay-status ${estado}`}>
        {estado === "esperando" && s.waiting}
        {estado === "ocupada" && s.busy}
        {estado === "vencido" && s.timeout}
        {estado === "error" && s.failed}
      </p>
      <p className="solpay-note">{s.note}</p>

      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>
          {s.cancel}
        </button>
      </div>
    </div>
  )
}
