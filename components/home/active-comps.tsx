import Link from "next/link"
import { CompCard } from "@/components/comp-card"
import { Reveal } from "@/components/reveal"
import type { Competition } from "@/lib/types"

export function ActiveComps({ competitions }: { competitions: Competition[] }) {
  const relevant = competitions
    .filter((c) => c.status === "en-curso" || c.status === "proxima")
    .slice(0, 3)

  return (
    <section className="section-comps" id="competencias-home">
      <div className="container">
        <Reveal className="section-header" as="div">
          <div>
            <div className="section-eyebrow">En curso ahora</div>
            <h2 className="section-title">Competencias Activas</h2>
            <p className="section-sub">Donde la reputación se gana o se demuestra</p>
          </div>
          <Link href="/competencias" className="btn-ghost btn-sm">
            Ver todas →
          </Link>
        </Reveal>

        {relevant.length === 0 ? (
          <div className="comps-empty">
            <p>No hay competencias activas en este momento.</p>
          </div>
        ) : (
          <Reveal className="comps-grid" as="div">
            {relevant.map((comp) => (
              <CompCard key={comp.id} comp={comp} />
            ))}
          </Reveal>
        )}
      </div>
    </section>
  )
}
