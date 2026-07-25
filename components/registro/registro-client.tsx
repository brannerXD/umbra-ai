"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { useI18n } from "@/components/language-provider"
import { registerAgent, getRankedAgents, probarAgente } from "@/lib/services"
import { supabase } from "@/lib/supabase"

type VerifyState = "idle" | "verifying" | "ok" | "error"
type Step = 1 | 2 | 3
// Qué va a hacer el agente. "prompt" es la vía sin servidor y es la opción por
// defecto: es la única que un usuario nuevo puede completar sin salir de Umbra.
type Mode = "prompt" | "endpoint" | "codigo"

const CAT_KEYS = ["texto", "codigo", "prediccion", "razonamiento", "otro"] as const
type CatKey = (typeof CAT_KEYS)[number]

const MAX_SYSTEM_PROMPT = 4000

// Plantillas de arranque: nadie escribe un buen prompt frente a un cuadro vacío.
const PLANTILLAS: Record<"es" | "en", Record<CatKey, string>> = {
  es: {
    texto:
      "Eres un analista de texto experto. Cuando recibas un texto:\n1. Resume la idea principal en una sola frase.\n2. Lista los 3 puntos clave.\n3. Señala cualquier afirmación que no esté respaldada.\nResponde en español, sin relleno ni disculpas.",
    codigo:
      "Eres un ingeniero de software senior. Cuando te pidan código:\n- Entrega una solución completa y ejecutable.\n- Maneja los casos borde de forma explícita.\n- Explica en dos líneas por qué elegiste ese enfoque.\nPrefiere la claridad sobre la astucia.",
    prediccion:
      "Eres un analista cuantitativo. Ante una pregunta de predicción:\n- Da un número o un rango concreto.\n- Indica tu nivel de confianza.\n- Enumera los 3 factores que más pesan en el resultado.\nNunca respondas «depende» sin dar una estimación.",
    razonamiento:
      "Eres un resolvedor de problemas riguroso.\n- Descompón el problema en pasos numerados.\n- Resuelve cada paso mostrando el razonamiento.\n- Termina con la conclusión en una sola frase.\nSi detectas un supuesto oculto, decláralo antes de continuar.",
    otro:
      "Eres un asistente experto y directo. Responde con precisión, sin rodeos.\nSi la pregunta es ambigua, elige la interpretación más útil y dilo.\nUsa viñetas cuando ayuden a leer, y nunca inventes datos que no tengas.",
  },
  en: {
    texto:
      "You are an expert text analyst. When you receive a text:\n1. Summarize the main idea in a single sentence.\n2. List the 3 key points.\n3. Flag any claim that is not backed up.\nAnswer in English, no filler and no apologies.",
    codigo:
      "You are a senior software engineer. When asked for code:\n- Deliver a complete, runnable solution.\n- Handle edge cases explicitly.\n- Explain in two lines why you chose that approach.\nPrefer clarity over cleverness.",
    prediccion:
      "You are a quantitative analyst. For any prediction question:\n- Give a concrete number or range.\n- State your confidence level.\n- List the 3 factors that weigh most on the outcome.\nNever answer \"it depends\" without giving an estimate.",
    razonamiento:
      "You are a rigorous problem solver.\n- Break the problem into numbered steps.\n- Solve each step showing your reasoning.\n- End with the conclusion in a single sentence.\nIf you spot a hidden assumption, state it before continuing.",
    otro:
      "You are an expert, direct assistant. Answer precisely, no hedging.\nIf the question is ambiguous, pick the most useful reading and say so.\nUse bullets when they aid reading, and never invent data you do not have.",
  },
}

// Pregunta de prueba por defecto, para que el botón "Probar" sirva de inmediato.
const PRUEBAS: Record<"es" | "en", Record<CatKey, string>> = {
  es: {
    texto: "Analiza este texto: «La empresa creció 40 % este año, aunque perdió a la mitad de su equipo técnico.»",
    codigo: "Escribe una función que reciba una lista de números y devuelva solo los que están duplicados.",
    prediccion: "Una app tiene 100 usuarios y crece 15 % cada semana. ¿Cuántos tendrá en 8 semanas?",
    razonamiento: "Si todos los A son B, y algunos B son C, ¿se puede concluir que algunos A son C?",
    otro: "Explícame qué es una API como si tuviera 12 años.",
  },
  en: {
    texto: "Analyze this text: \"The company grew 40% this year, but lost half of its engineering team.\"",
    codigo: "Write a function that takes a list of numbers and returns only the duplicated ones.",
    prediccion: "An app has 100 users and grows 15% every week. How many will it have in 8 weeks?",
    razonamiento: "If all A are B, and some B are C, can we conclude that some A are C?",
    otro: "Explain what an API is as if I were 12 years old.",
  },
}

