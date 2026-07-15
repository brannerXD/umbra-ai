"use client"

import { useRef, useState } from "react"
import { useToast } from "@/components/toast-provider"
import { supabase } from "@/lib/supabase"

const MAX_AVATAR_BYTES = 3 * 1024 * 1024

// Avatares pixel-art incluidos (en public/avatars).
export const PIXEL_AVATARS = [
  "/avatars/pixel-1.svg",
  "/avatars/pixel-2.svg",
  "/avatars/pixel-3.svg",
  "/avatars/pixel-4.svg",
  "/avatars/pixel-5.svg",
  "/avatars/pixel-6.svg",
]

interface AvatarPickerProps {
  userId: string
  currentUrl?: string | null
  title?: string
  subtitle?: string
  /** Si se pasa, muestra un botón para omitir (usado al crear la cuenta). */
  skipLabel?: string
  /** url = avatar elegido/subido; null = se omitió sin elegir. */
  onChosen: (url: string | null) => void
  onClose: () => void
}

export function AvatarPicker({
  userId,
  currentUrl,
  title = "Elige tu avatar",
  subtitle,
  skipLabel,
  onChosen,
  onClose,
}: AvatarPickerProps) {
  const { showToast } = useToast()
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function persistAvatar(url: string): Promise<boolean> {
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId)
    if (error) {
      showToast("No se pudo actualizar el avatar.", "warn")
      return false
    }
    return true
  }

  async function selectPreset(url: string) {
    if (await persistAvatar(url)) {
      onChosen(url)
      onClose()
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      showToast("Selecciona un archivo de imagen.", "warn")
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showToast("La imagen debe pesar menos de 3MB.", "warn")
      return
    }
    setUploading(true)
    const ext = file.name.split(".").pop() ?? "jpg"
    const path = `${userId}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" })
    if (uploadError) {
      setUploading(false)
      showToast("No se pudo subir la foto.", "warn")
      return
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path)
    const url = `${data.publicUrl}?t=${Date.now()}`
    const ok = await persistAvatar(url)
    setUploading(false)
    if (ok) {
      onChosen(url)
      onClose()
    }
  }

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button className="modal-close" aria-label="Cerrar" onClick={onClose}>
          ✕
        </button>
        <h3 className="modal-title">{title}</h3>
        {subtitle && <p className="modal-sub">{subtitle}</p>}

        <div className="avatar-picker-label">Avatares predeterminados</div>
        <div className="avatar-picker">
          {PIXEL_AVATARS.map((url) => (
            <button
              key={url}
              type="button"
              className={`avatar-option${currentUrl === url ? " selected" : ""}`}
              onClick={() => selectPreset(url)}
              aria-label="Elegir avatar pixel-art"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" />
            </button>
          ))}
        </div>

        <div className="avatar-picker-divider">
          <span>o</span>
        </div>

        <button type="button" className="btn-ghost avatar-picker-upload" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <span>{uploading ? "Subiendo..." : "Subir una foto"}</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />

        {skipLabel && (
          <div className="modal-actions">
            <button
              className="btn-ghost"
              onClick={() => {
                onChosen(null)
                onClose()
              }}
            >
              {skipLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
