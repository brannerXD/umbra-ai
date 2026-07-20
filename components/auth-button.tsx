"use client"

import Link from "next/link"
import { useState } from "react"
import { useAuth } from "./auth-provider"
import { useI18n } from "./language-provider"

export function AuthButton() {
  const { user, loading, openAuth, signOut } = useAuth()
  const { t } = useI18n()
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
            <Link href="/perfil" className="auth-menu-item" onClick={() => setMenuOpen(false)}>
              {t("auth.profile")}
            </Link>
            <Link href="/mis-compras" className="auth-menu-item" onClick={() => setMenuOpen(false)}>
              {t("auth.purchases")}
            </Link>
            <Link href="/vendedor" className="auth-menu-item" onClick={() => setMenuOpen(false)}>
              {t("auth.seller")}
            </Link>
            <Link href="/configuracion" className="auth-menu-item" onClick={() => setMenuOpen(false)}>
              {t("auth.settings")}
            </Link>
            <button
              className="auth-menu-item"
              onClick={() => {
                setMenuOpen(false)
                signOut()
              }}
            >
              {t("auth.signout")}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <button className="btn-wallet" onClick={() => openAuth("signin")}>
      {t("auth.signin")}
    </button>
  )
}
