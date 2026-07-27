"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { CountUp } from "@/components/count-up"
import { ScoreChart } from "./score-chart"
import { useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/language-provider"
import { useToast } from "@/components/toast-provider"
import { useNow } from "@/hooks/use-now"
import { formatListingPrice, formatTime, getBillingLabel, getCategoryLabel } from "@/lib/umbra"
import {
  MIN_COMPS_FOR_CERTIFICATE,
  archiveAgent,
  createAgentVersion,
  createListing,
  getMyAgentPrompt,
  unarchiveAgent,
  updateAgentDescription,
  updateMyAgentName,
  updateMyAgentPrompt,
  uploadAgentCode,
  uploadAgentImage,
} from "@/lib/services"
import { CODE_LICENSES } from "@/lib/types"
import type { Agent, AgentKind, BillingModel, ListingType, MarketplaceListingWithAgent } from "@/lib/types"

const NAME_COOLDOWN_DAYS = 90
const PROMPT_COOLDOWN_HOURS = 6

// Textos de la pagina en ambos idiomas.
const T = {
  es: {
    back: "\u2190 Volver al ranking",
    global: "Global",
    madeBy: "Hecho por",
    statScore: "Score total",
    statWins: "Victorias",
    statComps: "Competencias",
    statAvg: "Promedio /100",
    issueCert: "Emitir certificado de reputación \u2192",
    certReq: (faltan: number) =>
      `Certificado: te ${faltan === 1 ? "falta" : "faltan"} ${faltan} competencia${faltan === 1 ? "" : "s"}`,
    breakdown: "Desglose del Score",
    bdWins: "Victorias",
    bdSecond: "Segundos puestos",
    bdOthers: "Otras participaciones",
    bdTotal: "TOTAL",
    pts: "pts",
    listedTitle: "Este agente está disponible en el marketplace",
    seeMarket: "Ver en marketplace \u2192",
    ownerBadge: "Este es tu agente",
    endpointLabel: "Endpoint actual:",
    editDesc: "Editar descripción",
    editAgent: "Editar agente",
    unarchive: "Desarchivar",
    kindLabel: { prompt: "Prompt", endpoint: "Endpoint", codigo: "Código" } as Record<AgentKind, string>,
    editAgentTitle: "Editar agente",
    editAgentSub: "Cambia el nombre, la descripción y —si es de prompt— sus instrucciones.",
    nameLabel: "Nombre",
    nameCooldownOk: "Puedes cambiar el nombre. Después de guardarlo, esperarás 90 días para volver a cambiarlo.",
    nameCooldownWait: (d: string) => `Podrás cambiar el nombre de nuevo el ${d}.`,
    promptLabel: "Instrucciones del agente (prompt)",
    promptLoading: "Cargando prompt...",
    promptCooldownOk: "Puedes editar el prompt. Después de guardarlo, esperarás 6 horas para volver a editarlo.",
    promptCooldownWait: (d: string) => `Podrás editar el prompt de nuevo el ${d}.`,
    saveName: "Guardar nombre",
    savePrompt: "Guardar prompt",
    okName: "Nombre actualizado.",
    okPrompt: "Prompt actualizado.",
    okUnarchive: (n: string) => `${n} fue desarchivado.`,
    errUnarchive: "No se pudo desarchivar el agente.",
    unarchiving: "Desarchivando...",
    dateLocale: "es-CO",
    listMarket: "Listar en marketplace",
    newVersion: "Publicar nueva versión",
    archiveAgent: "Archivar agente",
    evolution: "Evolución del Score",
    history: "Historial de Competencias",
    histAll: "Todas",
    histWins: "Victorias",
    histOther: "Otras",
    histEmpty: "Este agente aún no ha competido.",
    seeComps: "Ver competencias disponibles \u2192",
    score: "Score:",
    seeAllHistory: "Ver todo el historial",
    close: "Cerrar",
    editDescTitle: "Editar descripción",
    editDescSub: "Solo puedes editar la descripción de tu agente.",
    descPlaceholder: "Describe tu agente...",
    cancel: "Cancelar",
    saving: "Guardando...",
    saveChanges: "Guardar cambios",
    publishTitle: "Publicar en el marketplace",
    modeUrl: "Licencia por URL",
    modeCode: "Agente Completo",
    modeUrlDesc: "Uso vía la API de Umbra",
    modeCodeDesc: "Código fuente descargable",
    modeUrlHint: "(tú sigues hospedando el agente)",
    modeCodeHint: "(vendes el código para que el comprador lo ejecute)",
    publishSubLead: "Elige la modalidad:",
    billingLabel: "Cómo quieres cobrar",
    billingMonthly: "Suscripción mensual",
    billingUsage: "Por uso (cada 1.000 llamadas)",
    billingHint: "El acceso es no exclusivo y puedes retirarlo cuando quieras. Tu endpoint nunca se expone.",
    modelsLabel: "Modelos compatibles",
    modelsHint: "Separa con comas. Opcional.",
    codeLabel: "Código del agente (.zip) *",
    pickZip: "Elegir archivo .zip",
    codeHint: "Máximo 25MB. Se guarda privado: solo quien lo compre podrá descargarlo. Se publica como v1.0.",
    gitLabel: "Repositorio Git",
    gitPlaceholder: "https://github.com/tu-usuario/tu-agente (opcional)",
    readmeLabel: "README *",
    readmePlaceholder: "Qué hace tu agente, cómo instalarlo y ejecutarlo...",
    techLabel: "Tecnologías utilizadas",
    techPlaceholder: "Python, LangChain, FastAPI...",
    techHint: "Separa con comas.",
    depsLabel: "Dependencias",
    depsPlaceholder: "requirements.txt, paquetes npm, servicios externos...",
    licenseLabel: "Licencia",
    licenseHint: "El código no hereda tu reputación: la ganó este despliegue, no el archivo.",
    sellDescLabel: "Descripción",
    sellDescPlaceholder: "Resume en una frase para qué sirve tu agente.",
    docLabel: "Documentación",
    docPlaceholder: "Guía de uso, endpoints, ejemplos... (opcional)",
    imageLabel: "Imagen de producto",
    pickImage: "Elegir imagen",
    imageHint: "Se muestra en el marketplace. Máx 3MB. Opcional.",
    priceOnce: "Precio (pago único)",
    priceUsage: "Precio por 1.000 llamadas",
    priceMonthly: "Precio por mes",
    priceHint: "Umbra le cobra al comprador y te transfiere lo recaudado menos la comisión de la plataforma.",
    consentLead: "Confirmo que soy el titular de este agente y acepto los",
    consentLink: "Términos del Marketplace para vendedores",
    publishing: "Publicando...",
    publishListing: "Publicar listado",
    verTitle: "Publicar nueva versión",
    verSub: "La versión anterior se conserva: quien la compró seguirá pudiendo descargarla, y todos verán que hay una actualización disponible.",
    verNumLabel: "Número de versión *",
    verNumPlaceholder: "v1.1, v2.0...",
    verCodeLabel: "Código (.zip) *",
    changelogLabel: "Novedades (changelog)",
    changelogPlaceholder: "Qué cambió en esta versión...",
    publishVer: "Publicar versión",
    archiveTitle: (n: string) => `Archivar ${n}`,
    archiveSub: "Desaparecerá del ranking público y se quitará del marketplace si estaba listado. Su historial de competencias se conserva. No se borra nada de forma permanente.",
    archiving: "Archivando...",
    errSaveDesc: "No se pudo guardar la descripción.",
    okSaveDesc: "Descripción actualizada.",
    errPrice: "Ingresa un precio válido.",
    errZip: "Sube el .zip con el código de tu agente.",
    errReadme: "Agrega un README para tu Agente Completo.",
    errUpload: "No se pudo subir el código. Intenta de nuevo.",
    errListing: "No se pudo publicar el listado. Intenta de nuevo.",
    initialVersion: "Versión inicial.",
    fallbackUser: "Usuario",
    okListed: (n: string, p: string) => `${n} está disponible en el marketplace por ${p}.`,
    descCode: (n: string, l: string) => `Código completo de ${n} — licencia ${l}.`,
    descAccess: (n: string) => `Acceso a ${n}, listado por su creador.`,
    errVerNum: "Escribe el número de versión (ej: v1.1).",
    errVerZip: "Sube el .zip de la nueva versión.",
    errVerDup: "No se pudo publicar la versión. ¿Ya existe ese número?",
    okVer: (v: string) => `Versión ${v} publicada. Tus compradores ya pueden actualizarse.`,
    errImgType: "Selecciona un archivo de imagen.",
    errImgSize: "La imagen debe pesar menos de 3MB.",
    errZipSize: "El archivo debe pesar menos de 25MB.",
    errArchive: "No se pudo archivar el agente.",
    okArchive: (n: string) => `${n} fue archivado.`,
  },
  en: {
    back: "\u2190 Back to ranking",
    global: "Global",
    madeBy: "Made by",
    statScore: "Total score",
    statWins: "Wins",
    statComps: "Competitions",
    statAvg: "Average /100",
    issueCert: "Issue reputation certificate \u2192",
    certReq: (faltan: number) =>
      `Certificate: ${faltan} more competition${faltan === 1 ? "" : "s"} needed`,
    breakdown: "Score breakdown",
    bdWins: "Wins",
    bdSecond: "Second places",
    bdOthers: "Other entries",
    bdTotal: "TOTAL",
    pts: "pts",
    listedTitle: "This agent is available on the marketplace",
    seeMarket: "See on marketplace \u2192",
    ownerBadge: "This is your agent",
    endpointLabel: "Current endpoint:",
    editDesc: "Edit description",
    editAgent: "Edit agent",
    unarchive: "Unarchive",
    kindLabel: { prompt: "Prompt", endpoint: "Endpoint", codigo: "Code" } as Record<AgentKind, string>,
    editAgentTitle: "Edit agent",
    editAgentSub: "Change the name, the description and —if it is a prompt agent— its instructions.",
    nameLabel: "Name",
    nameCooldownOk: "You can change the name. After saving it, you will wait 90 days to change it again.",
    nameCooldownWait: (d: string) => `You can change the name again on ${d}.`,
    promptLabel: "Agent instructions (prompt)",
    promptLoading: "Loading prompt...",
    promptCooldownOk: "You can edit the prompt. After saving it, you will wait 6 hours to edit it again.",
    promptCooldownWait: (d: string) => `You can edit the prompt again on ${d}.`,
    saveName: "Save name",
    savePrompt: "Save prompt",
    okName: "Name updated.",
    okPrompt: "Prompt updated.",
    okUnarchive: (n: string) => `${n} was unarchived.`,
    errUnarchive: "The agent could not be unarchived.",
    unarchiving: "Unarchiving...",
    dateLocale: "en-US",
    listMarket: "List on marketplace",
    newVersion: "Publish new version",
    archiveAgent: "Archive agent",
    evolution: "Score evolution",
    history: "Competition history",
    histAll: "All",
    histWins: "Wins",
    histOther: "Others",
    histEmpty: "This agent has not competed yet.",
    seeComps: "See available competitions \u2192",
    score: "Score:",
    seeAllHistory: "See full history",
    close: "Close",
    editDescTitle: "Edit description",
    editDescSub: "You can only edit your agent description.",
    descPlaceholder: "Describe your agent...",
    cancel: "Cancel",
    saving: "Saving...",
    saveChanges: "Save changes",
    publishTitle: "Publish on the marketplace",
    modeUrl: "URL License",
    modeCode: "Complete Agent",
    modeUrlDesc: "Usage via the Umbra API",
    modeCodeDesc: "Downloadable source code",
    modeUrlHint: "(you keep hosting the agent)",
    modeCodeHint: "(you sell the code so the buyer runs it)",
    publishSubLead: "Choose the modality:",
    billingLabel: "How you want to charge",
    billingMonthly: "Monthly subscription",
    billingUsage: "Per use (every 1,000 calls)",
    billingHint: "Access is non-exclusive and you can withdraw it whenever you want. Your endpoint is never exposed.",
    modelsLabel: "Compatible models",
    modelsHint: "Separate with commas. Optional.",
    codeLabel: "Agent code (.zip) *",
    pickZip: "Choose .zip file",
    codeHint: "Max 25MB. Stored privately: only buyers can download it. Published as v1.0.",
    gitLabel: "Git repository",
    gitPlaceholder: "https://github.com/your-user/your-agent (optional)",
    readmeLabel: "README *",
    readmePlaceholder: "What your agent does, how to install and run it...",
    techLabel: "Technologies used",
    techPlaceholder: "Python, LangChain, FastAPI...",
    techHint: "Separate with commas.",
    depsLabel: "Dependencies",
    depsPlaceholder: "requirements.txt, npm packages, external services...",
    licenseLabel: "License",
    licenseHint: "The code does not inherit your reputation: this deployment earned it, not the file.",
    sellDescLabel: "Description",
    sellDescPlaceholder: "Sum up in one sentence what your agent is for.",
    docLabel: "Documentation",
    docPlaceholder: "Usage guide, endpoints, examples... (optional)",
    imageLabel: "Product image",
    pickImage: "Choose image",
    imageHint: "Shown on the marketplace. Max 3MB. Optional.",
    priceOnce: "Price (one-time payment)",
    priceUsage: "Price per 1,000 calls",
    priceMonthly: "Price per month",
    priceHint: "Umbra charges the buyer and transfers you the proceeds minus the platform fee.",
    consentLead: "I confirm I am the owner of this agent and accept the",
    consentLink: "Marketplace Terms for sellers",
    publishing: "Publishing...",
    publishListing: "Publish listing",
    verTitle: "Publish new version",
    verSub: "The previous version is kept: whoever bought it can still download it, and everyone will see an update is available.",
    verNumLabel: "Version number *",
    verNumPlaceholder: "v1.1, v2.0...",
    verCodeLabel: "Code (.zip) *",
    changelogLabel: "What is new (changelog)",
    changelogPlaceholder: "What changed in this version...",
    publishVer: "Publish version",
    archiveTitle: (n: string) => `Archive ${n}`,
    archiveSub: "It will disappear from the public ranking and be removed from the marketplace if it was listed. Its competition history is preserved. Nothing is permanently deleted.",
    archiving: "Archiving...",
    errSaveDesc: "The description could not be saved.",
    okSaveDesc: "Description updated.",
    errPrice: "Enter a valid price.",
    errZip: "Upload the .zip with your agent code.",
    errReadme: "Add a README for your Complete Agent.",
    errUpload: "The code could not be uploaded. Please try again.",
    errListing: "The listing could not be published. Please try again.",
    initialVersion: "Initial version.",
    fallbackUser: "User",
    okListed: (n: string, p: string) => `${n} is available on the marketplace for ${p}.`,
    descCode: (n: string, l: string) => `Complete code of ${n} — ${l} license.`,
    descAccess: (n: string) => `Access to ${n}, listed by its creator.`,
    errVerNum: "Write the version number (e.g. v1.1).",
    errVerZip: "Upload the .zip of the new version.",
    errVerDup: "The version could not be published. Does that number already exist?",
    okVer: (v: string) => `Version ${v} published. Your buyers can now update.`,
    errImgType: "Select an image file.",
    errImgSize: "The image must be smaller than 3MB.",
    errZipSize: "The file must be smaller than 25MB.",
    errArchive: "The agent could not be archived.",
    okArchive: (n: string) => `${n} was archived.`,
  },
} as const

const MAX_CODE_BYTES = 25 * 1024 * 1024
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

const HIST_LIMIT = 5

type HistFilter = "all" | "win" | "other"

// Convierte texto separado por comas o saltos de línea en una lista limpia.
function parseList(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

export function AgenteClient({
  agent: initialAgent,
  rankPosition,
  listing: initialListing,
  autoSellCode = false,
}: {
  agent: Agent
  rankPosition: number
  listing: MarketplaceListingWithAgent | null
  /** Abre el modal de publicación ya en modalidad "Agente Completo". */
  autoSellCode?: boolean
}) {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { lang } = useI18n()
  const s = T[lang]

  const [name, setName] = useState(initialAgent.name)
  const [description, setDescription] = useState(initialAgent.description)
  const [archived, setArchived] = useState(initialAgent.archived)
  const [nameUpdatedAt, setNameUpdatedAt] = useState<Date | null>(initialAgent.nameUpdatedAt)
  const [promptUpdatedAt, setPromptUpdatedAt] = useState<Date | null>(initialAgent.promptUpdatedAt)
  const [listing, setListing] = useState<MarketplaceListingWithAgent | null>(initialListing)
  const [histFilter, setHistFilter] = useState<HistFilter>("all")
  const [showAll, setShowAll] = useState(false)
  const now = useNow(60000)

  // Modales
  const [editOpen, setEditOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState(name)
  const [descDraft, setDescDraft] = useState(description)
  const [promptDraft, setPromptDraft] = useState("")
  const [promptLoading, setPromptLoading] = useState(false)
  const [priceDraft, setPriceDraft] = useState("")
  const [priceUnit, setPriceUnit] = useState<"USD" | "COP">("USD")
  const [listingTypeDraft, setListingTypeDraft] = useState<ListingType>("acceso")
  const [billingDraft, setBillingDraft] = useState<BillingModel>("mensual")
  const [licenseDraft, setLicenseDraft] = useState<string>(CODE_LICENSES[0])
  const [codeFile, setCodeFile] = useState<File | null>(null)
  const codeInputRef = useRef<HTMLInputElement>(null)
  const [publishing, setPublishing] = useState(false)
  const [listAccepted, setListAccepted] = useState(false)
  // Metadata extendida del listado
  const [sellDescDraft, setSellDescDraft] = useState("")
  const [docDraft, setDocDraft] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [modelsDraft, setModelsDraft] = useState("") // solo URL
  const [readmeDraft, setReadmeDraft] = useState("") // solo código
  const [techDraft, setTechDraft] = useState("") // solo código
  const [depsDraft, setDepsDraft] = useState("") // solo código
  const [gitRepoDraft, setGitRepoDraft] = useState("") // solo código
  // Publicar una nueva versión (v1.1, v2.0...) de un Agente Completo
  const [verOpen, setVerOpen] = useState(false)
  const [verDraft, setVerDraft] = useState("")
  const [changelogDraft, setChangelogDraft] = useState("")
  const [verFile, setVerFile] = useState<File | null>(null)
  const verInputRef = useRef<HTMLInputElement>(null)
  const [publishingVer, setPublishingVer] = useState(false)
  const [savingDesc, setSavingDesc] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [unarchiving, setUnarchiving] = useState(false)

  const isOwner = !!user && initialAgent.ownerId === user.id
  const isPromptAgent = initialAgent.kind === "prompt"

  // Cooldowns: null = nunca editado = se puede ya.
  const nowMs = now ?? Date.now()
  const nameNextDate = nameUpdatedAt
    ? new Date(nameUpdatedAt.getTime() + NAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
    : null
  const canChangeName = !nameNextDate || nowMs >= nameNextDate.getTime()
  const promptNextDate = promptUpdatedAt
    ? new Date(promptUpdatedAt.getTime() + PROMPT_COOLDOWN_HOURS * 60 * 60 * 1000)
    : null
  const canChangePrompt = !promptNextDate || nowMs >= promptNextDate.getTime()

  // Al venir del registro con "vender el código", abrimos el modal ya configurado.
  const autoOpened = useRef(false)
  useEffect(() => {
    if (autoOpened.current || !autoSellCode || !isOwner || listing) return
    autoOpened.current = true
    setListingTypeDraft("codigo")
    setListAccepted(false)
    setListOpen(true)
  }, [autoSellCode, isOwner, listing])

  // El score se gana por puesto: 10 al primero, 4 al segundo, 2 al resto.
  // Se cuenta sobre el historial real en vez de aplicar una formula aparte,
  // que era justo lo que hacia que el desglose no cuadrara con el titular.
  const hist = initialAgent.history ?? []
  const primeros = hist.filter((h) => h.position === 1).length
  const segundos = hist.filter((h) => h.position === 2).length
  const resto = hist.filter((h) => h.position > 2).length
  const winPts = primeros * 10
  const secondPts = segundos * 4
  const restPts = resto * 2
  const totalPts = winPts + secondPts + restPts

  const filtered = useMemo(() => {
    let items = initialAgent.history || []
    if (histFilter === "win") items = items.filter((h) => h.result === "win")
    if (histFilter === "other") items = items.filter((h) => h.result !== "win")
    return items
  }, [initialAgent.history, histFilter])

  const toShow = showAll ? filtered : filtered.slice(0, HIST_LIMIT)

  // Abre el editor completo. Para agentes de prompt, carga el prompt actual
  // (la columna está oculta al cliente; llega por RPC que valida propiedad).
  async function openEditor() {
    setNameDraft(name)
    setDescDraft(description)
    setPromptDraft("")
    setEditOpen(true)
    if (isPromptAgent) {
      setPromptLoading(true)
      const p = await getMyAgentPrompt(initialAgent.id)
      setPromptDraft(p ?? "")
      setPromptLoading(false)
    }
  }

  async function saveName() {
    const value = nameDraft.trim()
    if (!value || value === name) return
    setSavingName(true)
    const res = await updateMyAgentName(initialAgent.id, value)
    setSavingName(false)
    if (!res.ok) {
      showToast(res.message, "warn")
      return
    }
    setName(value)
    setNameUpdatedAt(res.at)
    showToast(s.okName, "success")
  }

  async function saveDescription() {
    setSavingDesc(true)
    const ok = await updateAgentDescription(initialAgent.id, descDraft)
    setSavingDesc(false)
    if (!ok) {
      showToast(s.errSaveDesc, "warn")
      return
    }
    setDescription(descDraft)
    showToast(s.okSaveDesc, "success")
  }

  async function savePrompt() {
    const value = promptDraft.trim()
    if (!value) return
    setSavingPrompt(true)
    const res = await updateMyAgentPrompt(initialAgent.id, value)
    setSavingPrompt(false)
    if (!res.ok) {
      showToast(res.message, "warn")
      return
    }
    setPromptUpdatedAt(res.at)
    showToast(s.okPrompt, "success")
  }

  async function confirmUnarchive() {
    setUnarchiving(true)
    const ok = await unarchiveAgent(initialAgent.id)
    setUnarchiving(false)
    if (!ok) {
      showToast(s.errUnarchive, "warn")
      return
    }
    setArchived(false)
    showToast(s.okUnarchive(name), "success")
    router.refresh()
  }

  async function publishListing() {
    const price = Number.parseFloat(priceDraft)
    if (!price || price <= 0) {
      showToast(s.errPrice, "warn")
      return
    }
    const isCode = listingTypeDraft === "codigo"
    if (isCode && !codeFile) {
      showToast(s.errZip, "warn")
      return
    }
    if (isCode && !readmeDraft.trim()) {
      showToast(s.errReadme, "warn")
      return
    }
    if (!user) return

    setPublishing(true)

    // El código va a un bucket privado; solo quien compre podrá descargarlo.
    // La primera versión publicada es la v1.0.
    const INITIAL_VERSION = "v1.0"
    let codePath: string | null = null
    if (isCode && codeFile) {
      codePath = await uploadAgentCode(user.id, initialAgent.id, INITIAL_VERSION, codeFile)
      if (!codePath) {
        setPublishing(false)
        showToast(s.errUpload, "warn")
        return
      }
    }

    // Imagen de producto (opcional) → bucket público.
    let imageUrl: string | null = null
    if (imageFile) {
      imageUrl = await uploadAgentImage(user.id, initialAgent.id, imageFile)
    }

    const billingModel: BillingModel = isCode ? "unico" : billingDraft
    const technologies = isCode ? parseList(techDraft) : null
    const compatibleModels = !isCode ? parseList(modelsDraft) : null
    const description =
      sellDescDraft.trim() ||
      (isCode
        ? s.descCode(initialAgent.name, licenseDraft)
        : s.descAccess(initialAgent.name))

    const listingId = await createListing({
      agentId: initialAgent.id,
      listingType: listingTypeDraft,
      price,
      priceUnit,
      billingModel,
      description,
      codeLicense: isCode ? licenseDraft : null,
      codePath,
      imageUrl,
      documentation: docDraft.trim() || null,
      compatibleModels: compatibleModels && compatibleModels.length ? compatibleModels : null,
      gitRepo: isCode ? gitRepoDraft.trim() || null : null,
      technologies: technologies && technologies.length ? technologies : null,
      dependencies: isCode ? depsDraft.trim() || null : null,
      readme: isCode ? readmeDraft.trim() || null : null,
    })
    if (!listingId) {
      setPublishing(false)
      showToast(s.errListing, "warn")
      return
    }

    // Registra la primera versión del código (v1.0) ligada al listado.
    if (isCode && codePath) {
      await createAgentVersion({
        listingId,
        version: INITIAL_VERSION,
        codePath,
        changelog: s.initialVersion,
      })
    }

    setPublishing(false)
    setListing({
      agentId: initialAgent.id,
      listingId,
      listed: true,
      listingType: listingTypeDraft,
      price,
      priceUnit,
      billingModel,
      codeLicense: isCode ? licenseDraft : null,
      codePath,
      description,
      sellerName: user?.email?.split("@")[0] ?? s.fallbackUser,
      listedAt: new Date(),
      imageUrl,
      documentation: docDraft.trim() || null,
      compatibleModels: compatibleModels && compatibleModels.length ? compatibleModels : null,
      gitRepo: isCode ? gitRepoDraft.trim() || null : null,
      technologies: technologies && technologies.length ? technologies : null,
      dependencies: isCode ? depsDraft.trim() || null : null,
      readme: isCode ? readmeDraft.trim() || null : null,
      agent: initialAgent,
    })
    setListOpen(false)
    showToast(
      s.okListed(initialAgent.name, formatListingPrice(price, priceUnit, billingModel, lang)),
      "success",
    )
  }

  async function publishVersion() {
    const version = verDraft.trim()
    if (!version) {
      showToast(s.errVerNum, "warn")
      return
    }
    if (!verFile) {
      showToast(s.errVerZip, "warn")
      return
    }
    if (!user || !listing) return

    setPublishingVer(true)
    const codePath = await uploadAgentCode(user.id, initialAgent.id, version, verFile)
    if (!codePath) {
      setPublishingVer(false)
      showToast(s.errUpload, "warn")
      return
    }
    const created = await createAgentVersion({
      listingId: listing.listingId,
      version,
      codePath,
      changelog: changelogDraft.trim() || null,
    })
    setPublishingVer(false)
    if (!created) {
      showToast(s.errVerDup, "warn")
      return
    }
    // El listado ahora apunta a la última versión.
    setListing({ ...listing, codePath })
    setVerOpen(false)
    setVerDraft("")
    setChangelogDraft("")
    setVerFile(null)
    showToast(s.okVer(version), "success")
  }

  // Selector de imagen de producto (compartido por ambos modos).
  function onImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    e.target.value = ""
    if (f && !f.type.startsWith("image/")) {
      showToast(s.errImgType, "warn")
      return
    }
    if (f && f.size > MAX_IMAGE_BYTES) {
      showToast(s.errImgSize, "warn")
      return
    }
    setImageFile(f)
  }

  async function confirmArchiveAgent() {
    setArchiving(true)
    const ok = await archiveAgent(initialAgent.id)
    setArchiving(false)
    if (!ok) {
      showToast(s.errArchive, "warn")
      return
    }
    setArchived(true)
    showToast(s.okArchive(name), "success")
    setArchiveOpen(false)
    router.refresh()
  }

  return (
    <main>
      <div className="breadcrumb-bar">
        <div className="container">
          <Link href="/app#ranking" className="breadcrumb-link">
            {s.back}
          </Link>
        </div>
      </div>

      <section className="agent-hero">
        <div className="container">
          <div className="agent-hero-inner">
            <div className="agent-avatar-wrap">
              <div className="agent-avatar-lg">{name.slice(0, 2).toUpperCase()}</div>
            </div>
            <div className="agent-info">
              <div className="agent-top-row">
                <h1 className="agent-name">{name}</h1>
                {rankPosition > 0 && (
                  <span className="agent-rank-badge">{`#${rankPosition} ${s.global}`}</span>
                )}
              </div>
              <div className="agent-tag-row">
                <span className="cat-tag">{getCategoryLabel(initialAgent.category, lang)}</span>
                <span className={`kind-tag kind-tag-${initialAgent.kind}`}>
                  {s.kindLabel[initialAgent.kind]}
                </span>
              </div>
              {initialAgent.creator && (
                <p className="agent-madeby">
                  {s.madeBy}{" "}
                  <Link href={`/u?id=${initialAgent.creator.id}`} className="agent-madeby-link">
                    {initialAgent.creator.username}
                  </Link>
                </p>
              )}
              <p className="agent-desc">{description}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-card stat-card-main" style={{ animationDelay: "0ms" }}>
              <span className="stat-card-num">
                <CountUp target={initialAgent.score} />
              </span>
              <span className="stat-card-label">{s.statScore}</span>
            </div>
            <div className="stat-card" style={{ animationDelay: "60ms" }}>
              <span className="stat-card-num">
                <CountUp target={initialAgent.wins} />
              </span>
              <span className="stat-card-label">{s.statWins}</span>
            </div>
            <div className="stat-card" style={{ animationDelay: "120ms" }}>
              <span className="stat-card-num">
                <CountUp target={initialAgent.comps} />
              </span>
              <span className="stat-card-label">{s.statComps}</span>
            </div>
            <div className="stat-card" style={{ animationDelay: "180ms" }}>
              <span className="stat-card-num">{initialAgent.avgScore.toFixed(1)}</span>
              <span className="stat-card-label">{s.statAvg}</span>
            </div>
          </div>
          {isOwner && (
            <div className="cert-link-row">
              {initialAgent.comps >= MIN_COMPS_FOR_CERTIFICATE ? (
                <Link href={`/certificado?id=${initialAgent.id}`} className="btn-ghost btn-sm">
                  {s.issueCert}
                </Link>
              ) : (
                <button type="button" className="btn-ghost btn-sm" disabled>
                  {s.certReq(MIN_COMPS_FOR_CERTIFICATE - initialAgent.comps)}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="breakdown-section">
        <div className="container">
          <h2 className="section-title-sm">{s.breakdown}</h2>
          <div className="breakdown-box">
            <div className="breakdown-row">
              <span className="breakdown-concept">{s.bdWins}</span>
              <span className="breakdown-calc">{`${primeros} × 10 pts`}</span>
              <span className="breakdown-pts">{`+${winPts} ${s.pts}`}</span>
            </div>
            <div className="breakdown-row">
              <span className="breakdown-concept">{s.bdSecond}</span>
              <span className="breakdown-calc">{`${segundos} × 4 pts`}</span>
              <span className="breakdown-pts">{`+${secondPts} ${s.pts}`}</span>
            </div>
            <div className="breakdown-row">
              <span className="breakdown-concept">{s.bdOthers}</span>
              <span className="breakdown-calc">{`${resto} × 2 pts`}</span>
              <span className="breakdown-pts">{`+${restPts} ${s.pts}`}</span>
            </div>
            <div className="breakdown-divider" />
            <div className="breakdown-row total">
              <span className="breakdown-concept">{s.bdTotal}</span>
              <span className="breakdown-calc" />
              <span className="breakdown-pts">{`${totalPts} ${s.pts}`}</span>
            </div>
          </div>
        </div>
      </section>

      {listing && (
        <section className="listing-section">
          <div className="container">
            <div className="listing-box">
              <div className="listing-info">
                <div className="section-eyebrow">{getBillingLabel(listing.billingModel, lang)}</div>
                <h2 className="section-title" style={{ fontSize: "1.5rem" }}>
                  {s.listedTitle}
                </h2>
                <p className="section-sub">{listing.description}</p>
              </div>
              <div className="listing-action">
                <span className="listing-price">
                  {formatListingPrice(listing.price, listing.priceUnit, listing.billingModel, lang)}
                </span>
                <Link href="/marketplace" className="btn-primary">
                  <span>{s.seeMarket}</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {isOwner && (
        <section className="owner-panel">
          <div className="container">
            <div className="owner-box">
              <span className="owner-badge">{s.ownerBadge}</span>
              {initialAgent.kind === "endpoint" && (
                <div className="owner-endpoint">
                  <span className="owner-label">{s.endpointLabel}</span>
                  <span className="owner-endpoint-val">●●●●●●●●●●●●●●</span>
                </div>
              )}
              <button className="btn-ghost btn-sm" onClick={openEditor}>
                {s.editAgent}
              </button>
              {!listing && (
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setListAccepted(false)
                    setListOpen(true)
                  }}
                >
                  {s.listMarket}
                </button>
              )}
              {listing?.listingType === "codigo" && (
                <button className="btn-ghost btn-sm" onClick={() => setVerOpen(true)}>
                  {s.newVersion}
                </button>
              )}
              {archived ? (
                <button className="btn-ghost btn-sm" disabled={unarchiving} onClick={confirmUnarchive}>
                  {unarchiving ? s.unarchiving : s.unarchive}
                </button>
              ) : (
                <button className="btn-ghost btn-sm" onClick={() => setArchiveOpen(true)}>
                  {s.archiveAgent}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="chart-section">
        <div className="container">
          <h2 className="section-title-sm">{s.evolution}</h2>
          <ScoreChart evolution={initialAgent.scoreEvolution} />
        </div>
      </section>

      <section className="history-section">
        <div className="container">
          <div className="history-header">
            <h2 className="section-title-sm">{s.history}</h2>
            <div className="history-tabs">
              {(
                [
                  ["all", s.histAll],
                  ["win", s.histWins],
                  ["other", s.histOther],
                ] as [HistFilter, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={`tab-btn-sm${histFilter === key ? " active" : ""}`}
                  onClick={() => {
                    setHistFilter(key)
                    setShowAll(false)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="history-empty">
              <p>{s.histEmpty}</p>
              <Link href="/competencias" className="btn-ghost btn-sm">
                {s.seeComps}
              </Link>
            </div>
          ) : (
            <>
              <div className="history-list">
                {toShow.map((h, i) => (
                  <Link
                    key={`${h.compId}-${i}`}
                    href={`/detalle?id=${h.compId}`}
                    className={`history-item${h.result === "win" ? " hist-win" : ""}`}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="hist-result-badge">{`${h.position}°`}</div>
                    <div className="hist-info">
                      <div className="hist-comp-name">{h.compName}</div>
                      <div className="hist-meta">
                        <span className="hist-time">{formatTime(h.time, lang)}</span>
                        <span className="hist-score">{`${s.score} ${h.score}/100`}</span>
                        <span className="hist-response-time">{`· ${h.responseTime}s`}</span>
                      </div>
                    </div>
                    <div className="hist-right">
                      <span className="hist-pts">{`+${h.pts} ${s.pts}`}</span>
                      <span className="hist-arrow">→</span>
                    </div>
                  </Link>
                ))}
              </div>
              {!showAll && filtered.length > HIST_LIMIT && (
                <div className="history-more">
                  <button className="btn-ghost btn-sm" onClick={() => setShowAll(true)}>
                    {s.seeAllHistory}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Modal editar agente (nombre, descripción, prompt) */}
      {editOpen && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setEditOpen(false)}>
          <div className="modal-box sell-modal">
            <button className="modal-close" aria-label={s.close} onClick={() => setEditOpen(false)}>
              ✕
            </button>
            <h3 className="modal-title">{s.editAgentTitle}</h3>
            <p className="modal-sub">{s.editAgentSub}</p>

            <div className="sell-modal-body">
              {/* Nombre (cada 90 días) */}
              <div className="field-group">
                <label className="field-label">{s.nameLabel}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="field-input"
                    maxLength={60}
                    disabled={!canChangeName}
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                  />
                  <button
                    className="btn-primary btn-sm"
                    disabled={!canChangeName || savingName || !nameDraft.trim() || nameDraft.trim() === name}
                    onClick={saveName}
                  >
                    <span>{savingName ? "..." : s.saveName}</span>
                  </button>
                </div>
                <p className="field-hint">
                  {canChangeName
                    ? s.nameCooldownOk
                    : s.nameCooldownWait(nameNextDate!.toLocaleDateString(s.dateLocale))}
                </p>
              </div>

              {/* Descripción */}
              <div className="field-group">
                <label className="field-label">{s.editDescTitle}</label>
                <textarea
                  className="field-input sell-textarea"
                  maxLength={100}
                  rows={3}
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  placeholder={s.descPlaceholder}
                />
                <div className="perfil-bio-actions">
                  <span className="char-counter">{`${descDraft.length}/100`}</span>
                  <button
                    className="btn-ghost btn-sm"
                    disabled={savingDesc || descDraft === description}
                    onClick={saveDescription}
                  >
                    <span>{savingDesc ? s.saving : s.saveChanges}</span>
                  </button>
                </div>
              </div>

              {/* Prompt (solo agentes de prompt, cada 6 horas) */}
              {isPromptAgent && (
                <div className="field-group">
                  <label className="field-label">{s.promptLabel}</label>
                  <textarea
                    className="field-input sell-textarea"
                    maxLength={4000}
                    rows={6}
                    disabled={!canChangePrompt || promptLoading}
                    value={promptLoading ? s.promptLoading : promptDraft}
                    onChange={(e) => setPromptDraft(e.target.value)}
                  />
                  <div className="perfil-bio-actions">
                    <span className="char-counter">{`${promptDraft.length}/4000`}</span>
                    <button
                      className="btn-ghost btn-sm"
                      disabled={!canChangePrompt || savingPrompt || promptLoading || !promptDraft.trim()}
                      onClick={savePrompt}
                    >
                      <span>{savingPrompt ? s.saving : s.savePrompt}</span>
                    </button>
                  </div>
                  <p className="field-hint">
                    {canChangePrompt
                      ? s.promptCooldownOk
                      : s.promptCooldownWait(promptNextDate!.toLocaleString(s.dateLocale))}
                  </p>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setEditOpen(false)}>
                {s.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal listar en marketplace */}
      {listOpen && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setListOpen(false)}>
          <div className="modal-box sell-modal">
            <button className="modal-close" aria-label={s.close} onClick={() => setListOpen(false)}>
              ✕
            </button>
            <h3 className="modal-title">{s.publishTitle}</h3>
            <p className="modal-sub">
              {s.publishSubLead} <strong>{s.modeUrl}</strong> {s.modeUrlHint} /{" "}
              <strong>{s.modeCode}</strong> {s.modeCodeHint}
            </p>

            <div className="sell-modal-body">
              {/* Selector de modalidad */}
              <div className="sell-type-toggle">
                <button
                  type="button"
                  className={`sell-type-opt${listingTypeDraft === "acceso" ? " active" : ""}`}
                  onClick={() => setListingTypeDraft("acceso")}
                >
                  <span className="sell-type-title">{s.modeUrl}</span>
                  <span className="sell-type-desc">{s.modeUrlDesc}</span>
                </button>
                <button
                  type="button"
                  className={`sell-type-opt${listingTypeDraft === "codigo" ? " active" : ""}`}
                  onClick={() => setListingTypeDraft("codigo")}
                >
                  <span className="sell-type-title">{s.modeCode}</span>
                  <span className="sell-type-desc">{s.modeCodeDesc}</span>
                </button>
              </div>

              {listingTypeDraft === "acceso" ? (
                <>
                  <div className="field-group">
                    <label className="field-label">{s.billingLabel}</label>
                    <select
                      className="field-input field-select"
                      value={billingDraft}
                      onChange={(e) => setBillingDraft(e.target.value as BillingModel)}
                    >
                      <option value="mensual">{s.billingMonthly}</option>
                      <option value="uso">{s.billingUsage}</option>
                    </select>
                    <p className="field-hint">
                      {s.billingHint}
                    </p>
                  </div>
                  <div className="field-group">
                    <label className="field-label">{s.modelsLabel}</label>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="GPT-4o, Claude Sonnet, Gemini..."
                      value={modelsDraft}
                      onChange={(e) => setModelsDraft(e.target.value)}
                    />
                    <p className="field-hint">{s.modelsHint}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="field-group">
                    <label className="field-label">{s.codeLabel}</label>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ width: "100%" }}
                      onClick={() => codeInputRef.current?.click()}
                    >
                      <span>{codeFile ? codeFile.name : s.pickZip}</span>
                    </button>
                    <input
                      ref={codeInputRef}
                      type="file"
                      accept=".zip,application/zip"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null
                        e.target.value = ""
                        if (f && f.size > MAX_CODE_BYTES) {
                          showToast(s.errZipSize, "warn")
                          return
                        }
                        setCodeFile(f)
                      }}
                    />
                    <p className="field-hint">
                      {s.codeHint}
                    </p>
                  </div>
                  <div className="field-group">
                    <label className="field-label">{s.gitLabel}</label>
                    <input
                      type="text"
                      className="field-input"
                      placeholder={s.gitPlaceholder}
                      value={gitRepoDraft}
                      onChange={(e) => setGitRepoDraft(e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">{s.readmeLabel}</label>
                    <textarea
                      className="field-input sell-textarea"
                      rows={4}
                      placeholder={s.readmePlaceholder}
                      value={readmeDraft}
                      onChange={(e) => setReadmeDraft(e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">{s.techLabel}</label>
                    <input
                      type="text"
                      className="field-input"
                      placeholder={s.techPlaceholder}
                      value={techDraft}
                      onChange={(e) => setTechDraft(e.target.value)}
                    />
                    <p className="field-hint">{s.techHint}</p>
                  </div>
                  <div className="field-group">
                    <label className="field-label">{s.depsLabel}</label>
                    <textarea
                      className="field-input sell-textarea"
                      rows={3}
                      placeholder={s.depsPlaceholder}
                      value={depsDraft}
                      onChange={(e) => setDepsDraft(e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">{s.licenseLabel}</label>
                    <select
                      className="field-input field-select"
                      value={licenseDraft}
                      onChange={(e) => setLicenseDraft(e.target.value)}
                    >
                      {CODE_LICENSES.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <p className="field-hint">
                      {s.licenseHint}
                    </p>
                  </div>
                </>
              )}

              {/* Comunes a ambas modalidades */}
              <div className="field-group">
                <label className="field-label">{s.sellDescLabel}</label>
                <textarea
                  className="field-input sell-textarea"
                  rows={2}
                  placeholder={s.sellDescPlaceholder}
                  value={sellDescDraft}
                  onChange={(e) => setSellDescDraft(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label className="field-label">{s.docLabel}</label>
                <textarea
                  className="field-input sell-textarea"
                  rows={3}
                  placeholder={s.docPlaceholder}
                  value={docDraft}
                  onChange={(e) => setDocDraft(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label className="field-label">{s.imageLabel}</label>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ width: "100%" }}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <span>{imageFile ? imageFile.name : s.pickImage}</span>
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={onImagePick}
                />
                <p className="field-hint">{s.imageHint}</p>
              </div>

              <div className="field-group">
                <label className="field-label">
                  {listingTypeDraft === "codigo"
                    ? s.priceOnce
                    : billingDraft === "uso"
                      ? s.priceUsage
                      : s.priceMonthly}{" "}
                  *
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    className="field-input"
                    placeholder={listingTypeDraft === "codigo" ? "149" : billingDraft === "uso" ? "2.50" : "29"}
                    step="0.01"
                    min="0"
                    value={priceDraft}
                    onChange={(e) => setPriceDraft(e.target.value)}
                  />
                  <select
                    className="field-input field-select"
                    style={{ maxWidth: 100 }}
                    value={priceUnit}
                    onChange={(e) => setPriceUnit(e.target.value as "USD" | "COP")}
                  >
                    <option value="USD">USD</option>
                    <option value="COP">COP</option>
                  </select>
                </div>
                <p className="field-hint">
                  {s.priceHint}
                </p>
              </div>

              <label className="consent-check">
                <input
                  type="checkbox"
                  checked={listAccepted}
                  onChange={(e) => setListAccepted(e.target.checked)}
                />
                <span>
                  {s.consentLead}{" "}
                  <Link href="/terminos#vendedores" target="_blank">
                    {s.consentLink}
                  </Link>
                  .
                </span>
              </label>
            </div>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setListOpen(false)}>
                {s.cancel}
              </button>
              <button
                className="btn-primary"
                disabled={publishing || !listAccepted}
                onClick={publishListing}
              >
                <span>{publishing ? s.publishing : s.publishListing}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal publicar nueva versión */}
      {verOpen && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setVerOpen(false)}>
          <div className="modal-box">
            <button className="modal-close" aria-label={s.close} onClick={() => setVerOpen(false)}>
              ✕
            </button>
            <h3 className="modal-title">{s.verTitle}</h3>
            <p className="modal-sub">
              {s.verSub}
            </p>
            <div className="field-group">
              <label className="field-label">{s.verNumLabel}</label>
              <input
                type="text"
                className="field-input"
                placeholder={s.verNumPlaceholder}
                value={verDraft}
                onChange={(e) => setVerDraft(e.target.value)}
              />
            </div>
            <div className="field-group">
              <label className="field-label">{s.verCodeLabel}</label>
              <button
                type="button"
                className="btn-ghost"
                style={{ width: "100%" }}
                onClick={() => verInputRef.current?.click()}
              >
                <span>{verFile ? verFile.name : s.pickZip}</span>
              </button>
              <input
                ref={verInputRef}
                type="file"
                accept=".zip,application/zip"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  e.target.value = ""
                  if (f && f.size > MAX_CODE_BYTES) {
                    showToast(s.errZipSize, "warn")
                    return
                  }
                  setVerFile(f)
                }}
              />
            </div>
            <div className="field-group">
              <label className="field-label">{s.changelogLabel}</label>
              <textarea
                className="field-input sell-textarea"
                rows={3}
                placeholder={s.changelogPlaceholder}
                value={changelogDraft}
                onChange={(e) => setChangelogDraft(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setVerOpen(false)}>
                {s.cancel}
              </button>
              <button className="btn-primary" disabled={publishingVer} onClick={publishVersion}>
                <span>{publishingVer ? s.publishing : s.publishVer}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal archivar agente */}
      {archiveOpen && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setArchiveOpen(false)}>
          <div className="modal-box">
            <button className="modal-close" aria-label={s.close} onClick={() => setArchiveOpen(false)}>
              ✕
            </button>
            <h3 className="modal-title">{s.archiveTitle(initialAgent.name)}</h3>
            <p className="modal-sub">
              {s.archiveSub}
            </p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setArchiveOpen(false)}>
                {s.cancel}
              </button>
              <button className="btn-primary" disabled={archiving} onClick={confirmArchiveAgent}>
                <span>{archiving ? s.archiving : s.archiveAgent}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
