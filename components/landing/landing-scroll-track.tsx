"use client"

import { useEffect, useRef, type ReactNode } from "react"

interface Checkpoint {
  dot: HTMLDivElement
  ratio: number
}

interface Geometry {
  trackTop: number
  originY: number
  len: number
  amplitude: number
  centerX: number
  pathLen: number
  scrollAtDone: number
}

const WAVELENGTH = 340
const MAX_POINTS = 500
const MAX_CHECKPOINTS = 6

function bumpWindow(s: number, center: number, halfWidth: number) {
  const d = (s - center) / halfWidth
  if (Math.abs(d) >= 1) return 0
  return Math.cos((d * Math.PI) / 2) ** 2
}

function computePoint(s: number, len: number, amplitude: number, centerX: number) {
  const t = Math.min(1, s / len)
  const taper = Math.pow(1 - t, 1.3)

  let x = centerX + amplitude * taper * Math.sin((s / WAVELENGTH) * Math.PI * 2)
  let y = s

  const spiralCenter = len * 0.3
  const spiralHalf = len * 0.05
  const spiralW = bumpWindow(s, spiralCenter, spiralHalf)
  if (spiralW > 0.001) {
    const localT = (s - (spiralCenter - spiralHalf)) / (spiralHalf * 2)
    const angle = localT * Math.PI * 2 * 1.75
    const radius = 46 * spiralW
    x += Math.cos(angle) * radius
    y += Math.sin(angle) * radius * 0.55
  }

  const sweepCenter = len * 0.62
  const sweepHalf = len * 0.07
  const sweepW = bumpWindow(s, sweepCenter, sweepHalf)
  if (sweepW > 0.001) {
    const localT = (s - (sweepCenter - sweepHalf)) / (sweepHalf * 2)
    x += Math.sin(localT * Math.PI * 2 * 2.2) * amplitude * 0.9 * sweepW
  }

  return { x, y }
}

