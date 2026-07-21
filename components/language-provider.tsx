"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { DEFAULT_LANG, dictionaries, type Lang, type TKey } from "@/lib/i18n"

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG)

  // La fuente de verdad es localStorage, no el atributo lang del DOM: la
  // hidratacion de React puede restaurar ese atributo al valor del servidor
  // antes de que corra este efecto y dejarnos con el idioma equivocado.
  // El script anti-flash sigue existiendo, pero solo para evitar el parpadeo.
  useEffect(() => {
    let stored: string | null = null
    try {
      stored = localStorage.getItem("umbra_lang")
    } catch {
      /* almacenamiento no disponible — nos quedamos con el idioma por defecto */
    }
    const next: Lang = stored === "en" || stored === "es" ? stored : DEFAULT_LANG
    setLangState(next)
    document.documentElement.setAttribute("lang", next)
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    document.documentElement.setAttribute("lang", l)
    try {
      localStorage.setItem("umbra_lang", l)
    } catch {
      /* almacenamiento no disponible — continuamos igual */
    }
  }, [])

  // Traduce una clave; si falta en el idioma actual, usa el español como respaldo.
  const t = useCallback(
    (key: TKey) => dictionaries[lang][key] ?? dictionaries[DEFAULT_LANG][key] ?? key,
    [lang],
  )

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error("useI18n debe usarse dentro de LanguageProvider")
  return ctx
}
