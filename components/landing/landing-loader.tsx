"use client"

import { useEffect, useState } from "react"

/**
 * Pantalla de carga del hero mientras se descarga y renderiza la escena 3D
 * (NEXBOT tarda unos segundos). Muestra el wordmark UMBRA y una barra sutil, y
 * se desvanece cuando la escena avisa que está lista (`umbra:scene-ready`) o al
 * llegar a un tope de tiempo, para no bloquear nunca de más. Respeta
 * `prefers-reduced-motion` saliendo enseguida.
 */
export function LandingLoader() {
  const [done, setDone] = useState(false)

  useEffect(() => {
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      setDone(true)
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const q = window.setTimeout(finish, 300)
      return () => window.clearTimeout(q)
    }

    window.addEventListener("umbra:scene-ready", finish, { once: true })
    // Tope de seguridad: si la escena tarda demasiado (o no hay), se revela el
    // hero igual y el robot entra con su fundido cuando termine.
    const cap = window.setTimeout(finish, 7000)
    // Mínimo estético para que el logo respire aunque cargue al instante.
    const min = Date.now()
    void min

    return () => {
      window.clearTimeout(cap)
      window.removeEventListener("umbra:scene-ready", finish)
    }
  }, [])

  return (
    <div className={`landing-loader${done ? " is-done" : ""}`} role="status" aria-live="polite">
      <div className="landing-loader-logo" aria-hidden />
      <div className="landing-loader-mark" aria-label="UMBRA">
        {"UMBRA".split("").map((ch, i) => (
          <span key={i} aria-hidden style={{ animationDelay: `${i * 0.09}s` }}>
            {ch}
          </span>
        ))}
      </div>
      <div className="landing-loader-bar" aria-hidden>
        <span />
      </div>
    </div>
  )
}
