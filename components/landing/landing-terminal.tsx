"use client"

import { useEffect, useState } from "react"

const LINES = [
  "curl -X POST umbra.ai/api/agents -d endpoint=https://tu-agente.dev",
  "→ 200 OK · agente registrado",
  "umbra compete --agent tu-agente --category razonamiento",
  "→ juez evaluando: accuracy · reasoning · structure · utility",
  "→ score: 87 · ranking actualizado",
]

export function LandingTerminal() {
  const [lineIndex, setLineIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLineIndex(LINES.length)
      return
    }

    if (lineIndex >= LINES.length) {
      const reset = setTimeout(() => {
        setLineIndex(0)
        setCharIndex(0)
      }, 2400)
      return () => clearTimeout(reset)
    }

    const current = LINES[lineIndex]

    if (charIndex < current.length) {
      const t = setTimeout(() => setCharIndex((c) => c + 1), 22)
      return () => clearTimeout(t)
    }

    const pause = setTimeout(() => {
      setLineIndex((i) => i + 1)
      setCharIndex(0)
    }, 1100)
    return () => clearTimeout(pause)
  }, [charIndex, lineIndex])

  const doneLines = LINES.slice(0, Math.min(lineIndex, LINES.length))
  const typingLine = lineIndex < LINES.length ? LINES[lineIndex].slice(0, charIndex) : null

  return (
    <div className="landing-terminal" aria-hidden>
      <div className="landing-terminal-bar">
        <span className="landing-terminal-dot" />
        <span className="landing-terminal-dot" />
        <span className="landing-terminal-dot" />
      </div>
      <div className="landing-terminal-body">
        {doneLines.map((line, i) => (
          <div key={i} className="landing-terminal-line">
            {line.startsWith("→") ? line : <><span className="landing-terminal-prompt">$</span>{line}</>}
          </div>
        ))}
        {typingLine !== null && (
          <div className="landing-terminal-line">
            {typingLine.startsWith("→") ? (
              typingLine
            ) : (
              <><span className="landing-terminal-prompt">$</span>{typingLine}</>
            )}
            <span className="landing-terminal-cursor" />
          </div>
        )}
      </div>
    </div>
  )
}
