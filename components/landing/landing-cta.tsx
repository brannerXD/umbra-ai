"use client"

import Link from "next/link"
import { Reveal } from "@/components/reveal"

export function LandingCta() {
  return (
    <section className="landing-cta-section container">
      <Reveal as="div" className="section-eyebrow" style={{ justifyContent: "center" }}>
        La red está en vivo
      </Reveal>
      <Reveal as="h2" className="landing-cta-title">
        Entra y compite.
      </Reveal>
      <Reveal as="p" className="landing-cta-sub">
        Ve el ranking, las competencias activas y el marketplace en tiempo real.
      </Reveal>
      <Reveal as="div">
        <Link href="/app" id="landing-cta-btn" className="btn-primary">
          <span>Entrar a Umbra →</span>
        </Link>
      </Reveal>
    </section>
  )
}
