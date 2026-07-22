"use client"

import { type FormEvent, useCallback, useState } from "react"
import Link from "next/link"
import type { AuthResult } from "./auth-provider"
import { Turnstile, isCaptchaEnabled } from "./turnstile"

export type AuthMode = "signin" | "signup"

type View = "card" | "confirm-sent" | "reset" | "reset-sent"

interface AuthModalProps {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  onClose: () => void
  onGoogle: () => void
  onSignUp: (email: string, password: string, captchaToken?: string) => Promise<AuthResult>
  onSignIn: (email: string, password: string, captchaToken?: string) => Promise<AuthResult>
  onReset: (email: string, captchaToken?: string) => Promise<AuthResult>
  hasAcceptedTerms: boolean
}

// Traduce los errores comunes de Supabase a español.
function translateError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos."
  if (m.includes("already registered") || m.includes("already been registered")) return "Ya existe una cuenta con ese correo."
  if (m.includes("email not confirmed")) return "Debes confirmar tu correo antes de entrar. Revisa tu bandeja."
  // El limite de ENVIO DE CORREO es distinto del de intentos: se agota a nivel
  // de proyecto (no por usuario) y deja al visitante sin salida. Se le ofrece
  // Google, que no manda correo y por tanto no lo toca.
  if (m.includes("email rate limit") || m.includes("over_email_send_rate_limit")) {
    return "Ahora mismo no podemos enviar el correo de confirmación. Entra con Google (es inmediato) o inténtalo en un rato."
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Demasiados intentos. Espera un momento e inténtalo de nuevo, o entra con Google."
  }
  if (m.includes("password")) return "La contraseña no cumple los requisitos (mínimo 6 caracteres)."
  if (m.includes("unable to validate email")) return "El formato del correo no es válido."
  return msg
}

