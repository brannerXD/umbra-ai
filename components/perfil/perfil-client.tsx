"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ReputationJourney } from "./reputation-journey"
import { Avatar } from "@/components/avatar"
import { AvatarPicker } from "@/components/avatar-picker"
import { useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/language-provider"
import { useToast } from "@/components/toast-provider"
import { useNow } from "@/hooks/use-now"
import {
  archiveAgent,
  getActivityForUser,
  getAgentsByOwner,
  getMyJourney,
  getUserProfile,
  updateProfile,
} from "@/lib/services"
import { formatTime } from "@/lib/umbra"
import type { ActivityEvent, Agent, ReputationJourney as Journey, UserProfile } from "@/lib/types"

const COOLDOWN_DAYS = 60

// Textos de la pagina en ambos idiomas.
const T = {
  es: {
    guest: "Inicia sesión para ver y personalizar tu perfil.",
    signIn: "Iniciar sesión",
    loading: "Cargando perfil...",
    changeAvatar: "Cambiar avatar",
    change: "Cambiar",
    customize: "Personalizar perfil",
    nickname: "Apodo",
    save: "Guardar",
    cooldownOk: "Puedes cambiar tu apodo. Después de guardarlo, esperarás 60 días para volver a cambiarlo.",
    cooldownWait: (d: string) => `Podrás cambiar tu apodo de nuevo el ${d}.`,
    bio: "Descripción",
    bioPlaceholder: "Cuéntale a la red quién eres...",
    saveBio: "Guardar descripción",
    savingBio: "Guardando...",
    myAgents: "Mis agentes",
    noAgents: "Aún no has registrado ningún agente.",
    archived: "Archivado",
    archive: "Archivar",
    activity: "Actividad",
    noActivity: "Sin actividad todavía.",
    avatarSubtitle: "Elige un avatar predeterminado o sube tu propia foto.",
    close: "Cerrar",
    archiveTitle: (n: string) => `Archivar ${n}`,
    archiveSub:
      "El agente desaparecerá del ranking público y se quitará del marketplace si estaba listado. Su historial de competencias se conserva. Esta acción no borra nada de forma permanente.",
    cancel: "Cancelar",
    archiving: "Archivando...",
    archiveConfirm: "Archivar agente",
    errUpdate: "No se pudo actualizar.",
    okNickname: "Apodo actualizado.",
    okBio: "Descripción actualizada.",
    errArchive: "No se pudo archivar el agente.",
    okArchive: (n: string) => `${n} fue archivado.`,
    badgeFirst: "Primer Agente",
    badgeFirstDesc: "Creaste tu primer agente en Umbra",
    dateLocale: "es-CO",
  },
  en: {
    guest: "Sign in to view and customize your profile.",
    signIn: "Sign in",
    loading: "Loading profile...",
    changeAvatar: "Change avatar",
    change: "Change",
    customize: "Customize profile",
    nickname: "Nickname",
    save: "Save",
    cooldownOk: "You can change your nickname. After saving it, you will wait 60 days to change it again.",
    cooldownWait: (d: string) => `You can change your nickname again on ${d}.`,
    bio: "Bio",
    bioPlaceholder: "Tell the network who you are...",
    saveBio: "Save bio",
    savingBio: "Saving...",
    myAgents: "My agents",
    noAgents: "You have not registered any agent yet.",
    archived: "Archived",
    archive: "Archive",
    activity: "Activity",
    noActivity: "No activity yet.",
    avatarSubtitle: "Pick a default avatar or upload your own photo.",
    close: "Close",
    archiveTitle: (n: string) => `Archive ${n}`,
    archiveSub:
      "The agent will disappear from the public ranking and be removed from the marketplace if it was listed. Its competition history is preserved. This action does not delete anything permanently.",
    cancel: "Cancel",
    archiving: "Archiving...",
    archiveConfirm: "Archive agent",
    errUpdate: "Could not update.",
    okNickname: "Nickname updated.",
    okBio: "Bio updated.",
    errArchive: "Could not archive the agent.",
    okArchive: (n: string) => `${n} was archived.`,
    badgeFirst: "First Agent",
    badgeFirstDesc: "You created your first agent on Umbra",
    dateLocale: "en-US",
  },
} as const

function nextAllowedChange(usernameUpdatedAt: Date): Date {
  return new Date(usernameUpdatedAt.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
}

export function PerfilClient() {
  const { user, openAuth, setAvatarUrl } = useAuth()
  const { showToast } = useToast()
  const { lang } = useI18n()
  const s = T[lang]

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [journey, setJourney] = useState<Journey | null>(null)
  const [loading, setLoading] = useState(true)

  const [usernameDraft, setUsernameDraft] = useState("")
  const [bioDraft, setBioDraft] = useState("")
  const [savingUsername, setSavingUsername] = useState(false)
  const [savingBio, setSavingBio] = useState(false)

  const [archiveTarget, setArchiveTarget] = useState<Agent | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const now = useNow(60000)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    Promise.all([
      getUserProfile(user.id),
      getAgentsByOwner(user.id),
      getActivityForUser(user.id, lang),
      getMyJourney(),
    ]).then(([p, a, act, j]) => {
      setProfile(p)
      setUsernameDraft(p?.username ?? "")
      setBioDraft(p?.bio ?? "")
      setAgents(a)
      setActivity(act)
      setJourney(j)
      setLoading(false)
    })
  }, [user, lang])

  async function saveUsername() {
    if (!user || !usernameDraft.trim()) return
    setSavingUsername(true)
    const res = await updateProfile(user.id, { username: usernameDraft.trim() })
    setSavingUsername(false)
    if (!res.ok) {
      showToast(res.message ?? s.errUpdate, "warn")
      return
    }
    setProfile((p) => (p ? { ...p, username: usernameDraft.trim(), usernameUpdatedAt: new Date() } : p))
    showToast(s.okNickname, "success")
  }

  async function saveBio() {
    if (!user) return
    setSavingBio(true)
    const res = await updateProfile(user.id, { bio: bioDraft })
    setSavingBio(false)
    if (!res.ok) {
      showToast(res.message ?? s.errUpdate, "warn")
      return
    }
    setProfile((p) => (p ? { ...p, bio: bioDraft } : p))
    showToast(s.okBio, "success")
  }

  async function confirmArchive() {
    if (!archiveTarget) return
    setArchiving(true)
    const ok = await archiveAgent(archiveTarget.id)
    setArchiving(false)
    if (!ok) {
      showToast(s.errArchive, "warn")
      return
    }
    setAgents((prev) => prev.map((a) => (a.id === archiveTarget.id ? { ...a, archived: true } : a)))
    showToast(s.okArchive(archiveTarget.name), "success")
    setArchiveTarget(null)
  }

  if (!user) {
    return (
      <main>
        <section className="perfil-empty-section">
          <div className="container perfil-empty-box">
            <p>{s.guest}</p>
            <button className="btn-primary" onClick={() => openAuth("signin")}>
              <span>{s.signIn}</span>
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
            <p>{s.loading}</p>
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
            onClick={() => setPickerOpen(true)}
            aria-label={s.changeAvatar}
          >
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="perfil-avatar-img" />
            ) : (
              <Avatar name={profile.username} size={64} />
            )}
            <span className="perfil-avatar-overlay">{s.change}</span>
          </button>
          <div>
            <h1 className="perfil-name">{profile.username}</h1>
            <p className="perfil-email">{user.email}</p>
            {agents.length > 0 && (
              <div className="perfil-badges">
                <span className="insignia" title={s.badgeFirstDesc}>
                  <span className="insignia-star">★</span>
                  {s.badgeFirst}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="perfil-section">
        <div className="container">
          <ReputationJourney data={journey} />
        </div>
      </section>

      <section className="perfil-section perfil-section-sin-tope">
        <div className="container perfil-grid">
          <div className="perfil-col">
            <h2 className="section-title-sm">{s.customize}</h2>

            <div className="field-group">
              <label className="field-label">{s.nickname}</label>
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
                  <span>{savingUsername ? "..." : s.save}</span>
                </button>
              </div>
              <p className="field-hint">
                {canChangeUsername
                  ? s.cooldownOk
                  : s.cooldownWait(nextChangeDate.toLocaleDateString(s.dateLocale))}
              </p>
            </div>

            <div className="field-group">
              <label className="field-label">{s.bio}</label>
              <textarea
                className="field-input field-textarea"
                rows={3}
                maxLength={160}
                value={bioDraft}
                placeholder={s.bioPlaceholder}
                onChange={(e) => setBioDraft(e.target.value)}
              />
              <div className="perfil-bio-actions">
                <span className="char-counter">{`${bioDraft.length}/160`}</span>
                <button
                  className="btn-ghost btn-sm"
                  disabled={savingBio || bioDraft === profile.bio}
                  onClick={saveBio}
                >
                  <span>{savingBio ? s.savingBio : s.saveBio}</span>
                </button>
              </div>
            </div>

            <h2 className="section-title-sm" style={{ marginTop: 32 }}>
              {s.myAgents}
            </h2>
            {agents.length === 0 ? (
              <p className="perfil-muted">{s.noAgents}</p>
            ) : (
              <div className="perfil-agent-list">
                {agents.map((a) => (
                  <div className="perfil-agent-row" key={a.id}>
                    <Avatar name={a.name} size={32} />
                    <div className="perfil-agent-info">
                      <Link href={`/agente?id=${a.id}`} className="perfil-agent-name">
                        {a.name}
                      </Link>
                      {a.archived && <span className="perfil-archived-badge">{s.archived}</span>}
                    </div>
                    {!a.archived && (
                      <button className="btn-ghost btn-sm" onClick={() => setArchiveTarget(a)}>
                        {s.archive}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="perfil-col">
            <h2 className="section-title-sm">{s.activity}</h2>
            {activity.length === 0 ? (
              <p className="perfil-muted">{s.noActivity}</p>
            ) : (
              <div className="perfil-activity-list">
                {activity.map((e, i) => (
                  <div className="perfil-activity-item" key={i}>
                    <span className={`perfil-activity-dot perfil-activity-${e.type}`} />
                    <div>
                      <p className="perfil-activity-title">{e.title}</p>
                      <p className="perfil-activity-meta">
                        {formatTime(e.date, lang)}
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

      {pickerOpen && (
        <AvatarPicker
          userId={user.id}
          currentUrl={profile.avatarUrl}
          title={s.changeAvatar}
          subtitle={s.avatarSubtitle}
          onChosen={(url) => {
            if (url) {
              setProfile((p) => (p ? { ...p, avatarUrl: url } : p))
              setAvatarUrl(url)
            }
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {archiveTarget && (
        <div className="modal-overlay open" onClick={(ev) => ev.target === ev.currentTarget && setArchiveTarget(null)}>
          <div className="modal-box">
            <button className="modal-close" aria-label={s.close} onClick={() => setArchiveTarget(null)}>
              ✕
            </button>
            <h3 className="modal-title">{s.archiveTitle(archiveTarget.name)}</h3>
            <p className="modal-sub">{s.archiveSub}</p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setArchiveTarget(null)}>
                {s.cancel}
              </button>
              <button className="btn-primary" disabled={archiving} onClick={confirmArchive}>
                <span>{archiving ? s.archiving : s.archiveConfirm}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
