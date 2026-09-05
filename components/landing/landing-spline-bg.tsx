"use client"

import { SplineScene } from "@/components/spline-scene"

// La escena se configura por variable de entorno pública para poder cambiarla
// sin tocar código. Cuando esté lista, poner en `.env.local`:
//   NEXT_PUBLIC_SPLINE_LANDING_SCENE="https://prod.spline.design/xxxx/scene.splinecode"
const SCENE = process.env.NEXT_PUBLIC_SPLINE_LANDING_SCENE ?? ""

/**
 * Fondo de la landing. Capa fija a pantalla completa, DETRÁS de todo el
 * contenido. Cuando hay una escena de Spline configurada, monta NEXBOT ahí;
 * si no, deja un fondo estático y sobrio (la landing se ve intencional
 * mientras la escena no esté puesta).
 *
 * Encima de la escena va un velo (`landing-bg-scrim`) que garantiza la
 * legibilidad del texto por muy contrastada que sea la escena 3D.
 */
export function LandingSplineBg() {
  return (
    <div className="landing-bg" aria-hidden>
      {SCENE ? (
        <SplineScene scene={SCENE} className="landing-bg-scene" />
      ) : null}
      <div className="landing-bg-scrim" />
    </div>
  )
}
