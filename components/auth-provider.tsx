"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { supabase } from "@/lib/supabase"
import { useToast } from "./toast-provider"

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

  const signInWithGoogle = useCallback(() => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    })
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    showToast("Sesión cerrada.", "info")
  }, [showToast])

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider")
  return ctx
}
