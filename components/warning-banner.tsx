"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { acknowledgeWarning, getMyWarnings, type UserWarning } from "@/lib/services"

// Muestra las advertencias que un admin le dejó al usuario en sesión. Se muestran
// de una en una (la más reciente primero); al pulsar "Entendido" se marca como
// vista y aparece la siguiente si la hay.
export function WarningBanner() {
  const { user } = useAuth()
  const [warnings, setWarnings] = useState<UserWarning[]>([])

  useEffect(() => {
    if (!user) {
      setWarnings([])
      return
    }
    getMyWarnings().then(setWarnings)
  }, [user])

  if (warnings.length === 0) return null
  const w = warnings[0]

  async function dismiss() {
    await acknowledgeWarning(w.id)
    setWarnings((prev) => prev.filter((x) => x.id !== w.id))
  }

  return (
    <div className="warning-banner" role="alert">
      <span className="warning-banner-icon" aria-hidden>
        ⚠
      </span>
      <div className="warning-banner-body">
        <strong>Advertencia de un moderador de Umbra</strong>
        <p>{w.message}</p>
      </div>
      <button type="button" className="warning-banner-btn" onClick={dismiss}>
        Entendido
      </button>
    </div>
  )
}