function buildPath(len: number, amplitude: number, centerX: number) {
  const step = Math.max(14, len / MAX_POINTS)
  let d = `M${centerX.toFixed(1)},0`
  for (let s = step; s < len; s += step) {
    const p = computePoint(s, len, amplitude, centerX)
    d += ` L${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }
  d += ` L${centerX.toFixed(1)},${len.toFixed(1)}`
  return d
}

function findSForY(targetY: number, len: number, amplitude: number, centerX: number) {
  let s = Math.min(len, Math.max(0, targetY))
  for (let i = 0; i < 6; i++) {
    const y = computePoint(s, len, amplitude, centerX).y
    s = Math.min(len, Math.max(0, s + (targetY - y)))
  }
  return s
}

export function LandingScrollTrack({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const fillRef = useRef<SVGPathElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const checkpointDotRefs = useRef<(HTMLDivElement | null)[]>([])
  const rafRef = useRef(0)
  const geomRef = useRef<Geometry>({
    trackTop: 0,
    originY: 0,
    len: 1,
    amplitude: 0,
    centerX: 0,
    pathLen: 1,
    scrollAtDone: 1,
  })
  const checkpointsRef = useRef<Checkpoint[]>([])
  const lastWidthRef = useRef(0)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const measure = () => {
      const rect = wrap.getBoundingClientRect()
      const trackTop = rect.top + window.scrollY

      const originEl = wrap.querySelector<HTMLElement>("[data-spine-start]")
      const originRect = originEl?.getBoundingClientRect()
      const originY = originRect ? originRect.bottom + window.scrollY - trackTop : 0

      const btn = document.getElementById("landing-cta-btn")
      const btnRect = btn?.getBoundingClientRect()
      const btnCenterAbs = btnRect
        ? btnRect.top + window.scrollY + btnRect.height / 2
        : trackTop + wrap.offsetHeight
      let len = btnCenterAbs - (trackTop + originY)
      if (!Number.isFinite(len) || len <= 0) len = wrap.offsetHeight || 1000
      len = Math.max(1, Math.min(len, 20000))

      const clientWidth = wrap.clientWidth || 1200
      lastWidthRef.current = clientWidth
      const centerX = clientWidth / 2
      const amplitude = Math.min(220, clientWidth * 0.18)

      if (svgRef.current) {
        svgRef.current.style.top = `${originY}px`
        svgRef.current.setAttribute("width", String(clientWidth))
        svgRef.current.setAttribute("height", String(len))
      }

      const d = buildPath(len, amplitude, centerX)
      fillRef.current?.setAttribute("d", d)
      const pathLen = fillRef.current?.getTotalLength() ?? len
      fillRef.current?.setAttribute("stroke-dasharray", String(pathLen))

      // El progreso arranca en 0 justo al cargar (sin scroll, la línea no ha salido
      // de UMBRA) y llega a 1 cuando el botón queda centrado en la pantalla.
      const scrollAtDone = Math.max(1, trackTop + originY + len - window.innerHeight / 2)

      geomRef.current = { trackTop, originY, len, amplitude, centerX, pathLen, scrollAtDone }

      // Anclas invisibles y en flujo normal (una por sección) — solo se usan para
      // medir en qué Y real empieza cada sección. El punto visual vive aparte, ya
      // posicionado en el sistema de coordenadas del track (ver pool de dots abajo).
      const anchors = Array.from(wrap.querySelectorAll<HTMLElement>("[data-checkpoint]")).slice(
        0,
        MAX_CHECKPOINTS,
      )
      checkpointsRef.current = anchors
        .map((anchor, i) => {
          const dot = checkpointDotRefs.current[i]
          if (!dot) return null
          const r = anchor.getBoundingClientRect()
          const targetLocalY = r.top + window.scrollY - (trackTop + originY)
          const s = findSForY(targetLocalY, len, amplitude, centerX)
          dot.style.display = ""
          return { dot, ratio: len > 0 ? s / len : 0 }
        })
        .filter((c): c is Checkpoint => c !== null)

      for (let i = anchors.length; i < MAX_CHECKPOINTS; i++) {
        const dot = checkpointDotRefs.current[i]
        if (dot) dot.style.display = "none"
      }
    }

    const update = () => {
      const { originY, len, amplitude, centerX, pathLen, scrollAtDone } = geomRef.current
      const progress = Math.min(1, Math.max(0, window.scrollY / scrollAtDone))
      const drawLen = pathLen * progress

      fillRef.current?.setAttribute("stroke-dashoffset", String(pathLen - drawLen))

      if (fillRef.current && dotRef.current) {
        const pt = fillRef.current.getPointAtLength(drawLen)
        dotRef.current.style.top = `${originY + pt.y}px`
        dotRef.current.style.left = `${pt.x}px`
      }

      const done = progress >= 0.985
      wrap.classList.toggle("spine-done", done)
      document.getElementById("landing-cta-btn")?.classList.toggle("lit", done)

      checkpointsRef.current.forEach(({ dot, ratio }) => {
        dot.classList.toggle("checkpoint-lit", progress >= ratio - 0.015)
        const s = ratio * len
        const pt = computePoint(s, len, amplitude, centerX)
        dot.style.top = `${originY + pt.y}px`
        dot.style.left = `${pt.x}px`
      })
    }

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(update)
    }

    // Solo remedimos en resize real de ancho (evita bucles de ResizeObserver por
    // cambios de layout que el propio spine podría inducir).
    const onWindowResize = () => {
      if (Math.abs(window.innerWidth - lastWidthRef.current) < 2) return
      measure()
      update()
    }

    measure()
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onWindowResize)

    // Re-medir una vez más tras el asentamiento de fuentes/imágenes.
    const settleTimer = setTimeout(() => {
      measure()
      update()
    }, 500)

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onWindowResize)
      clearTimeout(settleTimer)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div className="landing-track" ref={wrapRef}>
      <svg className="landing-spine" ref={svgRef} aria-hidden>
        <path ref={fillRef} className="landing-spine-fill" strokeWidth="2" fill="none" />
      </svg>
      <div className="landing-spine-dot" ref={dotRef} aria-hidden />
      {Array.from({ length: MAX_CHECKPOINTS }).map((_, i) => (
        <div
          key={i}
          className="landing-checkpoint"
          ref={(el) => {
            checkpointDotRefs.current[i] = el
          }}
          aria-hidden
        />
      ))}
      {children}
    </div>
  )
}
