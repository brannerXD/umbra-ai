"use client"

import { useEffect, useRef } from "react"
import { getInitials } from "@/lib/umbra"
import type { Agent } from "@/lib/types"

interface OrbitAgent {
  name: string
  score: number
  rank: number
}

interface HeroOrbitProps {
  agents: Agent[]
}

// Distribución de los anillos: radios, duración y sentido de giro.
const RINGS = [
  { radius: 220, duration: 34, tilt: -14, reverse: false, count: 5 },
  { radius: 132, duration: 26, tilt: 16, reverse: true, count: 3 },
]

export function HeroOrbit({ agents }: HeroOrbitProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const target = useRef({ x: 0, y: 0 })
  const current = useRef({ x: 0, y: 0 })

  // Parallax suave: la escena entera se inclina siguiendo el cursor.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth
      const h = window.innerHeight
      target.current.x = (e.clientY / h - 0.5) * -10
      target.current.y = (e.clientX / w - 0.5) * 14
    }

    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * 0.06
      current.current.y += (target.current.y - current.current.y) * 0.06
      stage.style.transform = `rotateX(${current.current.x.toFixed(2)}deg) rotateY(${current.current.y.toFixed(2)}deg)`
      rafRef.current = requestAnimationFrame(tick)
    }

    window.addEventListener("mousemove", onMove)
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener("mousemove", onMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Reparte los agentes top entre los anillos.
  const pool: OrbitAgent[] = agents.slice(0, 8).map((a, i) => ({
    name: a.name,
    score: a.score,
    rank: i + 1,
  }))

  let cursor = 0

  return (
    <div className="hero-orbit" aria-hidden>
      <div className="orbit-stage" ref={stageRef}>
        {/* Núcleo central */}
        <div className="orbit-core">
          <div className="orbit-core-ring" />
          <div className="orbit-core-glyph" />
          <div className="orbit-core-pulse" />
        </div>

        {RINGS.map((ring, ri) => {
          const members = pool.slice(cursor, cursor + ring.count)
          cursor += ring.count
          return (
            <div
              className="orbit-ring"
              key={ri}
              style={{ transform: `rotateX(${ring.tilt}deg)` }}
            >
              <div className="orbit-ring-track" style={{ width: ring.radius * 2, height: ring.radius * 2 }} />
              <div
                className="orbit-carousel"
                style={{
                  animationDuration: `${ring.duration}s`,
                  animationDirection: ring.reverse ? "reverse" : "normal",
                }}
              >
                {members.map((m, mi) => {
                  const phase = mi / ring.count
                  return (
                    <div
                      className="orbit-item"
                      key={m.name}
                      style={
                        {
                          "--r": `${ring.radius}px`,
                          "--dur": `${ring.duration}s`,
                          animationDelay: `${-ring.duration * phase}s`,
                          animationDirection: ring.reverse ? "reverse" : "normal",
                        } as React.CSSProperties
                      }
                    >
                      <div
                        className="orbit-billboard"
                        style={{
                          animationDuration: `${ring.duration}s`,
                          animationDelay: `${-ring.duration * phase}s`,
                          animationDirection: ring.reverse ? "reverse" : "normal",
                        }}
                      >
                        <div className={`orbit-agent${m.rank === 1 ? " is-top" : ""}`}>
                          <span className="orbit-agent-rank">{m.rank}</span>
                          <span className="orbit-agent-face">{getInitials(m.name)}</span>
                          <span className="orbit-agent-score">{m.score}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
