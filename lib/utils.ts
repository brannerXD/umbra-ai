import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Sanea una URL provista por el usuario antes de usarla en un href.
// Solo permite http(s): bloquea esquemas peligrosos como javascript:, data: o
// vbscript: que podrían ejecutar código si el usuario hace clic. Devuelve
// undefined si la URL no es segura, para no renderizar el enlace.
export function safeExternalUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : undefined
  } catch {
    return undefined
  }
}
