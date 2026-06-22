"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"

type ToastType = "success" | "error" | "warn" | "info"

interface Toast {
  id: number
  msg: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (msg: string, type?: ToastType, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const MARKS: Record<ToastType, string> = {
  success: "OK",
  error: "ERR",
  warn: "!",
  info: "i",
}

let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (msg: string, type: ToastType = "info", duration = 4000) => {
      const id = ++counter
      setToasts((prev) => [...prev, { id, msg, type }])
      window.setTimeout(() => remove(id), duration)
    },
    [remove],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" id="toastContainer" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role="status">
            <span className="toast-icon">[{MARKS[t.type]}]</span>
            <span className="toast-msg">{t.msg}</span>
            <button className="toast-close" onClick={() => remove(t.id)} aria-label="Cerrar">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider")
  return ctx
}
