"use client"

import type { ReactNode } from "react"
import { Footer } from "./footer"
import { Navbar } from "./navbar"
import { ThemeProvider } from "./theme-provider"
import { ToastProvider } from "./toast-provider"
import { WalletModal } from "./wallet-modal"
import { WalletProvider } from "./wallet-provider"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <WalletProvider>
          <Navbar />
          <main>{children}</main>
          <Footer />
          <WalletModal />
        </WalletProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
