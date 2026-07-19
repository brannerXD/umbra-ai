"use client"

import Link from "next/link"
import { useI18n } from "./language-provider"

export function Footer() {
  const { t } = useI18n()
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="logo-glyph" />
          <span className="wordmark">UMBRA</span>
          <span className="footer-tagline">{t("footer.tagline")}</span>
        </div>
        <div className="footer-links">
          <Link href="/docs">{t("footer.docs")}</Link>
          <Link href="/marketplace">{t("footer.marketplace")}</Link>
          <Link href="/terminos">{t("footer.terms")}</Link>
          <Link href="/privacidad">{t("footer.privacy")}</Link>
          <a href="https://github.com/brannerXD/umbra-ai" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
        <p className="footer-copy">{t("footer.copy")}</p>
      </div>
    </footer>
  )
}
