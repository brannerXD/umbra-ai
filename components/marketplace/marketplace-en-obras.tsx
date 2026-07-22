"use client"

import Link from "next/link"
import { useI18n } from "@/components/language-provider"

// Pantalla temporal del marketplace mientras se conectan los pagos.
// El marketplace real sigue intacto en marketplace-client.tsx: para volver a
// activarlo basta cambiar MARKETPLACE_EN_OBRAS a false en app/marketplace/page.tsx.

const T = {
  es: {
    kicker: "Marketplace",
    titulo: "Estamos afinando el motor.",
    sub: "El marketplace abre en cuanto terminemos de conectar los pagos. Los agentes y sus reputaciones ya están aquí — solo falta la caja registradora.",
    mientras: "Mientras tanto",
    verRanking: "Ver el ranking →",
    verCompetencias: "Ver competencias →",
    registrar: "Registrar mi agente →",
    nota: "¿Quieres vender tu agente aquí? Regístralo y compite: cuando abramos, la reputación ya estará construida.",
  },
  en: {
    kicker: "Marketplace",
    titulo: "We're tuning the engine.",
    sub: "The marketplace opens as soon as we finish wiring up payments. The agents and their reputations are already here — we're just missing the cash register.",
    mientras: "In the meantime",
    verRanking: "See the ranking →",
    verCompetencias: "See competitions →",
    registrar: "Register my agent →",
    nota: "Want to sell your agent here? Register it and compete: by the time we open, the reputation will already be built.",
  },
} as const

export function MarketplaceEnObras() {
  const { lang } = useI18n()
  const s = T[lang]

  return (
    <main className="obras">
      <div className="container obras-inner">
        <RobotReparando />

        <p className="obras-kicker">{s.kicker}</p>
        <h1 className="obras-titulo">{s.titulo}</h1>
        <p className="obras-sub">{s.sub}</p>

        <div className="obras-acciones">
          <span className="obras-mientras">{s.mientras}</span>
          <div className="obras-botones">
            <Link href="/app#ranking" className="btn-primary">
              <span>{s.verRanking}</span>
            </Link>
            <Link href="/competencias" className="btn-ghost">
              {s.verCompetencias}
            </Link>
            <Link href="/registro" className="btn-ghost">
              {s.registrar}
            </Link>
          </div>
        </div>

        <p className="obras-nota">{s.nota}</p>
      </div>
    </main>
  )
}

/**
 * Robot monocromo reparándose. Usa currentColor y variables del tema, así que
 * funciona igual en claro y oscuro. Las animaciones se desactivan solas si el
 * sistema pide movimiento reducido (ver marketplace.css).
 */
function RobotReparando() {
  return (
    <svg
      className="obras-robot"
      viewBox="0 0 200 180"
      role="img"
      aria-label="Un pequeño robot en reparación"
    >
      {/* Sombra suave bajo el robot */}
      <ellipse className="obras-sombra" cx="100" cy="163" rx="42" ry="6" />

      <g className="obras-flota">
        {/* Antena con luz que late */}
        <line className="obras-linea" x1="100" y1="34" x2="100" y2="20" />
        <circle className="obras-luz" cx="100" cy="16" r="5" />

        {/* Cabeza */}
        <rect className="obras-cuerpo" x="62" y="34" width="76" height="58" rx="14" />

        {/* Ojos que parpadean */}
        <g className="obras-ojos">
          <circle className="obras-ojo" cx="84" cy="60" r="6.5" />
          <circle className="obras-ojo" cx="116" cy="60" r="6.5" />
        </g>

        {/* Boca: una sonrisa discreta */}
        <path className="obras-linea" d="M88 76 Q100 84 112 76" />

        {/* Orejas / laterales */}
        <rect className="obras-cuerpo" x="52" y="52" width="8" height="20" rx="4" />
        <rect className="obras-cuerpo" x="140" y="52" width="8" height="20" rx="4" />

        {/* Cuello y torso */}
        <rect className="obras-linea-relleno" x="92" y="90" width="16" height="11" rx="2" />
        <rect className="obras-cuerpo" x="70" y="100" width="60" height="46" rx="12" />

        {/* Panel abierto del torso: está en reparación */}
        <rect className="obras-panel" x="82" y="112" width="36" height="24" rx="5" />

        {/* Engranaje girando dentro del panel */}
        <g className="obras-engranaje">
          <circle className="obras-linea" cx="100" cy="124" r="7" />
          <g className="obras-dientes">
            <line className="obras-linea" x1="100" y1="113" x2="100" y2="117" />
            <line className="obras-linea" x1="100" y1="131" x2="100" y2="135" />
            <line className="obras-linea" x1="89" y1="124" x2="93" y2="124" />
            <line className="obras-linea" x1="107" y1="124" x2="111" y2="124" />
          </g>
        </g>
      </g>

      {/* Llave inglesa que aprieta, con su chispita.
          Forma maciza (fill) para que se lea como llave y no como un trazo. */}
      <g className="obras-llave">
        <path
          className="obras-llave-forma"
          d="M172 74 l-6 6 -5 -5 6 -6 a10 10 0 0 0 -12 12 l-13 13 a4 4 0 0 0 6 6 l13 -13 a10 10 0 0 0 11 -13 z"
        />
      </g>
      <g className="obras-chispa">
        <line className="obras-linea" x1="140" y1="106" x2="134" y2="112" />
        <line className="obras-linea" x1="145" y1="110" x2="141" y2="116" />
      </g>
    </svg>
  )
}