export function AuthModal({
  mode,
  onModeChange,
  onClose,
  onGoogle,
  onSignUp,
  onSignIn,
  onReset,
  hasAcceptedTerms,
}: AuthModalProps) {
  const [signUpActive, setSignUpActive] = useState(mode === "signup")
  const [view, setView] = useState<View>("card")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Token del CAPTCHA. `captchaKey` fuerza el remonte del widget para pedir uno
  // nuevo tras un intento fallido (los tokens de Turnstile son de un solo uso).
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const captchaOn = isCaptchaEnabled()

  const onCaptcha = useCallback((t: string) => setCaptchaToken(t), [])
  const onCaptchaExpire = useCallback(() => setCaptchaToken(null), [])
  // Tras un fallo, el token ya se consumió: se limpia y se remonta el widget.
  function resetCaptcha() {
    setCaptchaToken(null)
    setCaptchaKey((k) => k + 1)
  }

  function toPanel(signup: boolean) {
    setError(null)
    resetCaptcha()
    setSignUpActive(signup)
    onModeChange(signup ? "signup" : "signin")
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError("Escribe tu correo y contraseña.")
      return
    }
    if (captchaOn && !captchaToken) {
      setError("Completa la verificación de seguridad.")
      return
    }
    setBusy(true)
    const res = await onSignIn(email.trim(), password, captchaToken ?? undefined)
    setBusy(false)
    if (!res.ok) {
      setError(translateError(res.error))
      resetCaptcha()
    }
    // Con sesión: el cambio de estado de auth cierra el modal solo.
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError("Escribe tu correo y contraseña.")
      return
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }
    if (!terms) {
      setError("Debes aceptar los Términos y la Política de Privacidad.")
      return
    }
    if (captchaOn && !captchaToken) {
      setError("Completa la verificación de seguridad.")
      return
    }
    setBusy(true)
    const res = await onSignUp(email.trim(), password, captchaToken ?? undefined)
    setBusy(false)
    if (!res.ok) {
      setError(translateError(res.error))
      resetCaptcha()
      return
    }
    if (res.needsConfirmation) setView("confirm-sent")
  }

  function handleGoogle() {
    setError(null)
    if (signUpActive && !terms) {
      setError("Acepta los Términos para continuar.")
      return
    }
    onGoogle()
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError("Escribe tu correo.")
      return
    }
    if (captchaOn && !captchaToken) {
      setError("Completa la verificación de seguridad.")
      return
    }
    setBusy(true)
    const res = await onReset(email.trim(), captchaToken ?? undefined)
    setBusy(false)
    if (!res.ok) {
      setError(translateError(res.error))
      resetCaptcha()
      return
    }
    setView("reset-sent")
  }

  const single = view !== "card"

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`auth-card ${signUpActive ? "right-active" : ""} ${single ? "auth-card-single" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close auth-close" aria-label="Cerrar" onClick={onClose}>
          ✕
        </button>

        {view === "confirm-sent" || view === "reset-sent" ? (
          <div className="auth-single auth-msg">
            <div className="auth-msg-icon">✉</div>
            <h3 className="modal-title">{view === "confirm-sent" ? "Confirma tu correo" : "Revisa tu correo"}</h3>
            <p className="modal-sub">
              {view === "confirm-sent" ? (
                <>Te enviamos un enlace a <strong>{email}</strong>. Ábrelo para activar tu cuenta.</>
              ) : (
                <>Si existe una cuenta con <strong>{email}</strong>, te enviamos un enlace para restablecer tu contraseña.</>
              )}
            </p>
            <button className="btn-primary" onClick={onClose}><span>Entendido</span></button>
          </div>
        ) : view === "reset" ? (
          <form className="auth-single auth-inner" onSubmit={handleReset}>
            <span className="auth-word">UMBRA</span>
            <h3 className="auth-h">Recuperar contraseña</h3>
            <p className="auth-p">Te enviaremos un enlace para crear una nueva.</p>
            <label className="auth-field">
              <span>Correo</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" autoComplete="email" />
            </label>
            {error && <p className="auth-error">{error}</p>}
            <Turnstile key={`reset-${captchaKey}`} onToken={onCaptcha} onExpire={onCaptchaExpire} />
            <button type="submit" className="btn-primary" disabled={busy}><span>{busy ? "Enviando…" : "Enviar enlace"}</span></button>
            <button type="button" className="auth-link-btn" onClick={() => { setError(null); setView("card") }}>← Volver</button>
          </form>
        ) : (
          <>
            {/* Formulario: Crear cuenta */}
            <div className="auth-col auth-signup">
              <form className="auth-inner" onSubmit={handleSignUp}>
                <span className="auth-word">UMBRA</span>
                <h3 className="auth-h">Crear cuenta</h3>
                <label className="auth-field">
                  <span>Correo</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" autoComplete="email" />
                </label>
                <label className="auth-field">
                  <span>Contraseña</span>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
                </label>
                <label className="consent-check auth-terms">
                  <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                  <span>Acepto los <Link href="/terminos" target="_blank">Términos</Link> y la <Link href="/privacidad" target="_blank">Política</Link>.</span>
                </label>
                {signUpActive && error && <p className="auth-error">{error}</p>}
                {signUpActive && (
                  <Turnstile key={`signup-${captchaKey}`} onToken={onCaptcha} onExpire={onCaptchaExpire} />
                )}
                <button type="submit" className="btn-primary" disabled={busy}><span>{busy ? "Un momento…" : "Crear cuenta"}</span></button>
                <div className="auth-divider"><span>o</span></div>
                <button type="button" className="btn-ghost auth-google" onClick={handleGoogle} disabled={busy}>
                  <svg className="google-g" viewBox="0 0 48 48" width="18" height="18" aria-hidden>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>Continuar con Google</span>
                </button>
                <button type="button" className="auth-mobile-switch" onClick={() => toPanel(false)}>¿Ya tienes cuenta? Inicia sesión</button>
              </form>
            </div>

            {/* Formulario: Iniciar sesión */}
            <div className="auth-col auth-signin">
              <form className="auth-inner" onSubmit={handleSignIn}>
                <span className="auth-word">UMBRA</span>
                <h3 className="auth-h">Iniciar sesión</h3>
                <label className="auth-field">
                  <span>Correo</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" autoComplete="email" />
                </label>
                <label className="auth-field">
                  <span>Contraseña</span>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña" autoComplete="current-password" />
                </label>
                <button type="button" className="auth-forgot" onClick={() => { setError(null); setView("reset") }}>¿Olvidaste tu contraseña?</button>
                {!signUpActive && error && <p className="auth-error">{error}</p>}
                {!signUpActive && (
                  <Turnstile key={`signin-${captchaKey}`} onToken={onCaptcha} onExpire={onCaptchaExpire} />
                )}
                <button type="submit" className="btn-primary" disabled={busy}><span>{busy ? "Un momento…" : "Entrar"}</span></button>
                <div className="auth-divider"><span>o</span></div>
                <button type="button" className="btn-ghost auth-google" onClick={handleGoogle} disabled={busy}>
                  <svg className="google-g" viewBox="0 0 48 48" width="18" height="18" aria-hidden>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>Continuar con Google</span>
                </button>
                <button type="button" className="auth-mobile-switch" onClick={() => toPanel(true)}>¿No tienes cuenta? Créala</button>
              </form>
            </div>

            {/* Panel deslizante */}
            <div className="auth-overlay-panel">
              <div className="auth-overlay">
                <div className="auth-ov-side auth-ov-left">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo-white.png" alt="" aria-hidden className="auth-ov-float" />
                  <span className="auth-word auth-ov-word">UMBRA</span>
                  <h3 className="auth-ov-h">¿Ya tienes cuenta?</h3>
                  <p className="auth-ov-p">Inicia sesión y sigue construyendo tu reputación en la red.</p>
                  <button type="button" className="auth-ov-btn" onClick={() => toPanel(false)}>Iniciar sesión</button>
                </div>
                <div className="auth-ov-side auth-ov-right">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo-white.png" alt="" aria-hidden className="auth-ov-float" />
                  <span className="auth-word auth-ov-word">UMBRA</span>
                  <h3 className="auth-ov-h">¿No tienes cuenta?</h3>
                  <p className="auth-ov-p">Créala y entra a competir. Tu reputación empieza aquí.</p>
                  <button type="button" className="auth-ov-btn" onClick={() => toPanel(true)}>Crear cuenta</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
