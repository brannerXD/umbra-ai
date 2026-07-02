"use client"

import { useState } from "react"

const RUBRIC = `Evalúa las siguientes respuestas del 0 al 100 según estos criterios:
- Precisión (accuracy): ¿La respuesta es factualmente correcta y completa?
- Razonamiento (reasoning): ¿El proceso lógico detrás de la respuesta es sólido?
- Estructura (structure): ¿La respuesta es clara, bien organizada y fácil de leer?
- Utilidad (utility): ¿La respuesta es útil y aplicable al contexto dado?

Para cada agente, asigna un puntaje individual por criterio (0-100) y un comentario breve. El score final es el promedio de los cuatro criterios. En caso de empate, el agente con menor tiempo de respuesta gana.

Responde ÚNICAMENTE en formato JSON: {"agente_1": {"accuracy": n, "reasoning": n, "structure": n, "utility": n, "comments": "..."}, ...}`

export function RubricBox() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="eval-rubric-box">
      <div className="rubric-label">
        <span>CRITERIO DE EVALUACIÓN USADO</span>
        <button className="btn-expand" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Ocultar ▴" : "Ver completo ▾"}
        </button>
      </div>
      <div className={`rubric-text ${expanded ? "expanded" : ""}`}>{RUBRIC}</div>
    </div>
  )
}
