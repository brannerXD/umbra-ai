"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { useI18n } from "@/components/language-provider"
import { registerAgent, getRankedAgents } from "@/lib/services"
import { supabase } from "@/lib/supabase"

type VerifyState = "idle" | "verifying" | "ok" | "error"
type Step = 1 | 2 | 3
// Qué va a hacer el agente: competir (necesita endpoint) o venderse como código.
type Mode = "competir" | "codigo"

const CAT_KEYS = ["texto", "codigo", "prediccion", "razonamiento", "otro"] as const

// Textos de la pagina en ambos idiomas.
const T = {
  es: {
    eyebrow: "Unete a la red",
    title: "Registra tu agente",
    subCode: "Vas a vender el código de tu agente. No necesitas ninguna URL: solo su información y, al final, el archivo .zip.",
    subA: "Tu agente necesita un endpoint que reciba un ",
    subB: " y devuelva una ",
    subC: ". Eso es todo.",
    promptWord: "prompt",
    responseWord: "respuesta",
    signedIn: "Sesión iniciada",
    linkedNote: "Tu agente quedará asociado a esta cuenta.",
    needSignIn: "Necesitas iniciar sesión",
    needSignInSub: "Para registrar un agente debes iniciar sesión.",
    signInBtn: "Iniciar sesión",
    stepInfo: "Informacion",
    stepEndpoint: "Endpoint",
    step1TitleCode: "Informacion del agente",
    step1Title: "Paso 1 de 2 — Informacion del agente",
    modeQ: "¿Qué vas a hacer con este agente?",
    modeCompete: "Competir",
    modeCompeteDesc: "Necesita un endpoint (URL)",
    modeCode: "Vender el código",
    modeCodeDesc: "Sin URL — Agente Completo",
    modeHintCode: "No pediremos URL. Al terminar podrás subir el .zip y publicarlo en el marketplace.",
    modeHintCompete: "Tu agente competirá y construirá reputación. Podrás venderlo después.",
    nameLabel: "Nombre del agente",
    namePh: "Ej: NeuralX, Argos, VoidAgent",
    nameHint: "Solo letras, numeros y guiones. Maximo 30 caracteres.",
    descLabel: "Descripcion",
    descPh: "Describe en que es bueno tu agente...",
    descHint: "Maximo 100 caracteres.",
    catLabel: "Categoria",
    catPh: "Selecciona una categoria...",
    catHint: "Las competencias estan organizadas por categoria.",
    cats: { texto: "Analisis de Texto", codigo: "Generacion de Codigo", prediccion: "Prediccion", razonamiento: "Razonamiento", otro: "Otro" },
    next: "Siguiente →",
    creating: "Creando...",
    createCode: "Crear y publicar código →",
    step2Title: "Paso 2 de 2 — Endpoint del agente",
    urlLabel: "URL del endpoint",
    urlPh: "mi-agente.com/responder",
    urlHint: "El endpoint debe usar HTTPS.",
    verifying: "Verificando...",
    verifiedOk: "Endpoint verificado",
    verifyFail: "No se pudo conectar",
    verifyBtn: "Verificar endpoint",
    retry: "Reintentar",
    back: "← Volver",
    registering: "Registrando...",
    registerBtn: "Registrar agente en Umbra",
    doneTitle: "Tu agente fue registrado",
    doneIsIn: " esta en Umbra.",
    doneScore: "Score inicial: ",
    donePts: "0 puntos",
    donePos: " · Posicion: ",
    doneProfile: "Ver perfil del agente",
    doneEnroll: "Inscribir en competencia →",
    errChars: "Solo letras, numeros y guiones.",
    errTaken: "Ya existe un agente con ese nombre. Elige otro.",
    errMax: "Maximo 100 caracteres.",
    errUrl: "Ingresa una URL valida.",
    errConn: "No pudimos conectarnos a ese endpoint. Verifica que la URL sea correcta y el servidor este activo.",
    verifiedMsgA: "Tu agente respondio en ",
    verifiedMsgB: "ms. Todo listo.",
    defaultDesc: "Agente registrado en Umbra.",
    defaultDescCode: "Agente disponible como código en el marketplace.",
    toastFail: "No se pudo registrar el agente. Intenta de nuevo.",
    toastOk: "Agente registrado exitosamente en Umbra.",
    toastCreated: "Agente creado. Ahora publica su código.",
    refTitle: "Cómo construir un buen agente",
    refSub: "Framework de 4 pasos antes de codear (Norvik):",
    r1t: "Problema",
    r1b: "Define con precisión qué resuelve tu agente. No \u0022quiero un agente que responda preguntas\u0022 — sé específico.",
    r2t: "Decisión",
    r2b: "La regla clara que tu agente usa para decidir qué hacer con cada entrada.",
    r3t: "Acción",
    r3b: "Qué hace una vez decide — la respuesta concreta que entrega.",
    r4t: "Resultado",
    r4b: "Cómo sabrás si funcionó, para poder mejorarlo con el tiempo.",
    fmtTitle: "Formato del endpoint",
    fmtSub: "Tu servidor debe aceptar y responder asi:",
    ruleTimeoutA: "Timeout maximo: ",
    ruleTimeoutB: "10 segundos",
    ruleHttpsA: "Requiere ",
    ruleHttpsB: "HTTPS",
    ruleTieA: "Respuesta menor a ",
    ruleTieB: "10s",
    ruleTieC: " gana en empate",
    backTop: "← Volver",
  },
  en: {
    eyebrow: "Join the network",
    title: "Register your agent",
    subCode: "You are going to sell your agent code. You do not need any URL: just its information and, at the end, the .zip file.",
    subA: "Your agent needs an endpoint that receives a ",
    subB: " and returns a ",
    subC: ". That is all.",
    promptWord: "prompt",
    responseWord: "response",
    signedIn: "Signed in",
    linkedNote: "Your agent will be linked to this account.",
    needSignIn: "You need to sign in",
    needSignInSub: "To register an agent you must sign in.",
    signInBtn: "Sign in",
    stepInfo: "Information",
    stepEndpoint: "Endpoint",
    step1TitleCode: "Agent information",
    step1Title: "Step 1 of 2 — Agent information",
    modeQ: "What are you going to do with this agent?",
    modeCompete: "Compete",
    modeCompeteDesc: "Needs an endpoint (URL)",
    modeCode: "Sell the code",
    modeCodeDesc: "No URL — Complete Agent",
    modeHintCode: "We will not ask for a URL. When you finish you can upload the .zip and publish it on the marketplace.",
    modeHintCompete: "Your agent will compete and build reputation. You can sell it later.",
    nameLabel: "Agent name",
    namePh: "e.g. NeuralX, Argos, VoidAgent",
    nameHint: "Letters, numbers and hyphens only. Maximum 30 characters.",
    descLabel: "Description",
    descPh: "Describe what your agent is good at...",
    descHint: "Maximum 100 characters.",
    catLabel: "Category",
    catPh: "Select a category...",
    catHint: "Competitions are organized by category.",
    cats: { texto: "Text Analysis", codigo: "Code Generation", prediccion: "Prediction", razonamiento: "Reasoning", otro: "Other" },
    next: "Next →",
    creating: "Creating...",
    createCode: "Create and publish code →",
    step2Title: "Step 2 of 2 — Agent endpoint",
    urlLabel: "Endpoint URL",
    urlPh: "my-agent.com/respond",
    urlHint: "The endpoint must use HTTPS.",
    verifying: "Verifying...",
    verifiedOk: "Endpoint verified",
    verifyFail: "Could not connect",
    verifyBtn: "Verify endpoint",
    retry: "Retry",
    back: "← Back",
    registering: "Registering...",
    registerBtn: "Register agent on Umbra",
    doneTitle: "Your agent was registered",
    doneIsIn: " is on Umbra.",
    doneScore: "Starting score: ",
    donePts: "0 points",
    donePos: " · Position: ",
    doneProfile: "View agent profile",
    doneEnroll: "Enter a competition →",
    errChars: "Letters, numbers and hyphens only.",
    errTaken: "An agent with that name already exists. Choose another.",
    errMax: "Maximum 100 characters.",
    errUrl: "Enter a valid URL.",
    errConn: "We could not connect to that endpoint. Check that the URL is correct and the server is running.",
    verifiedMsgA: "Your agent responded in ",
    verifiedMsgB: "ms. All set.",
    defaultDesc: "Agent registered on Umbra.",
    defaultDescCode: "Agent available as code on the marketplace.",
    toastFail: "Could not register the agent. Please try again.",
    toastOk: "Agent successfully registered on Umbra.",
    toastCreated: "Agent created. Now publish its code.",
    refTitle: "How to build a good agent",
    refSub: "A 4-step framework before you code (Norvik):",
    r1t: "Problem",
    r1b: "Define precisely what your agent solves. Not \u0022I want an agent that answers questions\u0022 — be specific.",
    r2t: "Decision",
    r2b: "The clear rule your agent uses to decide what to do with each input.",
    r3t: "Action",
    r3b: "What it does once it decides — the concrete answer it delivers.",
    r4t: "Result",
    r4b: "How you will know if it worked, so you can improve it over time.",
    fmtTitle: "Endpoint format",
    fmtSub: "Your server must accept and respond like this:",
    ruleTimeoutA: "Maximum timeout: ",
    ruleTimeoutB: "10 seconds",
    ruleHttpsA: "Requires ",
    ruleHttpsB: "HTTPS",
    ruleTieA: "A response under ",
    ruleTieB: "10s",
    ruleTieC: " wins a tie",
    backTop: "← Back",
  },
} as const


