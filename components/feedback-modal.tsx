"use client"

import { useEffect, useState } from "react"
import { Star, X } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/language-provider"
import { useToast } from "@/components/toast-provider"
import { submitFeedback } from "@/lib/services"

const MAX = 2000

// Textos del modal en ambos idiomas.
const T = {
  es: {
    open: "Danos tu opinión",
    title: "¿Qué opinas de Umbra?",
    sub: "Lo lee el equipo, no se publica. Cuéntanos qué te sirvió y qué no.",
    ratingLabel: "¿Cómo te ha ido? (opcional)",
    placeholder: "Lo que te gustó, lo que te estorbó, lo que esperabas encontrar...",
    consent: "Autorizo que Umbra pueda mostrar mi opinión públicamente.",
    consentHint: "Si no lo marcas, tu opinión queda privada. Puedes opinar igual.",
    cancel: "Cancelar",
    send: "Enviar",
    sending: "Enviando...",
    ok: "Gracias. Lo leemos todo.",
    errEmpty: "Escribe un poco más antes de enviar.",
    errGeneric: "No se pudo enviar tu opinión.",
    guest: "Inicia sesión para dejar tu opinión.",
    signIn: "Iniciar sesión",
    close: "Cerrar",
    stars: "estrellas",
  },
  en: {
    open: "Give us your feedback",
    title: "What do you think of Umbra?",
    sub: "The team reads it, it is not published. Tell us what helped and what did not.",
    ratingLabel: "How has it gone? (optional)",
    placeholder: "What you liked, what got in your way, what you expected to find...",
    consent: "I allow Umbra to show my feedback publicly.",
    consentHint: "If you leave it unchecked, your feedback stays private. You can still send it.",
    cancel: "Cancel",
    send: "Send",
    sending: "Sending...",
    ok: "Thank you. We read every one.",
    errEmpty: "Write a bit more before sending.",
    errGeneric: "Your feedback could not be sent.",
    guest: "Sign in to leave your feedback.",
    signIn: "Sign in",
    close: "Close",
    stars: "stars",
  },
} as const

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, openAuth } = useAuth()
  const { lang } = useI18n()
  const { showToast } = useToast()
  const s = T[lang]

  const [message, setMessage] = useState("")
  const [rating, setRating] = useState<number | null>(null)
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  async function send() {
    if (!user) return
    if (message.trim().length < 3) {
      showToast(s.errEmpty, "warn")
      return
    }
    setSending(true)
    const res = await submitFeedback({
      userId: user.id,
      message,
      rating,
      authorConsent: consent,
    })
    setSending(false)
    if (!res.ok) {
      showToast(res.message || s.errGeneric, "warn")
      return
    }
    showToast(s.ok, "success")
    setMessage("")
    setRating(null)
    setConsent(false)
    onClose()
  }

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button className="modal-close" aria-label={s.close} onClick={onClose}>
          <X aria-hidden />
        </button>
        <h3 className="modal-title">{s.title}</h3>

        {!user ? (
          <>
            <p className="modal-sub">{s.guest}</p>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => { onClose(); openAuth("signin") }}>
                <span>{s.signIn}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="modal-sub">{s.sub}</p>

            <div className="field-group">
              <label className="field-label">{s.ratingLabel}</label>
              <div className="feedback-stars" role="group" aria-label={s.ratingLabel}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`feedback-star${rating !== null && n <= rating ? " on" : ""}`}
                    aria-label={`${n} ${s.stars}`}
                    aria-pressed={rating === n}
                    onClick={() => setRating(rating === n ? null : n)}
                  >
                    <Star aria-hidden />
                  </button>
                ))}
              </div>
            </div>

            <textarea
              className="modal-textarea"
              rows={5}
              maxLength={MAX}
              value={message}
              placeholder={s.placeholder}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="modal-char-count">{`${message.length}/${MAX}`}</div>

            <label className="consent-check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                {s.consent}
                <br />
                <span className="field-hint">{s.consentHint}</span>
              </span>
            </label>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={onClose}>{s.cancel}</button>
              <button className="btn-primary" disabled={sending} onClick={send}>
                <span>{sending ? s.sending : s.send}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Texto del enlace que abre el modal, para reutilizarlo desde el footer. */
export function useFeedbackLabel() {
  const { lang } = useI18n()
  return T[lang].open
}
