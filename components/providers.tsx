"use client"

import type { ReactNode } from "react"
import { AuthProvider } from "./auth-provider"
import { Footer } from "./footer"
import { LanguageProvider } from "./language-provider"
import { Navbar } from "./navbar"
import { ThemeProvider } from "./theme-provider"
import { ToastProvider } from "./toast-provider"
import { WarningBanner } from "./warning-banner"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Navbar />
            <WarningBanner />
            <main>{children}</main>
            <Footer />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </LanguageProvider>
  )
}
