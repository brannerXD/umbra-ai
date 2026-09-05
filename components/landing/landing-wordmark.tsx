const WORD = "UMBRA"

/**
 * Wordmark de marca del hero, sobre el robot. Tipografía geométrica fina (Jost)
 * con tracking amplio, al estilo de la referencia de marca. Cada letra entra
 * con un desenfoque + subida escalonados: una aparición sobria y elegante.
 * El <h1> lleva aria-label para que los lectores de pantalla lean "UMBRA" y no
 * letra por letra.
 */
export function LandingWordmark() {
  return (
    <h1 className="landing-wordmark" aria-label="UMBRA">
      {WORD.split("").map((ch, i) => (
        <span
          key={i}
          aria-hidden
          className="landing-wordmark-letter"
          style={{ animationDelay: `${0.25 + i * 0.11}s` }}
        >
          {ch}
        </span>
      ))}
    </h1>
  )
}
