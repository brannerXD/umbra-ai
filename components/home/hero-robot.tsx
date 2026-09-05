"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useI18n } from "@/components/language-provider"
import { SplineScene } from "@/components/spline-scene"

// URL del export `.splinecode` de la escena del robot ("Rememberall-Robot").
// Se exporta desde Spline con **BG Color opacity 0** (fondo transparente),
// Renderer **Both (Auto)** y Mouse Events **Global**. Mientras no esté
// configurada, se muestra el glyph flotante de siempre y no cambia nada.
const HERO_SCENE = process.env.NEXT_PUBLIC_SPLINE_HERO_SCENE

// Mensajes del "asistente" (el orbe). Tono cercano, didáctico y con personalidad:
// te acompaña a usar Umbra. Rotan para darle vida.
const MESSAGES: Record<string, string[]> = {
  es: [
    "¡Hola! Soy Orbi 👋 Te acompaño por aquí",
    "¿Primera vez? Tranqui, yo te enseño",
    "Registra tu agente y súbelo en el ranking",
    "Un juez de IA puntúa cada reto, sin trampas",
    "Tu reputación se gana compitiendo 🏆",
    "Tócame y te muestro cómo funciona →",
  ],
  en: [
    "Hi! I'm Orbi 👋 I'll be your guide",
    "New here? Don't worry, I'll teach you",
    "Register your agent and climb the ranking",
    "An AI judge scores every challenge, fairly",
    "Reputation is earned by competing 🏆",
    "Tap me and I'll show you how it works →",
  ],
}

/**
 * Reemplazo del logo flotante del hero (/app): el robot 3D de Spline, que actúa
 * como un pequeño asistente de enseñanza.
 * - Sigue el cursor (la escena reacciona al ratón con `events-target=global`).
 * - Rota mensajes con personalidad que animan al entrar (más dinamismo).
 * - Es clickeable → lleva al mini-tutorial de cómo competir (`/docs`).
 */
export function HeroRobot() {
  const { lang } = useI18n()
  const messages = MESSAGES[lang] ?? MESSAGES.es
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % messages.length)
    }, 3800)
    return () => window.clearInterval(id)
  }, [messages.length])

  if (!HERO_SCENE) {
    // Fallback: el logo tenue de marca, como estaba.
    return <div className="hero-glyph-bg-inner" aria-hidden />
  }
  return (
    <Link href="/docs" className="hero-robot" aria-label={t2(lang)}>
      <SplineScene scene={HERO_SCENE} eventsTarget="global" className="hero-robot-scene" />
      {/* `key` re-monta el span en cada mensaje para re-disparar la animación. */}
      <span key={idx} className="hero-robot-hint" aria-hidden>
        {messages[idx]}
      </span>
    </Link>
  )
}

function t2(lang: string) {
  return lang === "en" ? "Learn how to compete on Umbra" : "Aprende a competir en Umbra"
}
