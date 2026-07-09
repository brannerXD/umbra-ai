"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useToast } from "./toast-provider"

// Marca en el navegador que el usuario ya aceptó los términos, para no
// volver a mostrarle el consentimiento en cada inicio de sesión.
const TERMS_KEY = "umbra_terms_accepted"

export interface AuthUser {
  id: string
  email: string | null
  name: string
  avatarUrl: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signInWithGoogle: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toAuthUser(supaUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null): AuthUser | null {
  if (!supaUser) return null
  const meta = supaUser.user_metadata ?? {}
  return {
    id: supaUser.id,
    email: supaUser.email ?? null,
    name: (meta.full_name as string) || (meta.name as string) || supaUser.email?.split("@")[0] || "Usuario",
    avatarUrl: (meta.avatar_url as string) || null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [consentOpen, setConsentOpen] = useState(false)
  const [consentChecked, setConsentChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(toAuthUser(data.session?.user ?? null))
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toAuthUser(session?.user ?? null))
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  // Ejecuta el flujo real de OAuth con Google.
  const runGoogleOAuth = useCallback(() => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app` },
    })
  }, [])

  // Antes de autenticar, exige la aceptación de los términos (una vez por
  // dispositivo). Si ya se aceptaron, continúa directo a Google.
  const signInWithGoogle = useCallback(() => {
    let accepted = false
    try {
      accepted = localStorage.getItem(TERMS_KEY) === "1"
    } catch {
      accepted = false
    }
    if (accepted) {
      runGoogleOAuth()
      return
    }
    setConsentChecked(false)
    setConsentOpen(true)
  }, [runGoogleOAuth])

  const acceptTermsAndContinue = useCallback(() => {
    try {
      localStorage.setItem(TERMS_KEY, "1")
    } catch {
      /* almacenamiento no disponible — continuamos igual */
    }
    setConsentOpen(false)
    runGoogleOAuth()
  }, [runGoogleOAuth])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    showToast("Sesión cerrada.", "info")
  }, [showToast])

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
      {consentOpen && (
        <div
          className="modal-overlay open"
          onClick={(e) => e.target === e.currentTarget && setConsentOpen(false)}
        >
          <div className="modal-box">
            <button className="modal-close" aria-label="Cerrar" onClick={() => setConsentOpen(false)}>
              ✕
            </button>
            <h3 className="modal-title">Antes de continuar</h3>
            <p className="modal-sub">
              Para crear tu cuenta e iniciar sesión en Umbra, necesitas aceptar nuestros términos.
            </p>
            <label className="consent-check">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              <span>
                He leído y acepto los{" "}
                <Link href="/terminos" target="_blank">
                  Términos y Condiciones
                </Link>{" "}
                y la{" "}
                <Link href="/privacidad" target="_blank">
                  Política de Privacidad
                </Link>
                .
              </span>
            </label>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setConsentOpen(false)}>
                Cancelar
              </button>
              <button className="btn-primary" disabled={!consentChecked} onClick={acceptTermsAndContinue}>
                <span>Continuar con Google</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider")
  return ctx
}
