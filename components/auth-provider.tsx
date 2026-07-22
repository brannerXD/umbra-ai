"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { supabase } from "@/lib/supabase"
import { useToast } from "./toast-provider"
import { AvatarPicker } from "./avatar-picker"
import { AuthModal, type AuthMode } from "./auth-modal"

// Marca en el navegador que el usuario ya aceptó los términos, para no
// volver a pedírselos en cada inicio de sesión con Google.
const TERMS_KEY = "umbra_terms_accepted"

export interface AuthUser {
  id: string
  email: string | null
  name: string
  avatarUrl: string | null
}

// Resultado de las acciones de correo/contraseña.
export type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; error: string }

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  isAdmin: boolean
  // Abre el modal de autenticación (correo/contraseña + Google).
  openAuth: (mode?: AuthMode) => void
  signInWithGoogle: () => void
  signUpWithEmail: (email: string, password: string, captchaToken?: string) => Promise<AuthResult>
  signInWithEmail: (email: string, password: string, captchaToken?: string) => Promise<AuthResult>
  resetPassword: (email: string, captchaToken?: string) => Promise<AuthResult>
  hasAcceptedTerms: () => boolean
  markTermsAccepted: () => void
  signOut: () => void
  // Actualiza el avatar mostrado en el navbar al instante (tras elegirlo en el perfil).
  setAvatarUrl: (url: string) => void
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
  const [baseUser, setBaseUser] = useState<AuthUser | null>(null)
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null)
  const [avatarChosen, setAvatarChosen] = useState<boolean | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  // El perfil (donde vive is_admin) se consulta en un segundo efecto, despues
  // de la sesion. Guardar "ya cargue el perfil" como booleano no basta: al
  // montar, userId es null, el efecto entra por la rama sin-sesion y lo marca
  // como resuelto; cuando despues llega la sesion queda un instante con
  // loading=false, perfil "resuelto" e isAdmin aun en false, y la guardia de
  // /admin expulsa al propio admin. Por eso se guarda DE QUE usuario es el
  // perfil cargado: si no coincide con el actual, todavia no esta resuelto.
  // undefined = nunca se ha cargado; null = cargado para "sin sesion".
  const [profileFor, setProfileFor] = useState<string | null | undefined>(undefined)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>("signin")

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setBaseUser(toAuthUser(data.session?.user ?? null))
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setBaseUser(toAuthUser(session?.user ?? null))
      if (session?.user) setAuthOpen(false)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  // El avatar del navbar sale de la tabla profiles (el que el usuario eligió),
  // con respaldo en la foto de Google si aún no eligió ninguno.
  const userId = baseUser?.id ?? null
  useEffect(() => {
    if (!userId) {
      setProfileAvatar(null)
      setAvatarChosen(null)
      setIsAdmin(false)
      // Sin sesion no hay perfil que esperar.
      setProfileFor(null)
      return
    }
    let active = true
    supabase
      .from("profiles")
      .select("avatar_url, avatar_chosen, is_admin")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setProfileAvatar((data?.avatar_url as string | null) ?? null)
        setAvatarChosen((data?.avatar_chosen as boolean | null) ?? null)
        setIsAdmin((data?.is_admin as boolean | null) ?? false)
        setProfileFor(userId)
      })
    return () => {
      active = false
    }
  }, [userId])

  // Usuario expuesto: el avatar de profiles tiene prioridad sobre el de Google.
  const user: AuthUser | null = baseUser
    ? { ...baseUser, avatarUrl: profileAvatar ?? baseUser.avatarUrl }
    : null

  const hasAcceptedTerms = useCallback(() => {
    try {
      return localStorage.getItem(TERMS_KEY) === "1"
    } catch {
      return false
    }
  }, [])

  const markTermsAccepted = useCallback(() => {
    try {
      localStorage.setItem(TERMS_KEY, "1")
    } catch {
      /* almacenamiento no disponible — continuamos igual */
    }
  }, [])

  const openAuth = useCallback((mode: AuthMode = "signin") => {
    setAuthMode(mode)
    setAuthOpen(true)
  }, [])

  // Ejecuta el flujo real de OAuth con Google. La aceptación de términos se
  // maneja en el modal antes de llegar aquí.
  const signInWithGoogle = useCallback(() => {
    markTermsAccepted()
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app` },
    })
  }, [markTermsAccepted])

  const signUpWithEmail = useCallback(
    async (email: string, password: string, captchaToken?: string): Promise<AuthResult> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/app`, captchaToken },
      })
      if (error) return { ok: false, error: error.message }
      markTermsAccepted()
      // Sin sesión ⇒ Supabase exige confirmar el correo; con sesión ⇒ entró directo.
      return { ok: true, needsConfirmation: !data.session }
    },
    [markTermsAccepted],
  )

  const signInWithEmail = useCallback(
    async (email: string, password: string, captchaToken?: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
      })
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    },
    [],
  )

  const resetPassword = useCallback(async (email: string, captchaToken?: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
      captchaToken,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    showToast("Sesión cerrada.", "info")
  }, [showToast])

  const setAvatarUrl = useCallback((url: string) => {
    setProfileAvatar(url)
  }, [])

  // Marca que el usuario ya pasó por la selección de avatar (se muestra al crear la cuenta).
  const markAvatarChosen = useCallback(async () => {
    if (!userId) return
    setAvatarChosen(true)
    await supabase.from("profiles").update({ avatar_chosen: true }).eq("id", userId)
  }, [userId])

  return (
    <AuthContext.Provider
      value={{
        user,
        // Sigue "cargando" mientras el perfil cargado no sea el del usuario
        // actual: comparar contra userId invalida el dato al instante, sin
        // depender de que corra ningun efecto.
        loading: loading || profileFor !== userId,
        isAdmin: isAdmin && !!user,
        openAuth,
        signInWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        resetPassword,
        hasAcceptedTerms,
        markTermsAccepted,
        signOut,
        setAvatarUrl,
      }}
    >
      {children}
      {authOpen && (
        <AuthModal
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={() => setAuthOpen(false)}
          onGoogle={signInWithGoogle}
          onSignUp={signUpWithEmail}
          onSignIn={signInWithEmail}
          onReset={resetPassword}
          hasAcceptedTerms={hasAcceptedTerms()}
        />
      )}
      {user && avatarChosen === false && (
        <AvatarPicker
          userId={user.id}
          currentUrl={profileAvatar}
          title="Dale una cara a tu perfil"
          subtitle="Elige un avatar para tu cuenta. Podrás cambiarlo cuando quieras."
          skipLabel="Omitir por ahora"
          onChosen={(url) => {
            if (url) setProfileAvatar(url)
          }}
          onClose={markAvatarChosen}
        />
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider")
  return ctx
}
