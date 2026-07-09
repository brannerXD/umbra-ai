"use client"

import { useEffect, useRef } from "react"

const SPACING = 32
const RADIUS = 130
const MAX_CLUSTERS = 9
const SPAWN_MIN = 260
const SPAWN_MAX = 620

interface ClusterPoint {
  ix: number
  iy: number
  delay: number
}

interface Cluster {
  points: ClusterPoint[]
  start: number
  duration: number
}

// Sesga hacia los extremos [0,1]: de dos valores al azar, se queda con el más
// alejado del centro. Así los grupos aparecen sobre todo en los bordes.
function edgeBiasedUnit() {
  const a = Math.random()
  const b = Math.random()
  return Math.abs(a - 0.5) > Math.abs(b - 0.5) ? a : b
}

function spawnCluster(now: number, cols: number, rows: number): Cluster {
  const cx = Math.floor(edgeBiasedUnit() * cols)
  const cy = Math.floor(Math.random() * rows) - 1
  const count = 18 + Math.floor(Math.random() * 26)
  const spread = 3.5 + Math.random() * 3.5
  const duration = 1500 + Math.random() * 1100

  const points: ClusterPoint[] = []
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const r = Math.random() * spread
    const ix = Math.round(cx + Math.cos(angle) * r)
    const iy = Math.round(cy + Math.sin(angle) * r)
    if (ix < 0 || ix >= cols) continue
    points.push({ ix, iy, delay: Math.random() * 260 })
  }

  return { points, start: now, duration }
}

export function LandingBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let raf = 0
    let width = window.innerWidth
    let height = window.innerHeight
    let mouseX = -9999
    let mouseY = -9999
    let clusters: Cluster[] = []
    let nextSpawnAt = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    const onLeave = () => {
      mouseX = -9999
      mouseY = -9999
    }

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height)
      const isLight = document.documentElement.getAttribute("data-theme") === "light"
      const base = isLight ? "10,10,10" : "245,245,240"
      const offsetY = window.scrollY % SPACING
      const cols = Math.ceil(width / SPACING) + 1
      const rows = Math.ceil(height / SPACING) + 2

      // Grupos grandes que se encienden y apagan solos, sesgados a los bordes.
      if (now >= nextSpawnAt && clusters.length < MAX_CLUSTERS) {
        clusters.push(spawnCluster(now, cols, rows))
        nextSpawnAt = now + SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN)
      }
      clusters = clusters.filter((c) => now - c.start < c.duration + 260)

      const twinkleMap = new Map<string, number>()
      for (const c of clusters) {
        for (const p of c.points) {
          const t = now - c.start - p.delay
          if (t < 0) continue
          const ratio = Math.min(1, t / c.duration)
          const intensity = Math.sin(ratio * Math.PI)
          const key = `${p.ix},${p.iy}`
          const prev = twinkleMap.get(key) ?? 0
          if (intensity > prev) twinkleMap.set(key, intensity)
        }
      }

      for (let iy = -1; iy < rows; iy++) {
        for (let ix = 0; ix < cols; ix++) {
          const x = ix * SPACING
          const y = iy * SPACING - offsetY
          const dx = x - mouseX
          const dy = y - mouseY
          const dist = Math.sqrt(dx * dx + dy * dy)

          const cursorF = dist < RADIUS ? 1 - dist / RADIUS : 0
          const twinkleF = twinkleMap.get(`${ix},${iy}`) ?? 0
          const f = Math.max(cursorF, twinkleF)

          // Blanco color Umbra siempre — más tenue que la línea neón (que usa el
          // mismo tono a alta opacidad con glow); acá solo variamos brillo/tamaño.
          const alpha = (isLight ? 0.14 : 0.2) + f * 0.45
          const radius = 1 + f * 2

          ctx.beginPath()
          ctx.fillStyle = `rgba(${base},${alpha})`
          ctx.arc(x, y, radius, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      raf = requestAnimationFrame(draw)
    }

    resize()
    raf = requestAnimationFrame(draw)
    window.addEventListener("resize", resize)
    window.addEventListener("mousemove", onMove, { passive: true })
    window.addEventListener("mouseleave", onLeave)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseleave", onLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className="landing-bg-canvas" aria-hidden />
}
