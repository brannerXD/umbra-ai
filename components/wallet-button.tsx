"use client"

import { shortenWallet } from "@/lib/umbra"
import { useWallet } from "./wallet-provider"

export function WalletButton() {
  const { wallet, openModal, disconnect } = useWallet()

  if (wallet) {
    return (
      <button
        className="btn-wallet connected"
        onClick={() => {
          if (confirm("¿Desconectar wallet?")) disconnect()
        }}
      >
        {shortenWallet(wallet)}
      </button>
    )
  }

  return (
    <button className="btn-wallet" onClick={openModal}>
      Conectar Wallet
    </button>
  )
}