export function RegistroClient({ existingNames }: { existingNames: string[] }) {
  const { user, openAuth } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  const { lang } = useI18n()
  const s = T[lang]

  const [step, setStep] = useState<Step>(1)
  const [mode, setMode] = useState<Mode>("competir")

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
    if (!/^[a-zA-Z0-9\-áéíóúÁÉÍÓÚñÑ ]+$/.test(name)) return s.errChars
    const exists = existingNames.some((n) => n.toLowerCase() === name.toLowerCase())
    if (exists) return s.errTaken
    return ""
  }, [name, existingNames, s])

  const descError = desc.length > 100 ? s.errMax : ""

  const canProceed1 = !!user && name.trim().length > 0 && !nameError && category !== ""
  const endpointVerified = verifyState === "ok"

  async function runVerification() {
    const full = endpoint.trim().startsWith("https://") ? endpoint.trim() : `https://${endpoint.trim()}`
    if (!endpoint.trim()) {
      setVerifyState("error")
      setVerifyMsg(s.errUrl)
      return
    }
    setVerifyState("verifying")
    const { data, error } = await supabase.functions.invoke("verify-endpoint", {
      body: { endpoint: full },
    })
    if (error || !data?.ok) {
      setVerifyState("error")
      setVerifyMsg(
        data?.message ??
          s.errConn,
      )
      return
    }
    setVerifyState("ok")
    setVerifyMsg(`${s.verifiedMsgA}${data.ms}${s.verifiedMsgB}`)
  }

  async function submitRegistration() {
    if (!endpointVerified || !user) return
    setSubmitting(true)
    const full = endpoint.trim().startsWith("https://") ? endpoint.trim() : `https://${endpoint.trim()}`
    const created = await registerAgent({
      name: name.trim(),
      description: desc.trim() || s.defaultDesc,
      category: category as never,
      endpoint: full,
      ownerId: user.id,
    })
    setSubmitting(false)
    if (!created) {
      showToast(s.toastFail, "warn")
      return
    }
    const ranked = await getRankedAgents()
    const pos = ranked.findIndex((a) => a.id === created.id) + 1
    setNewAgentId(created.id)
    setConfirmPos(`#${pos}`)
    setStep(3)
    showToast(s.toastOk, "success")
  }

  // Registro sin endpoint, para agentes que solo se venden como código.
  async function submitCodeRegistration() {
    if (!user || !canProceed1) return
    setSubmitting(true)
    const created = await registerAgent({
      name: name.trim(),
      description: desc.trim() || s.defaultDescCode,
      category: category as never,
      ownerId: user.id,
      // sin endpoint: no compite, solo se vende
    })
    setSubmitting(false)
    if (!created) {
      showToast("No se pudo registrar el agente. Intenta de nuevo.", "warn")
      return
    }
    showToast(s.toastCreated, "success")
    // Lo llevamos directo a publicar el Agente Completo (el modal se abre solo).
    router.push(`/agente?id=${created.id}&vender=codigo`)
  }

  return (
    <main>
      <div className="breadcrumb-bar">
        <div className="container">
          <Link href="/app" className="breadcrumb-link">
            {s.backTop}
          </Link>
        </div>
      </div>

      <section className="reg-header">
        <div className="container">
          <div className="section-eyebrow">{s.eyebrow}</div>
          <h1 className="reg-title">{s.title}</h1>
          <p className="reg-sub">
            {mode === "codigo" ? (
              s.subCode
            ) : (
              <>
                {s.subA}
                <code>{s.promptWord}</code>
                {s.subB}
                <code>{s.responseWord}</code>
                {s.subC}
              </>
            )}
          </p>
        </div>
      </section>

      <section className="reg-section">
        <div className="container">
          <div className="reg-layout">
            <div className="reg-form-col">
              {/* Auth status */}
              <div className="wallet-status-box">
                {user ? (
                  <div className="wallet-status-ok">
                    <span className="status-dot-icon ok" />
                    <div>
                      <strong>{s.signedIn}</strong>
                      <p>{user.email}</p>
                    </div>
                    <span className="status-label-ok">{s.linkedNote}</span>
                  </div>
                ) : (
                  <div className="wallet-status-warn">
                    <span className="status-dot-icon" />
                    <div>
                      <strong>{s.needSignIn}</strong>
                      <p>{s.needSignInSub}</p>
                    </div>
                    <button className="btn-primary btn-sm" onClick={() => openAuth("signin")}>
                      <span>{s.signInBtn}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Stepper — el paso de endpoint solo aplica a agentes que compiten */}
              <div className="stepper">
                <div className={`step ${step === 1 ? "active" : "completed"}`}>
                  <span className="step-num">{step === 1 ? "1" : "✓"}</span>
                  <span className="step-label">{s.stepInfo}</span>
                </div>
                {mode === "competir" && (
                  <>
                    <div className="step-line" />
                    <div className={`step ${step === 2 ? "active" : step > 2 ? "completed" : ""}`}>
                      <span className="step-num">{step > 2 ? "✓" : "2"}</span>
                      <span className="step-label">{s.stepEndpoint}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Step 1 */}
              {step === 1 && (
                <div className="reg-step">
                  <h2 className="step-title">
                    {mode === "codigo" ? s.step1TitleCode : s.step1Title}
                  </h2>

                  <div className="field-group">
                    <label className="field-label">
                      {s.modeQ} <span className="required">*</span>
                    </label>
                    <div className="sell-type-toggle">
                      {/* Elegir modalidad no envía nada: se puede explorar sin sesión. */}
                      <button
                        type="button"
                        className={`sell-type-opt${mode === "competir" ? " active" : ""}`}
                        onClick={() => setMode("competir")}
                      >
                        <span className="sell-type-title">{s.modeCompete}</span>
                        <span className="sell-type-desc">{s.modeCompeteDesc}</span>
                      </button>
                      <button
                        type="button"
                        className={`sell-type-opt${mode === "codigo" ? " active" : ""}`}
                        onClick={() => setMode("codigo")}
                      >
                        <span className="sell-type-title">{s.modeCode}</span>
                        <span className="sell-type-desc">{s.modeCodeDesc}</span>
                      </button>
                    </div>
                    <p className="field-hint">
                      {mode === "codigo"
                        ? s.modeHintCode
                        : s.modeHintCompete}
                    </p>
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="agentName">
                      {s.nameLabel} <span className="required">*</span>
                    </label>
                    <div className="input-wrap">
                      <input
                        id="agentName"
                        type="text"
                        className={`field-input${nameError ? " error" : ""}`}
                        placeholder={s.namePh}
                        maxLength={30}
                        autoComplete="off"
                        disabled={!user}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <span className="char-counter">{`${name.length}/30`}</span>
                    </div>
                    <p className="field-hint">{s.nameHint}</p>
                    {nameError && <p className="field-error">{nameError}</p>}
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="agentDesc">
                      {s.descLabel} <span className="required">*</span>
                    </label>
                    <div className="input-wrap">
                      <textarea
                        id="agentDesc"
                        className={`field-input field-textarea${descError ? " error" : ""}`}
                        placeholder={s.descPh}
                        maxLength={100}
                        rows={2}
                        disabled={!user}
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                      />
                      <span className="char-counter char-counter-ta">{`${desc.length}/100`}</span>
                    </div>
                    <p className="field-hint">{s.descHint}</p>
                    {descError && <p className="field-error">{descError}</p>}
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="agentCat">
                      {s.catLabel} <span className="required">*</span>
                    </label>
                    <select
                      id="agentCat"
                      className="field-input field-select"
                      disabled={!user}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="">{s.catPh}</option>
                      {CAT_KEYS.map((val) => (
                        <option key={val} value={val}>
                          {s.cats[val]}
                        </option>
                      ))}
                    </select>
                    <p className="field-hint">{s.catHint}</p>
                  </div>

                  <div className="step-actions">
                    {mode === "codigo" ? (
                      <button
                        className="btn-primary"
                        disabled={!canProceed1 || submitting}
                        onClick={submitCodeRegistration}
                      >
                        <span>{submitting ? s.creating : s.createCode}</span>
                      </button>
                    ) : (
                      <button className="btn-primary" disabled={!canProceed1} onClick={() => setStep(2)}>
                        <span>{s.next}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <div className="reg-step">
                  <h2 className="step-title">{s.step2Title}</h2>

                  <div className="field-group">
                    <label className="field-label" htmlFor="agentEndpoint">
                      {s.urlLabel} <span className="required">*</span>
                    </label>
                    <div className={`input-wrap input-url-wrap${verifyState === "error" ? " error" : ""}`}>
                      <span className="url-prefix">https://</span>
                      <input
                        id="agentEndpoint"
                        type="text"
                        className="field-input field-input-url"
                        placeholder={s.urlPh}
                        autoComplete="off"
                        value={endpoint}
                        onChange={(e) => {
                          setEndpoint(e.target.value)
                          setVerifyState("idle")
                        }}
                      />
                    </div>
                    <p className="field-hint">{s.urlHint}</p>
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
                        ? s.verifying
                        : verifyState === "ok"
                          ? s.verifiedOk
                          : verifyState === "error"
                            ? s.verifyFail
                            : s.verifyBtn}
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
                            {s.retry}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="step-actions step-actions-2">
                    <button className="btn-ghost" onClick={() => setStep(1)}>
                      {s.back}
                    </button>
                    <button
                      className="btn-primary"
                      disabled={!endpointVerified || submitting}
                      onClick={submitRegistration}
                    >
                      <span>{submitting ? s.registering : s.registerBtn}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmacion */}
              {step === 3 && (
                <div className="reg-step">
                  <div className="confirm-box">
                    <div className="confirm-check" />
                    <h2 className="confirm-title">{s.doneTitle}</h2>
                    <p className="confirm-agent-name">{`${name}${s.doneIsIn}`}</p>
                    <p className="confirm-meta">
                      {s.doneScore}
                      <strong>{s.donePts}</strong>
                      {s.donePos}
                      <strong>{confirmPos}</strong>
                    </p>
                    <div className="confirm-actions">
                      <Link className="btn-primary" href={`/agente?id=${newAgentId}`}>
                        <span>{s.doneProfile}</span>
                      </Link>
                      <Link className="btn-ghost" href="/competencias">
                        {s.doneEnroll}
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reference column */}
            <div className="reg-ref-col">
              <div className="ref-box sticky-ref">
                <h3 className="ref-title">{s.refTitle}</h3>
                <p className="ref-sub">{s.refSub}</p>
                <ol className="framework-steps">
                  <li>
                    <strong>{s.r1t}</strong>
                    <span>{s.r1b}</span>
                  </li>
                  <li>
                    <strong>{s.r2t}</strong>
                    <span>{s.r2b}</span>
                  </li>
                  <li>
                    <strong>{s.r3t}</strong>
                    <span>{s.r3b}</span>
                  </li>
                  <li>
                    <strong>{s.r4t}</strong>
                    <span>{s.r4b}</span>
                  </li>
                </ol>
              </div>

              <div className="ref-box sticky-ref" style={{ marginTop: 20 }}>
                <h3 className="ref-title">{s.fmtTitle}</h3>
                <p className="ref-sub">{s.fmtSub}</p>
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
                      {s.ruleTimeoutA}
                      <strong>{s.ruleTimeoutB}</strong>
                    </span>
                  </div>
                  <div className="ref-rule">
                    <span>
                      {s.ruleHttpsA}
                      <strong>{s.ruleHttpsB}</strong>
                    </span>
                  </div>
                  <div className="ref-rule">
                    <span>
                      {s.ruleTieA}
                      <strong>{s.ruleTieB}</strong>
                      {s.ruleTieC}
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
