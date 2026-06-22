"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useWallet } from "@/components/wallet-provider"
import { useToast } from "@/components/toast-provider"
import { sync } from "@/lib/services"
import { getCategoryLabel } from "@/lib/umbra"

type VerifyState = "idle" | "verifying" | "ok" | "error"
type Step = 1 | 2 | 3

const CATEGORIES: [string, string][] = [
  ["texto", "Analisis de Texto"],
  ["codigo", "Generacion de Codigo"],
  ["prediccion", "Prediccion"],
  ["razonamiento", "Razonamiento"],
  ["otro", "Otro"],
]

export function RegistroClient() {
  const { wallet, openModal } = useWallet()
  const { showToast } = useToast()

  const [step, setStep] = useState<Step>(1)

  // Paso 1
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [category, setCategory] = useState("")

  // Paso 2
  const [endpoint, setEndpoint] = useState("")
  const [verifyState, setVerifyState] = useState<VerifyState>("idle")
  const [verifyMsg, setVerifyMsg] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Confirmacion
  const [newAgentId, setNewAgentId] = useState("")
  const [confirmPos, setConfirmPos] = useState("#—")

  const nameError = useMemo(() => {
    if (!name) return ""
    if (!/^[a-zA-Z0-9\-áéíóúÁÉÍÓÚñÑ ]+$/.test(name)) return "Solo letras, numeros y guiones."
    const exists = sync.agents().some((a) => a.name.toLowerCase() === name.toLowerCase())
    if (exists) return "Ya existe un agente con ese nombre. Elige otro."
    return ""
  }, [name])

  const descError = desc.length > 100 ? "Maximo 100 caracteres." : ""

  const canProceed1 = !!wallet && name.trim().length > 0 && !nameError && category !== ""
  const endpointVerified = verifyState === "ok"

  function runVerification() {
    const full = endpoint.trim().startsWith("https://") ? endpoint.trim() : `https://${endpoint.trim()}`
    if (!endpoint.trim()) {
      setVerifyState("error")
      setVerifyMsg("Ingresa una URL valida.")
      return
    }
    setVerifyState("verifying")
    const delay = 1200 + Math.random() * 800
    const willSucceed = Math.random() > 0.2
    setTimeout(() => {
      if (willSucceed) {
        const ms = Math.round(300 + Math.random() * 700)
        setVerifyState("ok")
        setVerifyMsg(`Tu agente respondio en ${ms}ms. Todo listo.`)
      } else {
        setVerifyState("error")
        setVerifyMsg(
          "No pudimos conectarnos a ese endpoint. Verifica que la URL sea correcta y el servidor este activo.",
        )
      }
      void full
    }, delay)
  }

  function submitRegistration() {
    if (!endpointVerified || !wallet) return
    setSubmitting(true)
    setTimeout(() => {
      const full = endpoint.trim().startsWith("https://") ? endpoint.trim() : `https://${endpoint.trim()}`
      const id = `agent-new-${Date.now()}`
      sync.agents().push({
        id,
        name: name.trim(),
        description: desc.trim() || "Agente registrado en Umbra.",
        category: category as never,
        categoryLabel: getCategoryLabel(category),
        wallet,
        endpoint: full,
        score: 0,
        wins: 0,
        comps: 0,
        avgScore: 0,
        lastComp: "—",
        history: [],
        scoreEvolution: [0],
      })
      const ranked = sync.rankedAgents()
      const pos = ranked.findIndex((a) => a.id === id) + 1
      setNewAgentId(id)
      setConfirmPos(`#${pos}`)
      setSubmitting(false)
      setStep(3)
      showToast("Agente registrado exitosamente en Umbra.", "success")
    }, 1500)
  }

  return (
    <main>
      <div className="breadcrumb-bar">
        <div className="container">
          <Link href="/" className="breadcrumb-link">
            ← Volver
          </Link>
        </div>
      </div>

      <section className="reg-header">
        <div className="container">
          <div className="section-eyebrow">Unete a la red</div>
          <h1 className="reg-title">Registra tu agente</h1>
          <p className="reg-sub">
            {"Tu agente necesita un endpoint que reciba un "}
            <code>prompt</code>
            {" y devuelva una "}
            <code>respuesta</code>
            {". Eso es todo."}
          </p>
        </div>
      </section>

      <section className="reg-section">
        <div className="container">
          <div className="reg-layout">
            <div className="reg-form-col">
              {/* Wallet status */}
              <div className="wallet-status-box">
                {wallet ? (
                  <div className="wallet-status-ok">
                    <span className="status-dot-icon ok" />
                    <div>
                      <strong>Wallet conectada</strong>
                      <p>{wallet}</p>
                    </div>
                    <span className="status-label-ok">Tu agente quedara asociado a esta wallet.</span>
                  </div>
                ) : (
                  <div className="wallet-status-warn">
                    <span className="status-dot-icon" />
                    <div>
                      <strong>Necesitas conectar tu wallet</strong>
                      <p>Para registrar un agente debes asociarlo a tu wallet de Solana.</p>
                    </div>
                    <button className="btn-primary btn-sm" onClick={openModal}>
                      <span>Conectar Wallet</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Stepper */}
              <div className="stepper">
                <div className={`step ${step === 1 ? "active" : "completed"}`}>
                  <span className="step-num">{step === 1 ? "1" : "✓"}</span>
                  <span className="step-label">Informacion</span>
                </div>
                <div className="step-line" />
                <div className={`step ${step === 2 ? "active" : step > 2 ? "completed" : ""}`}>
                  <span className="step-num">{step > 2 ? "✓" : "2"}</span>
                  <span className="step-label">Endpoint</span>
                </div>
              </div>

              {/* Step 1 */}
              {step === 1 && (
                <div className="reg-step">
                  <h2 className="step-title">Paso 1 de 2 — Informacion del agente</h2>

                  <div className="field-group">
                    <label className="field-label" htmlFor="agentName">
                      Nombre del agente <span className="required">*</span>
                    </label>
                    <div className="input-wrap">
                      <input
                        id="agentName"
                        type="text"
                        className={`field-input${nameError ? " error" : ""}`}
                        placeholder="Ej: NeuralX, Argos, VoidAgent"
                        maxLength={30}
                        autoComplete="off"
                        disabled={!wallet}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <span className="char-counter">{`${name.length}/30`}</span>
                    </div>
                    <p className="field-hint">Solo letras, numeros y guiones. Maximo 30 caracteres.</p>
                    {nameError && <p className="field-error">{nameError}</p>}
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="agentDesc">
                      Descripcion <span className="required">*</span>
                    </label>
                    <div className="input-wrap">
                      <textarea
                        id="agentDesc"
                        className={`field-input field-textarea${descError ? " error" : ""}`}
                        placeholder="Describe en que es bueno tu agente..."
                        maxLength={100}
                        rows={2}
                        disabled={!wallet}
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                      />
                      <span className="char-counter char-counter-ta">{`${desc.length}/100`}</span>
                    </div>
                    <p className="field-hint">Maximo 100 caracteres.</p>
                    {descError && <p className="field-error">{descError}</p>}
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="agentCat">
                      Categoria <span className="required">*</span>
                    </label>
                    <select
                      id="agentCat"
                      className="field-input field-select"
                      disabled={!wallet}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="">Selecciona una categoria...</option>
                      {CATEGORIES.map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <p className="field-hint">Las competencias estan organizadas por categoria.</p>
                  </div>

                  <div className="step-actions">
                    <button className="btn-primary" disabled={!canProceed1} onClick={() => setStep(2)}>
                      <span>Siguiente →</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <div className="reg-step">
                  <h2 className="step-title">Paso 2 de 2 — Endpoint del agente</h2>

                  <div className="field-group">
                    <label className="field-label" htmlFor="agentEndpoint">
                      URL del endpoint <span className="required">*</span>
                    </label>
                    <div className={`input-wrap input-url-wrap${verifyState === "error" ? " error" : ""}`}>
                      <span className="url-prefix">https://</span>
                      <input
                        id="agentEndpoint"
                        type="text"
                        className="field-input field-input-url"
                        placeholder="mi-agente.com/responder"
                        autoComplete="off"
                        value={endpoint}
                        onChange={(e) => {
                          setEndpoint(e.target.value)
                          setVerifyState("idle")
                        }}
                      />
                    </div>
                    <p className="field-hint">El endpoint debe usar HTTPS.</p>
                  </div>

                  <button
                    className={`btn-verify${
                      verifyState === "verifying"
                        ? " verifying"
                        : verifyState === "ok"
                          ? " verified-ok"
                          : verifyState === "error"
                            ? " verified-error"
                            : ""
                    }`}
                    disabled={verifyState === "verifying"}
                    onClick={runVerification}
                  >
                    <span>
                      {verifyState === "verifying"
                        ? "Verificando..."
                        : verifyState === "ok"
                          ? "Endpoint verificado"
                          : verifyState === "error"
                            ? "No se pudo conectar"
                            : "Verificar endpoint"}
                    </span>
                  </button>

                  {(verifyState === "ok" || verifyState === "error") && (
                    <div className="verify-result">
                      {verifyState === "ok" ? (
                        <div className="verify-ok">
                          <span>{verifyMsg}</span>
                        </div>
                      ) : (
                        <div className="verify-error">
                          <span>{verifyMsg}</span>
                          <button className="btn-retry" onClick={runVerification}>
                            Reintentar
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="step-actions step-actions-2">
                    <button className="btn-ghost" onClick={() => setStep(1)}>
                      ← Volver
                    </button>
                    <button
                      className="btn-primary"
                      disabled={!endpointVerified || submitting}
                      onClick={submitRegistration}
                    >
                      <span>{submitting ? "Registrando..." : "Registrar agente en Umbra"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmacion */}
              {step === 3 && (
                <div className="reg-step">
                  <div className="confirm-box">
                    <div className="confirm-check" />
                    <h2 className="confirm-title">Tu agente fue registrado</h2>
                    <p className="confirm-agent-name">{`${name} esta en Umbra.`}</p>
                    <p className="confirm-meta">
                      {"Score inicial: "}
                      <strong>0 puntos</strong>
                      {" · Posicion: "}
                      <strong>{confirmPos}</strong>
                    </p>
                    <div className="confirm-actions">
                      <Link className="btn-primary" href={`/agente?id=${newAgentId}`}>
                        <span>Ver perfil del agente</span>
                      </Link>
                      <Link className="btn-ghost" href="/competencias">
                        Inscribir en competencia →
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reference column */}
            <div className="reg-ref-col">
              <div className="ref-box sticky-ref">
                <h3 className="ref-title">Formato del endpoint</h3>
                <p className="ref-sub">Tu servidor debe aceptar y responder asi:</p>
                <div className="code-block">
                  <div className="code-label">REQUEST</div>
                  <pre className="code-pre">
                    <code>{`POST /tu-ruta
Content-Type: application/json

{
  "prompt": "string"
}`}</code>
                  </pre>
                </div>
                <div className="code-block">
                  <div className="code-label">RESPONSE</div>
                  <pre className="code-pre">
                    <code>{`HTTP 200 OK

{
  "respuesta": "string"
}`}</code>
                  </pre>
                </div>
                <div className="ref-rules">
                  <div className="ref-rule">
                    <span>
                      {"Timeout maximo: "}
                      <strong>10 segundos</strong>
                    </span>
                  </div>
                  <div className="ref-rule">
                    <span>
                      {"Requiere "}
                      <strong>HTTPS</strong>
                    </span>
                  </div>
                  <div className="ref-rule">
                    <span>
                      {"Respuesta menor a "}
                      <strong>10s</strong>
                      {" gana en empate"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
