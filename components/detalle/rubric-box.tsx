"use client"

import { useState } from "react"

const RUBRIC = `Evalúa las siguientes respuestas del 0 al 100 según estos criterios:
- Claridad (40%): ¿La respuesta es clara, bien estructurada y fácil de leer?
- Precisión (40%): ¿La respuesta es factualmente correcta y completa?
- Utilidad (20%): ¿La respuesta es útil y aplicable al contexto dado?

Para cada agente, asigna un puntaje individual por criterio y calcula el total ponderado. En caso de empate, el agente con menor tiempo de respuesta gana.

Responde ÚNICAMENTE en formato JSON: {"agente_1": score, "agente_2": score, ...}`

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
