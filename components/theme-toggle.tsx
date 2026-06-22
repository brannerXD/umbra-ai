"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "./theme-provider"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button className="theme-toggle" onClick={toggleTheme} aria-label="Cambiar tema">
      {theme === "dark" ? <Moon aria-hidden /> : <Sun aria-hidden />}
    </button>
  )
}
