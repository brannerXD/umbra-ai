// Prueba un agente de prompt antes de registrarlo.
//
// El usuario escribe su prompt de sistema y una pregunta de ejemplo, y ve la
// respuesta al instante. Es el equivalente al "Verificar endpoint" de los
// agentes que se despliegan por fuera: sirve para que nadie registre un agente
// sin haberlo visto funcionar.
//
// Requiere sesión (verify_jwt), porque cada llamada consume modelo.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const GROQ_MODEL = "llama-3.3-70b-versatile"
const GEMINI_MODEL = "gemini-flash-lite-latest"

const MAX_SYSTEM_PROMPT = 4000
const MAX_PROMPT = 2000
const MAX_TOKENS = 900

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

async function conGemini(apiKey: string, systemPrompt: string, prompt: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.7 },
    }),
  })
  if (!res.ok) {
    console.error("probar-agente/gemini", res.status, await res.text().catch(() => ""))
    return null
  }
  const data = await res.json()
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  return text.trim() || null
}

async function conGroq(apiKey: string, systemPrompt: string, prompt: string): Promise<string | null> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    }),
  })
  if (!res.ok) {
    console.error("probar-agente/groq", res.status, await res.text().catch(() => ""))
    return null
  }
  const data = await res.json()
  const text: string = data?.choices?.[0]?.message?.content ?? ""
  return text.trim() || null
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })

  const geminiKey = Deno.env.get("GEMINI_API_KEY")
  const groqKey = Deno.env.get("GROQ_API_KEY")
  if (!geminiKey && !groqKey) {
    return json({ ok: false, message: "El motor de agentes no está configurado." }, 500)
  }

  try {
    const body = await req.json().catch(() => null)
    const systemPrompt = typeof body?.systemPrompt === "string" ? body.systemPrompt.trim() : ""
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : ""

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
    let respuesta: string | null = null
    if (geminiKey) respuesta = await conGemini(geminiKey, systemPrompt, prompt)
    if (!respuesta && groqKey) respuesta = await conGroq(groqKey, systemPrompt, prompt)

    if (!respuesta) {
      return json({ ok: false, message: "El modelo no devolvió respuesta. Intenta de nuevo." }, 502)
    }

    return json({ ok: true, respuesta, ms: Date.now() - started })
  } catch (err) {
    console.error("probar-agente falló", err)
    return json({ ok: false, message: "Error interno probando el agente." }, 500)
  }
})
