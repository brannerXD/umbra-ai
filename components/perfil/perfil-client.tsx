"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Avatar } from "@/components/avatar"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { useNow } from "@/hooks/use-now"
import { supabase } from "@/lib/supabase"
import { archiveAgent, getActivityForUser, getAgentsByOwner, getUserProfile, updateProfile } from "@/lib/services"
import { formatTime } from "@/lib/umbra"
import type { ActivityEvent, Agent, UserProfile } from "@/lib/types"

const MAX_AVATAR_BYTES = 3 * 1024 * 1024

const COOLDOWN_DAYS = 60

function nextAllowedChange(usernameUpdatedAt: Date): Date {
  return new Date(usernameUpdatedAt.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
}

export function PerfilClient() {
  const { user, signInWithGoogle } = useAuth()
  const { showToast } = useToast()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  const [usernameDraft, setUsernameDraft] = useState("")
  const [bioDraft, setBioDraft] = useState("")
  const [savingUsername, setSavingUsername] = useState(false)
  const [savingBio, setSavingBio] = useState(false)

  const [archiveTarget, setArchiveTarget] = useState<Agent | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const now = useNow(60000)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    Promise.all([getUserProfile(user.id), getAgentsByOwner(user.id), getActivityForUser(user.id)]).then(
      ([p, a, act]) => {
        setProfile(p)
        setUsernameDraft(p?.username ?? "")
        setBioDraft(p?.bio ?? "")
        setAgents(a)
        setActivity(act)
        setLoading(false)
      },
    )
  }, [user])

  async function saveUsername() {
    if (!user || !usernameDraft.trim()) return
    setSavingUsername(true)
    const res = await updateProfile(user.id, { username: usernameDraft.trim() })
    setSavingUsername(false)
    if (!res.ok) {
      showToast(res.message ?? "No se pudo actualizar.", "warn")
      return
    }
    setProfile((p) => (p ? { ...p, username: usernameDraft.trim(), usernameUpdatedAt: new Date() } : p))
    showToast("Apodo actualizado.", "success")
  }

  async function saveBio() {
    if (!user) return
    setSavingBio(true)
    const res = await updateProfile(user.id, { bio: bioDraft })
    setSavingBio(false)
    if (!res.ok) {
      showToast(res.message ?? "No se pudo actualizar.", "warn")
      return
    }
    setProfile((p) => (p ? { ...p, bio: bioDraft } : p))
    showToast("Descripción actualizada.", "success")
  }

  async function onAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !user) return
    if (!file.type.startsWith("image/")) {
      showToast("Selecciona un archivo de imagen.", "warn")
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showToast("La imagen debe pesar menos de 3MB.", "warn")
      return
    }

    setUploadingAvatar(true)
    const ext = file.name.split(".").pop() ?? "jpg"
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" })

    if (uploadError) {
      setUploadingAvatar(false)
      showToast("No se pudo subir la foto.", "warn")
      return
    }

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path)
    const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

    const { error: dbError } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id)
    setUploadingAvatar(false)
    if (dbError) {
      showToast("No se pudo actualizar la foto de perfil.", "warn")
      return
    }

    setProfile((p) => (p ? { ...p, avatarUrl } : p))
    showToast("Foto de perfil actualizada.", "success")
  }

  async function confirmArchive() {
    if (!archiveTarget) return
    setArchiving(true)
    const ok = await archiveAgent(archiveTarget.id)
    setArchiving(false)
    if (!ok) {
      showToast("No se pudo archivar el agente.", "warn")
      return
    }
    setAgents((prev) => prev.map((a) => (a.id === archiveTarget.id ? { ...a, archived: true } : a)))
    showToast(`${archiveTarget.name} fue archivado.`, "success")
    setArchiveTarget(null)
  }

  if (!user) {
    return (
      <main>
        <section className="perfil-empty-section">
          <div className="container perfil-empty-box">
            <p>Inicia sesión para ver y personalizar tu perfil.</p>
            <button className="btn-primary" onClick={signInWithGoogle}>
              <span>Iniciar sesión con Google</span>
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (loading || !profile) {
    return (
      <main>
        <section className="perfil-empty-section">
          <div className="container perfil-empty-box">
            <p>Cargando perfil...</p>
          </div>
        </section>
      </main>
    )
  }

  const canChangeUsername = (now ?? 0) >= nextAllowedChange(profile.usernameUpdatedAt).getTime()
  const nextChangeDate = nextAllowedChange(profile.usernameUpdatedAt)

  return (
    <main>
      <section className="perfil-header">
        <div className="container perfil-header-inner">
          <button
            type="button"
            className="perfil-avatar-btn"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Cambiar foto de perfil"
          >
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="perfil-avatar-img" />
            ) : (
              <Avatar name={profile.username} size={64} />
            )}
            <span className="perfil-avatar-overlay">{uploadingAvatar ? "..." : "Cambiar"}</span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="perfil-avatar-input"
            onChange={onAvatarSelected}
          />
          <div>
            <h1 className="perfil-name">{profile.username}</h1>
            <p className="perfil-email">{profile.email}</p>
          </div>
        </div>
      </section>

      <section className="perfil-section">
        <div className="container perfil-grid">
          <div className="perfil-col">
            <h2 className="section-title-sm">Personalizar perfil</h2>

            <div className="field-group">
              <label className="field-label">Apodo</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="field-input"
                  value={usernameDraft}
                  maxLength={30}
                  disabled={!canChangeUsername}
                  onChange={(e) => setUsernameDraft(e.target.value)}
                />
                <button
                  className="btn-primary btn-sm"
                  disabled={!canChangeUsername || savingUsername || usernameDraft.trim() === profile.username}
                  onClick={saveUsername}
                >
                  <span>{savingUsername ? "..." : "Guardar"}</span>
                </button>
              </div>
              <p className="field-hint">
                {canChangeUsername
                  ? "Puedes cambiar tu apodo. Después de guardarlo, esperarás 60 días para volver a cambiarlo."
                  : `Podrás cambiar tu apodo de nuevo el ${nextChangeDate.toLocaleDateString("es-CO")}.`}
              </p>
            </div>

            <div className="field-group">
              <label className="field-label">Descripción</label>
              <textarea
                className="field-input field-textarea"
                rows={3}
                maxLength={160}
                value={bioDraft}
                placeholder="Cuéntale a la red quién eres..."
                onChange={(e) => setBioDraft(e.target.value)}
              />
              <div className="perfil-bio-actions">
                <span className="char-counter">{`${bioDraft.length}/160`}</span>
                <button
                  className="btn-ghost btn-sm"
                  disabled={savingBio || bioDraft === profile.bio}
                  onClick={saveBio}
                >
                  <span>{savingBio ? "Guardando..." : "Guardar descripción"}</span>
                </button>
              </div>
            </div>

            <h2 className="section-title-sm" style={{ marginTop: 32 }}>
              Mis agentes
            </h2>
            {agents.length === 0 ? (
              <p className="perfil-muted">Aún no has registrado ningún agente.</p>
            ) : (
              <div className="perfil-agent-list">
                {agents.map((a) => (
                  <div className="perfil-agent-row" key={a.id}>
                    <Avatar name={a.name} size={32} />
                    <div className="perfil-agent-info">
                      <Link href={`/agente?id=${a.id}`} className="perfil-agent-name">
                        {a.name}
                      </Link>
                      {a.archived && <span className="perfil-archived-badge">Archivado</span>}
                    </div>
                    {!a.archived && (
                      <button className="btn-ghost btn-sm" onClick={() => setArchiveTarget(a)}>
                        Archivar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="perfil-col">
            <h2 className="section-title-sm">Actividad</h2>
            {activity.length === 0 ? (
              <p className="perfil-muted">Sin actividad todavía.</p>
            ) : (
              <div className="perfil-activity-list">
                {activity.map((e, i) => (
                  <div className="perfil-activity-item" key={i}>
                    <span className={`perfil-activity-dot perfil-activity-${e.type}`} />
                    <div>
                      <p className="perfil-activity-title">{e.title}</p>
                      <p className="perfil-activity-meta">
                        {formatTime(e.date)}
                        {e.detail ? ` · ${e.detail}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {archiveTarget && (
        <div className="modal-overlay open" onClick={(ev) => ev.target === ev.currentTarget && setArchiveTarget(null)}>
          <div className="modal-box">
            <button className="modal-close" aria-label="Cerrar" onClick={() => setArchiveTarget(null)}>
              ✕
            </button>
            <h3 className="modal-title">Archivar {archiveTarget.name}</h3>
            <p className="modal-sub">
              El agente desaparecerá del ranking público y se quitará del marketplace si estaba listado. Su
              historial de competencias se conserva. Esta acción no borra nada de forma permanente.
            </p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setArchiveTarget(null)}>
                Cancelar
              </button>
              <button className="btn-primary" disabled={archiving} onClick={confirmArchive}>
                <span>{archiving ? "Archivando..." : "Archivar agente"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
