"use client"

import { useEffect, useState } from "react"

export function ScoreCount({ target }: { target: number }) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let current = 0
    const step = Math.max(1, Math.ceil(target / 24))
    const timer = setInterval(() => {
      current = Math.min(current + step, target)
      setValue(current)
      if (current >= target) clearInterval(timer)
    }, 22)
    return () => clearInterval(timer)
  }, [target])

  return <>{value}</>
}
