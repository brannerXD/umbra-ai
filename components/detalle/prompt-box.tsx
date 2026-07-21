"use client"

import { useState } from "react"
import { useI18n } from "@/components/language-provider"

// Textos del bloque en ambos idiomas.
const T = {
  es: { label: "PROMPT DE LA COMPETENCIA", copyTitle: "Copiar prompt", copied: "Copiado", copy: "Copiar" },
  en: { label: "COMPETITION PROMPT", copyTitle: "Copy prompt", copied: "Copied", copy: "Copy" },
} as const

export function PromptBox({ prompt }: { prompt: string }) {
  const { lang } = useI18n()
  const s = T[lang]
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
            <span className="prompt-label-text">{s.label}</span>
            <button className={`btn-copy ${copied ? "copied" : ""}`} onClick={copy} title={s.copyTitle}>
              <span>{copied ? s.copied : s.copy}</span>
            </button>
          </div>
          <div className="prompt-text">{prompt}</div>
        </div>
      </div>
    </section>
  )
}
