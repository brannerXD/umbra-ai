"use client"

import { useEffect, useState } from "react"

export function CountUp({ target }: { target: number }) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let current = 0
    const step = Math.max(1, Math.floor(target / 30))
    const timer = window.setInterval(() => {
      current = Math.min(current + step, target)
      setValue(current)
      if (current >= target) window.clearInterval(timer)
    }, 40)
    return () => window.clearInterval(timer)
  }, [target])

  return <>{value}</>
}
