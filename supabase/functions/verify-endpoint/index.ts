// Verifica que el endpoint de un agente responda correctamente al formato
// esperado por Umbra. Corre server-side para evitar problemas de CORS al
// contactar URLs arbitrarias provistas por el usuario.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// ─── Protección SSRF ──────────────────────────────────────────────────────────
// Impide que un endpoint apunte a la red interna, loopback, link-local o al
// servicio de metadatos de la nube (169.254.169.254). Valida el literal IP y,
// para dominios, resuelve DNS y verifica TODAS las IPs resueltas.
function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map((n) => Number(n))
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true
  const [a, b] = p
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true // link-local + metadatos de la nube
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // multicast / reservado
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "")
  if (v === "::1" || v === "::") return true
  if (v.startsWith("fc") || v.startsWith("fd")) return true // unique-local
  if (v.startsWith("fe80")) return true // link-local
  if (v.startsWith("::ffff:")) {
    const tail = v.split(":").pop() ?? ""
    if (tail.includes(".")) return isPrivateIPv4(tail)
  }
  return false
}

async function assertSafeEndpoint(rawUrl: string): Promise<void> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error("URL inválida")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Protocolo no permitido")
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "")

  if (
    host === "localhost" ||
    host === "metadata" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost")
  ) {
    throw new Error("Host interno no permitido")
  }

  const isV4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  const isV6 = host.includes(":")

  if (isV4) {
    if (isPrivateIPv4(host)) throw new Error("IP privada no permitida")
    return
  }
  if (isV6) {
    if (isPrivateIPv6(host)) throw new Error("IP privada no permitida")
    return
  }

  // Dominio: resolver DNS y verificar todas las IPs (cuando el runtime lo permite).
  const resolveDns = (Deno as { resolveDns?: typeof Deno.resolveDns }).resolveDns
  if (typeof resolveDns !== "function") return

  const addrs: string[] = []
  const [v4, v6] = await Promise.allSettled([
    resolveDns(host, "A"),
    resolveDns(host, "AAAA"),
  ])
  if (v4.status === "fulfilled") addrs.push(...v4.value)
  if (v6.status === "fulfilled") addrs.push(...v6.value)
  if (addrs.length === 0) throw new Error("El dominio no resuelve")
  for (const ip of addrs) {
    if (ip.includes(":") ? isPrivateIPv6(ip) : isPrivateIPv4(ip)) {
      throw new Error("El dominio resuelve a una IP privada")
    }
  }
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

    try {
      await assertSafeEndpoint(endpoint)
    } catch {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "Ese endpoint no está permitido: apunta a una dirección interna o no válida.",
        }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      )
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
        redirect: "error",
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
