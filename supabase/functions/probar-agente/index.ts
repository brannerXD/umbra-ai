// Prueba un agente de prompt antes de registrarlo.
//
// El usuario escribe su prompt de sistema, PEGA SU PROPIA API KEY de Gemini, y
// una pregunta de ejemplo, y ve la respuesta al instante. La llave la trae el
// creador (BYOK): así cada quien paga su propio consumo de IA, no Umbra.
//
// Requiere sesión (verify_jwt), porque coordina una llamada a un modelo.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

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

/** Ejecuta el prompt del creador contra Gemini usando LA LLAVE DEL CREADOR. */
async function conGemini(apiKey: string, systemPrompt: string, prompt: string): Promise<
  { ok: true; text: string } | { ok: false; status: number }
> {
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
    return { ok: false, status: res.status }
  }
  const data = await res.json()
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  return text.trim() ? { ok: true, text: text.trim() } : { ok: false, status: 502 }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })

  try {
    const body = await req.json().catch(() => null)
    const systemPrompt = typeof body?.systemPrompt === "string" ? body.systemPrompt.trim() : ""
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : ""
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : ""

    if (!apiKey) {
      return json({ ok: false, message: "Pega primero tu API key de Gemini." }, 400)
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
    const r = await conGemini(apiKey, systemPrompt, prompt)

    if (!r.ok) {
      // 400/403 casi siempre = llave inválida o sin permisos.
      const msg =
        r.status === 400 || r.status === 403
          ? "Tu API key no es válida o no tiene permiso. Revísala e intenta de nuevo."
          : "El modelo no respondió. Intenta de nuevo en un momento."
      return json({ ok: false, message: msg }, 502)
    }

    return json({ ok: true, respuesta: r.text, ms: Date.now() - started })
  } catch (err) {
    console.error("probar-agente falló", err)
    return json({ ok: false, message: "Error interno probando el agente." }, 500)
  }
})
