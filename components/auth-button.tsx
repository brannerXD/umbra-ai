"use client"

import { useState } from "react"
import { useAuth } from "./auth-provider"

export function AuthButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  if (loading) return <button className="btn-wallet" disabled>···</button>

  if (user) {
    return (
      <div className="auth-menu-wrap">
        <button className="btn-wallet connected" onClick={() => setMenuOpen((v) => !v)}>
          {user.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="auth-avatar" />
          )}
          {user.name}
        </button>
        {menuOpen && (
          <div className="auth-menu">
            <button
              className="auth-menu-item"
              onClick={() => {
                setMenuOpen(false)
                signOut()
              }}
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <button className="btn-wallet" onClick={signInWithGoogle}>
      Iniciar sesión con Google
    </button>
  )
}
