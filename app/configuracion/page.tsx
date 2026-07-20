"use client"

import "./configuracion.css"
import Link from "next/link"
import { Check, ChevronRight, Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { useI18n } from "@/components/language-provider"
import { useTheme } from "@/components/theme-provider"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { LANGS } from "@/lib/i18n"

const APP_VERSION = "0.1.0"

export default function ConfiguracionPage() {
  const { t, lang, setLang } = useI18n()
  const { theme, toggleTheme } = useTheme()
  const { user, openAuth, signOut, resetPassword } = useAuth()
  const { showToast } = useToast()

  // Preferencias de notificaciones (se guardan en el navegador).
  const [notifResults, setNotifResults] = useState(true)
  const [notifNews, setNotifNews] = useState(true)
  const [sendingReset, setSendingReset] = useState(false)

  useEffect(() => {
    document.title = `${t("settings.title")} — Umbra`
  }, [t])

  useEffect(() => {
    try {
      setNotifResults(localStorage.getItem("umbra_notif_results") !== "0")
      setNotifNews(localStorage.getItem("umbra_notif_news") !== "0")
    } catch {
      /* almacenamiento no disponible */
    }
  }, [])

  const persistNotif = (key: string, value: boolean) => {
    try {
      localStorage.setItem(key, value ? "1" : "0")
    } catch {
      /* almacenamiento no disponible */
    }
    showToast(t("settings.toast.saved"), "info")
  }

  const handleChangeLang = (code: typeof lang) => {
    if (code === lang) return
    setLang(code)
    showToast(t("settings.toast.language"), "success")
  }

  const setThemeTo = (target: "dark" | "light") => {
    if (theme !== target) toggleTheme()
  }

  const handleChangePassword = async () => {
    if (!user?.email) return
    setSendingReset(true)
    const res = await resetPassword(user.email)
    setSendingReset(false)
    showToast(
      res.ok ? t("settings.toast.resetSent") : t("settings.toast.resetError"),
      res.ok ? "success" : "error",
    )
  }

  return (
    <div className="settings">
      <div className="container settings-inner">
        <header className="settings-head">
          <p className="settings-kicker">Umbra</p>
          <h1 className="settings-title">{t("settings.title")}</h1>
          <p className="settings-subtitle">{t("settings.subtitle")}</p>
        </header>

        {/* ————— Idioma ————— */}
        <section className="settings-section">
          <div className="settings-section-head">
            <h2>{t("settings.language.title")}</h2>
            <p className="settings-section-desc">{t("settings.language.desc")}</p>
          </div>
          <div className="settings-options">
            {LANGS.map((l) => (
              <button
                key={l.code}
                className={`settings-option ${lang === l.code ? "selected" : ""}`}
                onClick={() => handleChangeLang(l.code)}
                aria-pressed={lang === l.code}
              >
                <span className="settings-option-flag">{l.flag}</span>
                <span className="settings-option-label">{l.label}</span>
                <span className="settings-option-check">
                  <Check aria-hidden />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ————— Apariencia ————— */}
        <section className="settings-section">
          <div className="settings-section-head">
            <h2>{t("settings.appearance.title")}</h2>
            <p className="settings-section-desc">{t("settings.appearance.desc")}</p>
          </div>
          <div className="settings-segment">
            <button
              className={theme === "dark" ? "active" : ""}
              onClick={() => setThemeTo("dark")}
              aria-pressed={theme === "dark"}
            >
              <Moon aria-hidden />
              {t("settings.appearance.dark")}
            </button>
            <button
              className={theme === "light" ? "active" : ""}
              onClick={() => setThemeTo("light")}
              aria-pressed={theme === "light"}
            >
              <Sun aria-hidden />
              {t("settings.appearance.light")}
            </button>
          </div>
        </section>

        {/* ————— Notificaciones ————— */}
        <section className="settings-section">
          <div className="settings-section-head">
            <h2>{t("settings.notifications.title")}</h2>
            <p className="settings-section-desc">{t("settings.notifications.desc")}</p>
          </div>
          <div className="settings-row">
            <div className="settings-row-text">
              <div className="settings-row-label">{t("settings.notifications.results")}</div>
              <div className="settings-row-desc">{t("settings.notifications.resultsDesc")}</div>
            </div>
            <button
              className={`settings-switch ${notifResults ? "on" : ""}`}
              role="switch"
              aria-checked={notifResults}
              aria-label={t("settings.notifications.results")}
              onClick={() => {
                const v = !notifResults
                setNotifResults(v)
                persistNotif("umbra_notif_results", v)
              }}
            />
          </div>
          <div className="settings-row">
            <div className="settings-row-text">
              <div className="settings-row-label">{t("settings.notifications.news")}</div>
              <div className="settings-row-desc">{t("settings.notifications.newsDesc")}</div>
            </div>
            <button
              className={`settings-switch ${notifNews ? "on" : ""}`}
              role="switch"
              aria-checked={notifNews}
              aria-label={t("settings.notifications.news")}
              onClick={() => {
                const v = !notifNews
                setNotifNews(v)
                persistNotif("umbra_notif_news", v)
              }}
            />
          </div>
        </section>

        {/* ————— Cuenta ————— */}
        <section className="settings-section">
          <div className="settings-section-head">
            <h2>{t("settings.account.title")}</h2>
            <p className="settings-section-desc">{t("settings.account.desc")}</p>
          </div>
          {user ? (
            <>
              {user.email && (
                <div className="settings-account-email">
                  <span>{t("settings.account.email")}</span>
                  <span>{user.email}</span>
                </div>
              )}
              {user.email && (
                <div className="settings-change-pass">
                  <button className="btn-ghost btn-sm" onClick={handleChangePassword} disabled={sendingReset}>
                    {t("settings.account.changePassword")}
                  </button>
                  <p className="settings-change-pass-desc">{t("settings.account.changePasswordDesc")}</p>
                </div>
              )}
              <div className="settings-actions">
                <Link href="/perfil" className="btn-primary btn-sm">
                  <span>{t("settings.account.editProfile")}</span>
                </Link>
                <button className="btn-ghost btn-sm" onClick={signOut}>
                  {t("settings.account.signout")}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="settings-guest">{t("settings.account.guest")}</p>
              <button className="btn-primary btn-sm" onClick={() => openAuth("signin")}>
                <span>{t("settings.account.signin")}</span>
              </button>
            </>
          )}
        </section>

        {/* ————— Acerca de ————— */}
        <section className="settings-section">
          <div className="settings-section-head">
            <h2>{t("settings.about.title")}</h2>
            <p className="settings-section-desc">{t("settings.about.desc")}</p>
          </div>
          <div className="settings-about-links">
            <div className="settings-version">
              <span>{t("settings.about.version")}</span>
              <span>v{APP_VERSION}</span>
            </div>
            <Link href="/docs">
              {t("settings.about.docs")}
              <ChevronRight aria-hidden />
            </Link>
            <Link href="/terminos">
              {t("settings.about.terms")}
              <ChevronRight aria-hidden />
            </Link>
            <Link href="/privacidad">
              {t("settings.about.privacy")}
              <ChevronRight aria-hidden />
            </Link>
          </div>
        </section>

        <footer className="settings-foot">
          <Link href="/">← {t("settings.back")}</Link>
        </footer>
      </div>
    </div>
  )
}
