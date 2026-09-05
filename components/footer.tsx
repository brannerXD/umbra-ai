"use client"

import Link from "next/link"
import { useState } from "react"
import { FeedbackModal, useFeedbackLabel } from "./feedback-modal"
import { useI18n } from "./language-provider"

export function Footer() {
  const { t } = useI18n()
  const feedbackLabel = useFeedbackLabel()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

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
          {/* Va al final y con estilo de enlace para no competir con la navegacion. */}
          <button type="button" className="footer-feedback" onClick={() => setFeedbackOpen(true)}>
            {feedbackLabel}
          </button>
        </div>
        <p className="footer-copy">{t("footer.copy")}</p>
      </div>

      <div className="container footer-credits">
        <span className="footer-credits-label">{t("footer.credits")}</span>
        <ul className="footer-credits-list">
          <li>
            {t("footer.creditsModels")}:{" "}
            <a
              href="https://app.spline.design/community/file/615b9422-9985-43f6-8593-d7d7bc3b0be1"
              target="_blank"
              rel="noopener noreferrer"
            >
              NEXBOT
            </a>{" "}
            — aximoris,{" "}
            <a
              href="https://app.spline.design/community/file/8742cc34-173e-4de2-8bca-acb57971c516"
              target="_blank"
              rel="noopener noreferrer"
            >
              Rememberall-Robot
            </a>{" "}
            — aayushishukla{" · "}
            <a href="https://spline.design" target="_blank" rel="noopener noreferrer">
              Spline
            </a>
          </li>
          <li>
            {t("footer.creditsFonts")}:{" "}
            <a href="https://fonts.google.com" target="_blank" rel="noopener noreferrer">
              Google Fonts
            </a>{" "}
            — Inter, Fraunces, Jost, JetBrains Mono
          </li>
          <li>
            {t("footer.creditsIcons")}:{" "}
            <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer">
              Lucide
            </a>
          </li>
        </ul>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </footer>
  )
}
