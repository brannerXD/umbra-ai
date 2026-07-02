// Verifica que el endpoint de un agente responda correctamente al formato
// esperado por Umbra. Corre server-side para evitar problemas de CORS al
// contactar URLs arbitrarias provistas por el usuario.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  try {
    const { endpoint } = await req.json()
    if (!endpoint || typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
      return new Response(JSON.stringify({ ok: false, message: "URL invalida. Debe usar HTTPS." }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const started = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Responde con una sola palabra: listo." }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const ms = Date.now() - started

      if (!res.ok) {
        return new Response(
          JSON.stringify({ ok: false, message: `El endpoint respondió con estado ${res.status}.` }),
          { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        )
      }

      const body = await res.json().catch(() => null)
      if (!body || typeof body.respuesta !== "string") {
        return new Response(
          JSON.stringify({
            ok: false,
            message: 'El endpoint no devolvió el formato esperado: { "respuesta": "string" }.',
          }),
          { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
        )
      }

      return new Response(JSON.stringify({ ok: true, ms }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    } catch (err) {
      clearTimeout(timeout)
      const timedOut = err instanceof Error && err.name === "AbortError"
      return new Response(
        JSON.stringify({
          ok: false,
          message: timedOut
            ? "El endpoint no respondió dentro de 10 segundos."
            : "No pudimos conectarnos a ese endpoint. Verifica que la URL sea correcta y el servidor esté activo.",
        }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      )
    }
  } catch {
    return new Response(JSON.stringify({ ok: false, message: "Solicitud invalida." }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }
})
