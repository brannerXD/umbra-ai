"use client"

import { useRef, useState } from "react"
import { UploadCloud } from "lucide-react"
import { useI18n } from "@/components/language-provider"
import { useToast } from "@/components/toast-provider"
import { supabase } from "@/lib/supabase"

const MAX_AVATAR_BYTES = 3 * 1024 * 1024

// Textos del selector en ambos idiomas.
const T = {
  es: {
    defaultTitle: "Elige tu avatar",
    close: "Cerrar",
    presets: "Avatares predeterminados",
    pickAria: "Elegir avatar pixel-art",
    or: "o",
    dropAria: "Arrastra una foto o haz clic para subir",
    uploading: "Subiendo...",
    dropTitle: "Arrastra una foto aquí",
    dropHint: "o haz clic para explorar · JPG, PNG · máx 3MB",
    errUpdate: "No se pudo actualizar el avatar.",
    errType: "Selecciona un archivo de imagen.",
    errSize: "La imagen debe pesar menos de 3MB.",
    errUpload: "No se pudo subir la foto.",
  },
  en: {
    defaultTitle: "Choose your avatar",
    close: "Close",
    presets: "Default avatars",
    pickAria: "Choose pixel-art avatar",
    or: "or",
    dropAria: "Drag a photo or click to upload",
    uploading: "Uploading...",
    dropTitle: "Drag a photo here",
    dropHint: "or click to browse · JPG, PNG · max 3MB",
    errUpdate: "Could not update the avatar.",
    errType: "Select an image file.",
    errSize: "The image must be smaller than 3MB.",
    errUpload: "Could not upload the photo.",
  },
} as const

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
  title,
  subtitle,
  skipLabel,
  onChosen,
  onClose,
}: AvatarPickerProps) {
  const { showToast } = useToast()
  const { lang } = useI18n()
  const s = T[lang]
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function persistAvatar(url: string): Promise<boolean> {
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId)
    if (error) {
      showToast(s.errUpdate, "warn")
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

  async function processFile(file: File) {
    if (uploading) return
    if (!file.type.startsWith("image/")) {
      showToast(s.errType, "warn")
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showToast(s.errSize, "warn")
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
      showToast(s.errUpload, "warn")
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

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) processFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button className="modal-close" aria-label={s.close} onClick={onClose}>
          ✕
        </button>
        <h3 className="modal-title">{title ?? s.defaultTitle}</h3>
        {subtitle && <p className="modal-sub">{subtitle}</p>}

        <div className="avatar-picker-label">{s.presets}</div>
        <div className="avatar-picker">
          {PIXEL_AVATARS.map((url) => (
            <button
              key={url}
              type="button"
              className={`avatar-option${currentUrl === url ? " selected" : ""}`}
              onClick={() => selectPreset(url)}
              aria-label={s.pickAria}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" />
            </button>
          ))}
        </div>

        <div className="avatar-picker-divider">
          <span>{s.or}</span>
        </div>

        <button
          type="button"
          className={`avatar-dropzone${dragging ? " dragging" : ""}${uploading ? " busy" : ""}`}
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            if (!uploading) setDragging(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setDragging(false)
          }}
          onDrop={onDrop}
          disabled={uploading}
          aria-label={s.dropAria}
        >
          <UploadCloud className="avatar-dropzone-icon" aria-hidden />
          <span className="avatar-dropzone-title">
            {uploading ? s.uploading : s.dropTitle}
          </span>
          {!uploading && <span className="avatar-dropzone-hint">{s.dropHint}</span>}
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
