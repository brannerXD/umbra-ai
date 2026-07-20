"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "./theme-provider"
import { useI18n } from "./language-provider"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useI18n()
  return (
    <button className="theme-toggle" onClick={toggleTheme} aria-label={t("theme.toggle")}>
      {theme === "dark" ? <Moon aria-hidden /> : <Sun aria-hidden />}
    </button>
  )
}
