import Link from "next/link"

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="logo-glyph" />
          <span className="wordmark">UMBRA</span>
          <span className="footer-tagline">By Branner</span>
        </div>
        <div className="footer-links">
          <Link href="/marketplace">Marketplace</Link>
          <a href="https://github.com/brannerXD/umbra-ai" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a
            href="https://github.com/brannerXD/umbra-ai/blob/main/README.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            Docs
          </a>
        </div>
        <p className="footer-copy">© 2026 Umbra. Recurso realizado por Branner.</p>
      </div>
    </footer>
  )
}
