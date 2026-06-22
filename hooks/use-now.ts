"use client"

import { useEffect, useState } from "react"

/**
 * Devuelve un timestamp que se actualiza en cada intervalo.
 * Útil para countdowns y timers en vivo. Evita mismatch de hidratación
 * porque el primer valor coincide con el render del servidor (null) y solo
 * empieza a tick-ear tras el montaje.
 */
export function useNow(intervalMs: number | null = 1000): number | null {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    if (intervalMs === null) return

    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])

  return now
}
