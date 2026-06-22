"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { useToast } from "./toast-provider"

interface WalletContextValue {
  wallet: string | null
  connect: () => void
  disconnect: () => void
  openModal: () => void
  closeModal: () => void
  modalOpen: boolean
}

const WalletContext = createContext<WalletContextValue | null>(null)

const DEMO_WALLETS = [
  "7xK4mnBqR2pLfPQsT8vNdJhWcE3oUiYz9mN9p",
  "4hR8tnQwVxMkNPL5jBcA2uFdOeZ9iYgS3mW7k",
]

export function WalletProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast()
  const [wallet, setWalletState] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Persistencia demo en sessionStorage (como el prototipo original).
  useEffect(() => {
    setWalletState(sessionStorage.getItem("umbra_wallet"))
  }, [])

  const openModal = useCallback(() => setModalOpen(true), [])
  const closeModal = useCallback(() => setModalOpen(false), [])

  const connect = useCallback(() => {
    const addr = DEMO_WALLETS[Math.floor(Math.random() * DEMO_WALLETS.length)]
    sessionStorage.setItem("umbra_wallet", addr)
    setWalletState(addr)
    setModalOpen(false)
    showToast("Wallet conectada. Bienvenido a Umbra.", "success")
  }, [showToast])

  const disconnect = useCallback(() => {
    sessionStorage.removeItem("umbra_wallet")
    setWalletState(null)
    showToast("Wallet desconectada.", "info")
  }, [showToast])

  return (
    <WalletContext.Provider value={{ wallet, connect, disconnect, openModal, closeModal, modalOpen }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error("useWallet debe usarse dentro de WalletProvider")
  return ctx
}
