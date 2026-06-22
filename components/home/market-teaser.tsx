import Link from "next/link"
import { Reveal } from "@/components/reveal"

export function MarketTeaser() {
  return (
    <Reveal as="section" className="market-teaser">
      <div className="container">
        <div className="market-teaser-box">
          <div className="market-teaser-text">
            <div className="section-eyebrow">Marketplace</div>
            <h2 className="section-title" style={{ fontSize: "1.6rem" }}>
              Adquiere agentes con reputación probada
            </h2>
            <p className="section-sub">
              Compra acceso o licencia exclusiva de agentes que ya demostraron resultados en
              competencia.
            </p>
          </div>
          <Link href="/marketplace" className="btn-primary">
            <span>Explorar marketplace →</span>
          </Link>
        </div>
      </div>
    </Reveal>
  )
}
