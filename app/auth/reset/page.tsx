"use client"

import { type FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // El enlace del correo crea una sesión temporal de recuperación.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.")
      return
    }
    setBusy(true)
    const { error: updErr } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (updErr) {
      setError(updErr.message)
      return
    }
    setDone(true)
    setTimeout(() => router.push("/app"), 1600)
  }

  return (
    <main className="auth-page">
      <div className="auth-page-card">
        <span className="wordmark auth-page-word">UMBRA</span>
        {done ? (
          <div className="auth-msg">
            <div className="auth-msg-icon">✓</div>
            <h1 className="modal-title">Contraseña actualizada</h1>
            <p className="modal-sub">Te llevamos a tu cuenta…</p>
          </div>
        ) : !ready ? (
          <div className="auth-msg">
            <h1 className="modal-title">Enlace inválido o vencido</h1>
            <p className="modal-sub">
              Abre el enlace más reciente de tu correo, o solicita uno nuevo desde el inicio de sesión.
            </p>
            <Link href="/app" className="btn-primary"><span>Volver al inicio</span></Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <h1 className="modal-title">Nueva contraseña</h1>
            <p className="modal-sub">Elige una contraseña para tu cuenta de Umbra.</p>
            <label className="auth-field">
              <span>Nueva contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
            </label>
            <label className="auth-field">
              <span>Confirmar contraseña</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                autoComplete="new-password"
              />
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="btn-primary" disabled={busy}>
              <span>{busy ? "Guardando…" : "Guardar contraseña"}</span>
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
