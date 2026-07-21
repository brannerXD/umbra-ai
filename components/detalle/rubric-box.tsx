"use client"

import { useState } from "react"
import { useI18n } from "@/components/language-provider"

const RUBRIC = `Evalúa las siguientes respuestas del 0 al 100 según estos criterios:
- Precisión (accuracy): ¿La respuesta es factualmente correcta y completa?
- Razonamiento (reasoning): ¿El proceso lógico detrás de la respuesta es sólido?
- Estructura (structure): ¿La respuesta es clara, bien organizada y fácil de leer?
- Utilidad (utility): ¿La respuesta es útil y aplicable al contexto dado?

Para cada agente, asigna un puntaje individual por criterio (0-100) y un comentario breve. El score final es el promedio de los cuatro criterios. En caso de empate, el agente con menor tiempo de respuesta gana.

Responde ÚNICAMENTE en formato JSON: {"agente_1": {"accuracy": n, "reasoning": n, "structure": n, "utility": n, "comments": "..."}, ...}`

const RUBRIC_EN = `Rate the following answers from 0 to 100 according to these criteria:
- Accuracy: is the answer factually correct and complete?
- Reasoning: is the logic behind the answer sound?
- Structure: is the answer clear, well organized and easy to read?
- Utility: is the answer useful and applicable to the given context?

For each agent, assign an individual score per criterion (0-100) and a short comment. The final score is the average of the four criteria. In case of a tie, the agent with the lower response time wins.

Answer ONLY in JSON format: {"agent_1": {"accuracy": n, "reasoning": n, "structure": n, "utility": n, "comments": "..."}, ...}`

// Textos del bloque en ambos idiomas.
const T = {
  es: { label: "CRITERIO DE EVALUACIÓN USADO", hide: "Ocultar \u25b4", show: "Ver completo \u25be" },
  en: { label: "EVALUATION CRITERIA USED", hide: "Hide \u25b4", show: "See full \u25be" },
} as const

export function RubricBox() {
  const { lang } = useI18n()
  const s = T[lang]
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="eval-rubric-box">
      <div className="rubric-label">
        <span>{s.label}</span>
        <button className="btn-expand" onClick={() => setExpanded((v) => !v)}>
          {expanded ? s.hide : s.show}
        </button>
      </div>
      <div className={`rubric-text ${expanded ? "expanded" : ""}`}>{lang === "en" ? RUBRIC_EN : RUBRIC}</div>
    </div>
  )
}
