// Prueba un agente de prompt antes de registrarlo.
//
// El creador escribe su prompt de sistema, PEGA SU PROPIA API KEY (de cualquier
// proveedor de IA compatible) y una pregunta de ejemplo, y ve la respuesta al
// instante. La llave la trae el creador (BYOK): así cada quien paga su propio
// consumo de IA, no Umbra.
//
// Requiere sesión (verify_jwt), porque coordina una llamada a un modelo.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const MAX_SYSTEM_PROMPT = 4000
const MAX_PROMPT = 2000
const MAX_TOKENS = 900

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

// Detecta el proveedor de IA por el formato de la llave. Casi todos hablan el
// formato de OpenAI (mismo request/response); Anthropic y Google tienen el suyo.
interface Provider {
  kind: "openai" | "anthropic" | "gemini"
  url: string
  model: string
}

function detectProvider(apiKey: string): Provider | null {
  const k = apiKey.trim()
  if (k.startsWith("sk-ant-")) return { kind: "anthropic", url: "https://api.anthropic.com/v1/messages", model: "claude-3-5-haiku-latest" }
  if (k.startsWith("sk-or-"))  return { kind: "openai", url: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-4o-mini" }
  if (k.startsWith("gsk_"))    return { kind: "openai", url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile" }
  if (k.startsWith("xai-"))    return { kind: "openai", url: "https://api.x.ai/v1/chat/completions", model: "grok-2-latest" }
  if (k.startsWith("AIza"))    return { kind: "gemini", url: "", model: "gemini-flash-lite-latest" }
  if (k.startsWith("sk-"))     return { kind: "openai", url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" }
  return null
}

type ModelResult = { ok: true; text: string } | { ok: false; status: number }

// status 415 = formato de llave no reconocido (proveedor no soportado).
async function callModel(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
): Promise<ModelResult> {
  const p = detectProvider(apiKey)
  if (!p) return { ok: false, status: 415 }

  if (p.kind === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${p.model}:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
      }),
    })
    if (!res.ok) {
      console.error("callModel/gemini", res.status, await res.text().catch(() => ""))
      return { ok: false, status: res.status }
    }
    const data = await res.json()
    const text: string = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim()
    return text ? { ok: true, text } : { ok: false, status: 502 }
  }

  if (p.kind === "anthropic") {
    const res = await fetch(p.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: p.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    })
    if (!res.ok) {
      console.error("callModel/anthropic", res.status, await res.text().catch(() => ""))
      return { ok: false, status: res.status }
    }
    const data = await res.json()
    const text: string = (data?.content?.[0]?.text ?? "").trim()
    return text ? { ok: true, text } : { ok: false, status: 502 }
  }

  // OpenAI-compatible (OpenAI, Groq, OpenRouter, xAI, y muchos otros).
  const res = await fetch(p.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: p.model,
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  })
  if (!res.ok) {
    console.error("callModel/openai", res.status, await res.text().catch(() => ""))
    return { ok: false, status: res.status }
  }
  const data = await res.json()
  const text: string = (data?.choices?.[0]?.message?.content ?? "").trim()
  return text ? { ok: true, text } : { ok: false, status: 502 }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })

  try {
    const body = await req.json().catch(() => null)
    const systemPrompt = typeof body?.systemPrompt === "string" ? body.systemPrompt.trim() : ""
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : ""
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : ""

    if (!apiKey) {
      return json({ ok: false, message: "Pega primero tu API key." }, 400)
    }
    if (!systemPrompt) {
      return json({ ok: false, message: "Escribe primero las instrucciones de tu agente." }, 400)
    }
    if (!prompt) {
      return json({ ok: false, message: "Escribe una pregunta de prueba." }, 400)
    }
    if (systemPrompt.length > MAX_SYSTEM_PROMPT) {
      return json({ ok: false, message: `Las instrucciones no pueden pasar de ${MAX_SYSTEM_PROMPT} caracteres.` }, 400)
    }
    if (prompt.length > MAX_PROMPT) {
      return json({ ok: false, message: `La pregunta no puede pasar de ${MAX_PROMPT} caracteres.` }, 400)
    }

    const started = Date.now()
    const r = await callModel(apiKey, systemPrompt, prompt, MAX_TOKENS)

    if (!r.ok) {
      let msg: string
      if (r.status === 415) {
        msg = "No reconocemos el formato de tu API key. Aceptamos llaves con formato sk-…, sk-ant-…, AIza…, gsk_…, sk-or-… o xai-…"
      } else if (r.status === 400 || r.status === 401 || r.status === 403) {
        msg = "Tu API key no es válida o no tiene permiso. Revísala e intenta de nuevo."
      } else {
        msg = "El modelo no respondió. Intenta de nuevo en un momento."
      }
      return json({ ok: false, message: msg }, 502)
    }

    return json({ ok: true, respuesta: r.text, ms: Date.now() - started })
  } catch (err) {
    console.error("probar-agente falló", err)
    return json({ ok: false, message: "Error interno probando el agente." }, 500)
  }
})
