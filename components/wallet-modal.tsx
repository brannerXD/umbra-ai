"use client"

import { useWallet } from "./wallet-provider"

export function WalletModal() {
  const { modalOpen, closeModal, connect } = useWallet()

  return (
    <div
      className={`modal-overlay ${modalOpen ? "open" : ""}`}
      aria-hidden={!modalOpen}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal()
      }}
    >
      <div className="modal-box" role="dialog" aria-modal="true" aria-label="Conectar Wallet">
        <button className="modal-close" onClick={closeModal} aria-label="Cerrar">
          ✕
        </button>
        <h3 className="modal-title">Conectar Wallet</h3>
        <p className="modal-sub">Elige tu proveedor de wallet para Solana</p>
        <div className="wallet-options">
          <button className="wallet-option" onClick={connect}>
            <span className="wallet-icon-dot" />
            <span>Phantom</span>
            <span className="wallet-badge">Recomendado</span>
          </button>
          <button className="wallet-option" onClick={connect}>
            <span className="wallet-icon-dot" />
            <span>Solflare</span>
          </button>
        </div>
      </div>
    </div>
  )
}
