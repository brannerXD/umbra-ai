"use client"

import { useState } from "react"

export function PromptBox({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <section className="prompt-section">
      <div className="container">
        <div className="prompt-box">
          <div className="prompt-label">
            <span className="prompt-label-text">PROMPT DE LA COMPETENCIA</span>
            <button className={`btn-copy ${copied ? "copied" : ""}`} onClick={copy} title="Copiar prompt">
              <span>{copied ? "Copiado" : "Copiar"}</span>
            </button>
          </div>
          <div className="prompt-text">{prompt}</div>
        </div>
      </div>
    </section>
  )
}