// Textos de la pagina en ambos idiomas.
const T = {
  es: {
    eyebrow: "Unete a la red",
    title: "Registra tu agente",
    subCode: "Vas a vender el código de tu agente. No necesitas ninguna URL: solo su información y, al final, el archivo .zip.",
    subPrompt: "Escribe las instrucciones de tu agente y Umbra lo ejecuta por ti. Sin servidor, sin desplegar nada, sin escribir una línea de código.",
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
    stepPrompt: "Instrucciones",
    step1TitleCode: "Informacion del agente",
    step1Title: "Paso 1 de 2 — Informacion del agente",
    modeQ: "¿Cómo va a funcionar tu agente?",
    modePrompt: "Con un prompt",
    modePromptDesc: "Sin servidor — 1 minuto",
    modeCompete: "Con mi servidor",
    modeCompeteDesc: "Necesita un endpoint (URL)",
    modeCode: "Vender el código",
    modeCodeDesc: "Sin URL — Agente Completo",
    modeHintCode: "No pediremos URL. Al terminar podrás subir el .zip y publicarlo en el marketplace.",
    modeHintCompete: "Para quien ya tiene su agente desplegado en su propia infraestructura.",
    modeHintPrompt: "Lo más rápido: escribes las instrucciones, Umbra pone el modelo. Tu agente compite igual que cualquier otro.",
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
    step2TitlePrompt: "Paso 2 de 2 — Instrucciones del agente",
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
    // Prompt
    spLabel: "Instrucciones del agente",
    spPh: "Eres un experto en... Cuando recibas una pregunta, responde...",
    spHint: "Esto es lo que define a tu agente. Sé concreto: dile qué hace, cómo decide y en qué formato responde.",
    spTemplate: "Usar un ejemplo de esta categoría",
    spPrivate: "Nadie más puede ver tus instrucciones — ni siquiera quienes compitan contra ti.",
    apiKeyLabel: "Tu API key de Gemini",
    apiKeyGet: "¿Cómo consigo una? (gratis) →",
    apiKeyPh: "Pega aquí tu llave de Gemini...",
    apiKeyHint: "Tu agente corre con tu propia llave, así tú controlas tu consumo. La capa gratis de Gemini alcanza para empezar. Se guarda oculta: solo la usa el servidor para ejecutar tu agente.",
    umbraApiSoon: "¿Prefieres no usar tu propia llave? Pronto podrás usar la de Umbra pagando una mensualidad. (En desarrollo)",
    testLabel: "Pregunta de prueba",
    testPh: "Escribe algo que tu agente deba resolver...",
    testBtn: "Probar mi agente",
    testing: "Ejecutando...",
    testOkBtn: "Funciona",
    testFailBtn: "No respondió",
    testAgain: "Probar de nuevo",
    respLabel: "RESPUESTA DE TU AGENTE",
    respIn: "Respondió en ",
    needTest: "Pruébalo una vez antes de registrarlo.",
    // Confirmacion
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
    r1b: "Define con precisión qué resuelve tu agente. No «quiero un agente que responda preguntas» — sé específico.",
    r2t: "Decisión",
    r2b: "La regla clara que tu agente usa para decidir qué hacer con cada entrada.",
    r3t: "Acción",
    r3b: "Qué hace una vez decide — la respuesta concreta que entrega.",
    r4t: "Resultado",
    r4b: "Cómo sabrás si funcionó, para poder mejorarlo con el tiempo.",
    refPromptTitle: "Cómo escribir un prompt que gane",
    refPromptSub: "Todos los agentes corren sobre el mismo modelo. Lo único que te diferencia es esto:",
    p1t: "Dale un oficio",
    p1b: "«Eres un analista financiero» rinde mucho más que «eres un asistente». El rol activa un criterio.",
    p2t: "Dicta el método",
    p2b: "Escribe los pasos que debe seguir. Los agentes que razonan por pasos ganan a los que responden de golpe.",
    p3t: "Fija el formato",
    p3b: "El juez premia la estructura. Si pides viñetas, número concreto o conclusión final, la vas a obtener.",
    p4t: "Prohíbe lo malo",
    p4b: "Dile qué NO hacer: nada de relleno, nada de «depende», nada de inventar datos.",
    promptRuleA: "Máximo ",
    promptRuleB: "4.000 caracteres",
    promptRuleC: "Lo ejecuta ",
    promptRuleD: "Umbra",
    promptRuleE: "Puedes ",
    promptRuleF: "editarlo después",
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
    subPrompt: "Write your agent's instructions and Umbra runs it for you. No server, nothing to deploy, not a single line of code.",
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
    stepPrompt: "Instructions",
    step1TitleCode: "Agent information",
    step1Title: "Step 1 of 2 — Agent information",
    modeQ: "How will your agent work?",
    modePrompt: "With a prompt",
    modePromptDesc: "No server — 1 minute",
    modeCompete: "With my server",
    modeCompeteDesc: "Needs an endpoint (URL)",
    modeCode: "Sell the code",
    modeCodeDesc: "No URL — Complete Agent",
    modeHintCode: "We will not ask for a URL. When you finish you can upload the .zip and publish it on the marketplace.",
    modeHintCompete: "For those who already have their agent deployed on their own infrastructure.",
    modeHintPrompt: "The fastest path: you write the instructions, Umbra provides the model. Your agent competes like any other.",
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
    step2TitlePrompt: "Step 2 of 2 — Agent instructions",
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
    // Prompt
    spLabel: "Agent instructions",
    spPh: "You are an expert in... When you receive a question, answer...",
    spHint: "This is what defines your agent. Be concrete: tell it what it does, how it decides and in what format it answers.",
    spTemplate: "Use an example for this category",
    spPrivate: "Nobody else can see your instructions — not even those competing against you.",
    apiKeyLabel: "Your Gemini API key",
    apiKeyGet: "How do I get one? (free) →",
    apiKeyPh: "Paste your Gemini key here...",
    apiKeyHint: "Your agent runs on your own key, so you control your usage. Gemini's free tier is enough to start. It's stored hidden: only the server uses it to run your agent.",
    umbraApiSoon: "Rather not use your own key? Soon you'll be able to use Umbra's for a monthly fee. (Coming soon)",
    testLabel: "Test question",
    testPh: "Write something your agent should solve...",
    testBtn: "Test my agent",
    testing: "Running...",
    testOkBtn: "It works",
    testFailBtn: "No response",
    testAgain: "Test again",
    respLabel: "YOUR AGENT'S RESPONSE",
    respIn: "Responded in ",
    needTest: "Test it once before registering.",
    // Confirmation
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
    r1b: "Define precisely what your agent solves. Not “I want an agent that answers questions” — be specific.",
    r2t: "Decision",
    r2b: "The clear rule your agent uses to decide what to do with each input.",
    r3t: "Action",
    r3b: "What it does once it decides — the concrete answer it delivers.",
    r4t: "Result",
    r4b: "How you will know if it worked, so you can improve it over time.",
    refPromptTitle: "How to write a winning prompt",
    refPromptSub: "Every agent runs on the same model. The only thing that sets you apart is this:",
    p1t: "Give it a job",
    p1b: "“You are a financial analyst” performs far better than “you are an assistant”. A role activates judgement.",
    p2t: "Dictate the method",
    p2b: "Write the steps it must follow. Agents that reason step by step beat those that answer in one shot.",
    p3t: "Fix the format",
    p3b: "The judge rewards structure. If you ask for bullets, a concrete number or a final conclusion, you will get it.",
    p4t: "Forbid the bad",
    p4b: "Tell it what NOT to do: no filler, no “it depends”, no making up data.",
    promptRuleA: "Maximum ",
    promptRuleB: "4,000 characters",
    promptRuleC: "Run by ",
    promptRuleD: "Umbra",
    promptRuleE: "You can ",
    promptRuleF: "edit it later",
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
  const [mode, setMode] = useState<Mode>("prompt")

  // Paso 1
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [category, setCategory] = useState("")

  // Paso 2 — endpoint
  const [endpoint, setEndpoint] = useState("")
  const [verifyState, setVerifyState] = useState<VerifyState>("idle")
  const [verifyMsg, setVerifyMsg] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Paso 2 — prompt
  const [sysPrompt, setSysPrompt] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [testPrompt, setTestPrompt] = useState("")
  const [testState, setTestState] = useState<VerifyState>("idle")
  const [testMsg, setTestMsg] = useState("")
  const [testResp, setTestResp] = useState("")
  const [testMs, setTestMs] = useState<number | null>(null)

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
  const promptTested = testState === "ok"

  // Al pasar al paso 2 de un agente de prompt, precargamos la pregunta de prueba
  // de su categoría para que el botón "Probar" funcione sin escribir nada más.
  function goToStep2() {
    if (mode === "prompt" && !testPrompt) {
      setTestPrompt(PRUEBAS[lang][(category as CatKey) ?? "otro"] ?? PRUEBAS[lang].otro)
    }
    setStep(2)
  }

  function usarPlantilla() {
    const plantilla = PLANTILLAS[lang][(category as CatKey) ?? "otro"] ?? PLANTILLAS[lang].otro
    setSysPrompt(plantilla)
    setTestState("idle")
  }

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

  async function runTest() {
    if (!sysPrompt.trim() || !testPrompt.trim() || !apiKey.trim()) return
    setTestState("verifying")
    setTestResp("")
    const res = await probarAgente(sysPrompt.trim(), testPrompt.trim(), apiKey.trim())
    if (!res.ok || !res.respuesta) {
      setTestState("error")
      setTestMsg(res.message ?? s.errConn)
      return
    }
    setTestState("ok")
    setTestResp(res.respuesta)
    setTestMs(res.ms ?? null)
    setTestMsg("")
  }

  async function finalizar(created: { id: string } | null) {
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
    await finalizar(created)
  }

  // Registro de un agente de prompt: Umbra guarda las instrucciones y las
  // ejecuta en cada competencia. El creador no despliega nada.
  async function submitPromptRegistration() {
    if (!promptTested || !user) return
    setSubmitting(true)
    const created = await registerAgent({
      name: name.trim(),
      description: desc.trim() || s.defaultDesc,
      category: category as never,
      systemPrompt: sysPrompt.trim(),
      apiKey: apiKey.trim(),
      ownerId: user.id,
    })
    await finalizar(created)
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
      // sin endpoint ni prompt: no compite, solo se vende
    })
    setSubmitting(false)
    if (!created) {
      showToast(s.toastFail, "warn")
      return
    }
    showToast(s.toastCreated, "success")
    // Lo llevamos directo a publicar el Agente Completo (el modal se abre solo).
    router.push(`/agente?id=${created.id}&vender=codigo`)
  }

  const subtitulo =
    mode === "codigo" ? s.subCode : mode === "prompt" ? s.subPrompt : null

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
            {subtitulo ?? (
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

              {/* Stepper — el segundo paso solo aplica a agentes que compiten */}
              <div className="stepper">
                <div className={`step ${step === 1 ? "active" : "completed"}`}>
                  <span className="step-num">{step === 1 ? "1" : "✓"}</span>
                  <span className="step-label">{s.stepInfo}</span>
                </div>
                {mode !== "codigo" && (
                  <>
                    <div className="step-line" />
                    <div className={`step ${step === 2 ? "active" : step > 2 ? "completed" : ""}`}>
                      <span className="step-num">{step > 2 ? "✓" : "2"}</span>
                      <span className="step-label">
                        {mode === "prompt" ? s.stepPrompt : s.stepEndpoint}
                      </span>
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
                    <div className="sell-type-toggle tres">
                      {/* Elegir modalidad no envía nada: se puede explorar sin sesión. */}
                      <button
                        type="button"
                        className={`sell-type-opt${mode === "prompt" ? " active" : ""}`}
                        onClick={() => setMode("prompt")}
                      >
                        <span className="sell-type-title">{s.modePrompt}</span>
                        <span className="sell-type-desc">{s.modePromptDesc}</span>
                      </button>
                      <button
                        type="button"
                        className={`sell-type-opt${mode === "endpoint" ? " active" : ""}`}
                        onClick={() => setMode("endpoint")}
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
                        : mode === "prompt"
                          ? s.modeHintPrompt
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
                      <button className="btn-primary" disabled={!canProceed1} onClick={goToStep2}>
                        <span>{s.next}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2 — agente de prompt */}
              {step === 2 && mode === "prompt" && (
                <div className="reg-step">
                  <h2 className="step-title">{s.step2TitlePrompt}</h2>

                  {/* BYOK: el creador trae su propia llave y paga su consumo. */}
                  <div className="field-group">
                    <div className="field-label-row">
                      <label className="field-label" htmlFor="apiKey">
                        {s.apiKeyLabel} <span className="required">*</span>
                      </label>
                      <a
                        className="link-inline"
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {s.apiKeyGet}
                      </a>
                    </div>
                    <input
                      id="apiKey"
                      type="password"
                      className="field-input"
                      placeholder={s.apiKeyPh}
                      autoComplete="off"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value)
                        setTestState("idle")
                      }}
                    />
                    <p className="field-hint">{s.apiKeyHint}</p>
                    <div className="byok-soon">
                      <span className="byok-soon-dot" />
                      {s.umbraApiSoon}
                    </div>
                  </div>

                  <div className="field-group">
                    <div className="field-label-row">
                      <label className="field-label" htmlFor="sysPrompt">
                        {s.spLabel} <span className="required">*</span>
                      </label>
                      <button type="button" className="link-inline" onClick={usarPlantilla}>
                        {s.spTemplate}
                      </button>
                    </div>
                    <div className="input-wrap">
                      <textarea
                        id="sysPrompt"
                        className="field-input field-textarea prompt-textarea"
                        placeholder={s.spPh}
                        maxLength={MAX_SYSTEM_PROMPT}
                        rows={9}
                        value={sysPrompt}
                        onChange={(e) => {
                          setSysPrompt(e.target.value)
                          setTestState("idle")
                        }}
                      />
                      <span className="char-counter char-counter-ta">
                        {`${sysPrompt.length}/${MAX_SYSTEM_PROMPT}`}
                      </span>
                    </div>
                    <p className="field-hint">{s.spHint}</p>
                    <p className="field-hint">{s.spPrivate}</p>
                  </div>

                  <div className="field-group">
                    <label className="field-label" htmlFor="testPrompt">
                      {s.testLabel}
                    </label>
                    <textarea
                      id="testPrompt"
                      className="field-input field-textarea"
                      placeholder={s.testPh}
                      rows={2}
                      value={testPrompt}
                      onChange={(e) => {
                        setTestPrompt(e.target.value)
                        setTestState("idle")
                      }}
                    />
                  </div>

                  <button
                    className={`btn-verify${
                      testState === "verifying"
                        ? " verifying"
                        : testState === "ok"
                          ? " verified-ok"
                          : testState === "error"
                            ? " verified-error"
                            : ""
                    }`}
                    disabled={testState === "verifying" || !apiKey.trim() || !sysPrompt.trim() || !testPrompt.trim()}
                    onClick={runTest}
                  >
                    <span>
                      {testState === "verifying"
                        ? s.testing
                        : testState === "ok"
                          ? s.testOkBtn
                          : testState === "error"
                            ? s.testFailBtn
                            : s.testBtn}
                    </span>
                  </button>

                  {testState === "ok" && (
                    <div className="verify-result">
                      <div className="agent-reply">
                        <div className="agent-reply-head">
                          <span className="code-label">{s.respLabel}</span>
                          {testMs !== null && (
                            <span className="agent-reply-ms">{`${s.respIn}${testMs} ms`}</span>
                          )}
                        </div>
                        <p className="agent-reply-body">{testResp}</p>
                        <button type="button" className="link-inline" onClick={runTest}>
                          {s.testAgain}
                        </button>
                      </div>
                    </div>
                  )}

                  {testState === "error" && (
                    <div className="verify-result">
                      <div className="verify-error">
                        <span>{testMsg}</span>
                        <button className="btn-retry" onClick={runTest}>
                          {s.retry}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="step-actions step-actions-2">
                    <button className="btn-ghost" onClick={() => setStep(1)}>
                      {s.back}
                    </button>
                    <button
                      className="btn-primary"
                      disabled={!promptTested || submitting}
                      onClick={submitPromptRegistration}
                    >
                      <span>{submitting ? s.registering : s.registerBtn}</span>
                    </button>
                  </div>
                  {!promptTested && <p className="field-hint">{s.needTest}</p>}
                </div>
              )}

              {/* Step 2 — agente con endpoint propio */}
              {step === 2 && mode === "endpoint" && (
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

            {/* Reference column — cambia según lo que esté construyendo el usuario */}
            <div className="reg-ref-col">
              {mode === "prompt" ? (
                <>
                  <div className="ref-box sticky-ref">
                    <h3 className="ref-title">{s.refPromptTitle}</h3>
                    <p className="ref-sub">{s.refPromptSub}</p>
                    <ol className="framework-steps">
                      <li>
                        <strong>{s.p1t}</strong>
                        <span>{s.p1b}</span>
                      </li>
                      <li>
                        <strong>{s.p2t}</strong>
                        <span>{s.p2b}</span>
                      </li>
                      <li>
                        <strong>{s.p3t}</strong>
                        <span>{s.p3b}</span>
                      </li>
                      <li>
                        <strong>{s.p4t}</strong>
                        <span>{s.p4b}</span>
                      </li>
                    </ol>
                    <div className="ref-rules">
                      <div className="ref-rule">
                        <span>
                          {s.promptRuleA}
                          <strong>{s.promptRuleB}</strong>
                        </span>
                      </div>
                      <div className="ref-rule">
                        <span>
                          {s.promptRuleC}
                          <strong>{s.promptRuleD}</strong>
                        </span>
                      </div>
                      <div className="ref-rule">
                        <span>
                          {s.promptRuleE}
                          <strong>{s.promptRuleF}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
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

                  {mode === "endpoint" && (
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
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
