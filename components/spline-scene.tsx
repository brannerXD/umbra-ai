"use client"

import { createElement, useEffect, useRef, useState, type CSSProperties } from "react"

// El visor oficial de Spline es un Web Component (`<spline-viewer>`). Lo cargamos
// desde CDN en tiempo de ejecución en vez de empaquetarlo: el runtime de Spline
// trae assets (decoder DRACO, etc.) con rutas relativas a su propio módulo, que
// los bundlers (Turbopack/webpack) no saben resolver. Servido desde el CDN, el
// navegador los resuelve solos. Es además el método de embed que Spline entrega
// al exportar una escena.
const VIEWER_SRC =
  process.env.NEXT_PUBLIC_SPLINE_VIEWER_SRC ??
  "https://cdn.jsdelivr.net/npm/@splinetool/viewer@2.0.36/build/spline-viewer.js"

let loaderPromise: Promise<void> | null = null

function loadViewer(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.customElements?.get("spline-viewer")) return Promise.resolve()
  if (loaderPromise) return loaderPromise
  loaderPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.type = "module"
    script.src = VIEWER_SRC
    script.onload = () => resolve()
    script.onerror = () => {
      loaderPromise = null
      reject(new Error("No se pudo cargar el visor de Spline"))
    }
    document.head.appendChild(script)
  })
  return loaderPromise
}

interface SplineSceneProps {
  /** URL del export `.splinecode` de la escena (p. ej. NEXBOT). */
  scene: string
  className?: string
  style?: CSSProperties
  /** Si la escena reacciona al cursor (NEXBOT sigue el ratón). Con `global`
   *  reacciona al ratón en toda la página aunque no reciba los clics (así, de
   *  fondo, no le roba la interacción al contenido). */
  eventsTarget?: "global" | "local"
  onReady?: () => void
}

/**
 * Envoltorio reutilizable para escenas de Spline vía Web Component.
 * - Carga diferida: el visor no se pide hasta que el contenedor es visible
 *   (IntersectionObserver), para no penalizar el primer paint.
 * - Respeta `prefers-reduced-motion`: no monta la escena.
 * - Aparición con fundido cuando el visor termina de montarse.
 * El que llama controla el layout (posición/tamaño) con className/style.
 */
export function SplineScene({
  scene,
  className,
  style,
  eventsTarget = "global",
  onReady,
}: SplineSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HTMLElement | null>(null)
  const [phase, setPhase] = useState<"idle" | "visible" | "ready" | "off">("idle")

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("off")
      return
    }
    const host = hostRef.current
    if (!host) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPhase("visible")
          io.disconnect()
        }
      },
      { rootMargin: "200px" },
    )
    io.observe(host)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (phase !== "visible" || !scene) return
    let cancelled = false
    loadViewer()
      .then(() => {
        if (cancelled) return
        setPhase("ready")
        onReady?.()
      })
      .catch(() => {
        if (!cancelled) setPhase("off")
      })
    return () => {
      cancelled = true
    }
  }, [phase, scene, onReady])

  // React 19 asigna las props string de un custom element como PROPIEDADES, y el
  // visor de Spline sólo carga la escena cuando ve el ATRIBUTO `url`. Por eso los
  // fijamos como atributos vía ref, ya montado el elemento. `events-target`
  // primero, para que al disparar la carga con `url` el objetivo ya esté puesto.
  useEffect(() => {
    const el = viewerRef.current
    if (phase !== "ready" || !el || !scene) return
    el.setAttribute("events-target", eventsTarget)
    el.setAttribute("url", scene)

    // Oculta la marca de agua del visor (atribución del plan free de Spline),
    // inyectando un estilo en su shadow DOM. El badge se añade al cargar, así
    // que se aplica también en `load`.
    const hideLogo = () => {
      try {
        const root = (el as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot
        if (root && !root.querySelector("style[data-umbra-hide-logo]")) {
          const s = document.createElement("style")
          s.setAttribute("data-umbra-hide-logo", "")
          s.textContent =
            '#logo,a[href*="spline.design"],[id*="watermark"],[class*="watermark"]{display:none!important;opacity:0!important;pointer-events:none!important}'
          root.appendChild(s)
        }
      } catch {
        /* shadow root no accesible */
      }
    }

    // El visor dispara `load` cuando la escena termina de cargar/renderizar:
    // avisamos globalmente para que la pantalla de carga se retire en ese momento.
    const onLoad = () => {
      window.dispatchEvent(new Event("umbra:scene-ready"))
      hideLogo()
    }
    el.addEventListener("load", onLoad, { once: true })
    hideLogo()
    return () => el.removeEventListener("load", onLoad)
  }, [phase, scene, eventsTarget])

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        opacity: phase === "ready" ? 1 : 0,
        transition: "opacity 0.9s var(--ease, ease)",
        pointerEvents: "none",
        ...style,
      }}
      aria-hidden
    >
      {phase === "ready" && scene
        ? createElement("spline-viewer", {
            ref: viewerRef,
            style: { width: "100%", height: "100%", display: "block" },
          })
        : null}
    </div>
  )
}
