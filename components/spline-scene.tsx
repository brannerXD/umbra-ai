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

// En móvil/tablet NO se carga ningún 3D: el runtime de Spline + la escena pesan
// varios MB y el render WebGL/WebGPU continuo agota batería y CPU del teléfono.
// Pantalla angosta O puntero táctil sin hover (tablets) cuentan como móvil.
export const MOBILE_QUERY = "(max-width: 768px), (hover: none) and (pointer: coarse)"

/** ¿El entorno actual debe saltarse el 3D? (móvil o reduced-motion). */
export function shouldSkip3D(): boolean {
  if (typeof window === "undefined") return true
  return (
    window.matchMedia(MOBILE_QUERY).matches ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

/**
 * Hook: `true` cuando el 3D puede montarse (escritorio sin reduced-motion),
 * `false` en móvil/reduced-motion, y `null` antes de montar (SSR y primer
 * render: aún no se sabe, así nunca se pide el visor en un teléfono). Se
 * re-evalúa si la ventana cambia de tamaño.
 */
export function useCan3D(): boolean | null {
  const [can, setCan] = useState<boolean | null>(null)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const update = () => setCan(!shouldSkip3D())
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return can
}

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

// Acceso a la `Application` interna del visor (`el._spline`). No es API pública,
// por eso todo su uso va protegido: si cambia en otra versión, sólo se pierde la
// optimización, nunca la escena.
interface SplineApp {
  play?: () => void
  stop?: () => void
  _renderer?: { setPixelRatio?: (r: number) => void }
}

function splineApp(el: HTMLElement): SplineApp | null {
  return (el as unknown as { _spline?: SplineApp })._spline ?? null
}

// En pantallas HiDPI (2x/3x) el visor renderiza a resolución nativa: 4–9 veces
// más píxeles por frame. Con 1.5x la escena se ve igual de nítida (es un fondo
// con desenfoque/reflejos) y la GPU trabaja bastante menos.
const MAX_PIXEL_RATIO = 1.5

function capPixelRatio(el: HTMLElement) {
  try {
    const dpr = window.devicePixelRatio || 1
    if (dpr <= MAX_PIXEL_RATIO) return
    splineApp(el)?._renderer?.setPixelRatio?.(MAX_PIXEL_RATIO)
  } catch {
    /* sin acceso al renderer: se queda con el valor del visor */
  }
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
    if (shouldSkip3D()) {
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
      capPixelRatio(el)
    }
    el.addEventListener("load", onLoad, { once: true })
    hideLogo()

    // Rendimiento en PC: el visor renderiza a 60fps aunque la escena esté fuera
    // de pantalla (p. ej. al bajar por la landing). Pausamos su bucle de render
    // mientras no se ve y lo reanudamos al volver.
    const host = hostRef.current
    const io = host
      ? new IntersectionObserver(
          (entries) => {
            const app = splineApp(el)
            if (!app) return
            try {
              if (entries.some((e) => e.isIntersecting)) app.play?.()
              else app.stop?.()
            } catch {
              /* API interna no disponible: se deja renderizando */
            }
          },
          { rootMargin: "100px" },
        )
      : null
    if (host && io) io.observe(host)

    return () => {
      el.removeEventListener("load", onLoad)
      io?.disconnect()
    }
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
