"use client"

import { useEffect, useRef } from "react"

// CAPTCHA de Cloudflare Turnstile para proteger el login/registro contra
// intentos automatizados (fuerza bruta). La verificación la EXIGE y la valida
// Supabase Auth en su servidor, así que no se puede saltar llamando a la API
// directamente — a diferencia de cualquier límite que pusiéramos en la app.
//
// Degrada con gracia: si NEXT_PUBLIC_TURNSTILE_SITE_KEY no está configurada, el
// widget no se renderiza y el login sigue funcionando igual que antes. La llave
// del sitio (site key) es pública por diseño; la secret key va en el panel de
// Supabase, nunca aquí.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id?: string) => void
  remove: (id?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/** ¿Está el CAPTCHA activo? Solo si el sitio tiene configurada su site key. */
export function isCaptchaEnabled(): boolean {
  return !!SITE_KEY
}

// El script se carga una sola vez para toda la app.
let scriptPromise: Promise<void> | null = null
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script")
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error("No se pudo cargar Turnstile"))
    document.head.appendChild(s)
  })
  return scriptPromise
}

interface TurnstileProps {
  /** Se llama con el token cuando el usuario supera la verificación. */
  onToken: (token: string) => void
  /** Se llama si el token expira o falla (hay que pedir uno nuevo). */
  onExpire?: () => void
  theme?: "dark" | "light"
}

export function Turnstile({ onToken, onExpire, theme }: TurnstileProps) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  // Los callbacks se guardan en refs para no re-renderizar el widget cuando
  // cambian de identidad (el efecto de montaje corre una sola vez).
  const cbToken = useRef(onToken)
  const cbExpire = useRef(onExpire)
  useEffect(() => {
    cbToken.current = onToken
    cbExpire.current = onExpire
  })

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return
        // Sin prop explícita, el widget sigue el tema activo de la app (claro
        // por defecto) leyendo el atributo aplicado en <html>.
        const effectiveTheme =
          theme ??
          (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light")
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          theme: effectiveTheme,
          callback: (token: string) => cbToken.current(token),
          "expired-callback": () => cbExpire.current?.(),
          "error-callback": () => cbExpire.current?.(),
        })
      })
      .catch(() => {
        /* si el script no carga, no bloqueamos el login */
      })
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current)
        } catch {
          /* el widget ya no existe */
        }
        widgetId.current = null
      }
    }
  }, [theme])

  if (!SITE_KEY) return null
  return <div ref={ref} className="turnstile-widget" aria-label="Verificación de seguridad" />
}
