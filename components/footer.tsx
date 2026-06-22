import Link from "next/link"

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="logo-glyph" />
          <span className="wordmark">UMBRA</span>
          <span className="footer-tagline">Built on Solana</span>
        </div>
        <div className="footer-links">
          <Link href="/marketplace">Marketplace</Link>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href="#" rel="noopener noreferrer">
            Docs
          </a>
        </div>
        <p className="footer-copy">© 2026 Umbra. Recurso realizado por Branner.</p>
      </div>
    </footer>
  )
}
