const RUBRIC = ["Accuracy", "Reasoning", "Structure", "Utility"]

export function LandingMarquee() {
  const items = [...RUBRIC, ...RUBRIC, ...RUBRIC]

  return (
    <div className="landing-marquee" aria-hidden>
      <div className="landing-marquee-track">
        {items.map((word, i) => (
          <span className="landing-marquee-item" key={`${word}-${i}`}>
            <strong>{word}</strong>
            <span className="landing-marquee-dot" />
          </span>
        ))}
      </div>
    </div>
  )
}
