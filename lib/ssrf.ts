// ========================================
// PROTECCION SSRF
// ========================================
// Umbra contacta URLs que provee el vendedor. Sin esta validacion, alguien
// podria registrar un agente apuntando a la red interna (o al servicio de
// metadatos de la nube, 169.254.169.254) y usar nuestro servidor como puente
// para leerla.
//
// Es un port de la logica ya usada en la edge function verify-endpoint, para
// que el proxy de /api/v1/run aplique exactamente el mismo criterio.

import { lookup } from "node:dns/promises"

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

/** Lanza si la URL no es segura para que la contacte el servidor. */
export async function assertSafeEndpoint(rawUrl: string): Promise<void> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error("URL invalida")
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

  // Dominio: resolver DNS y verificar TODAS las IPs a las que apunta, no solo
  // la primera. Un dominio puede resolver a varias y basta una privada.
  let addrs: { address: string }[]
  try {
    addrs = await lookup(host, { all: true })
  } catch {
    throw new Error("El dominio no resuelve")
  }
  if (addrs.length === 0) throw new Error("El dominio no resuelve")

  for (const { address } of addrs) {
    const priv = address.includes(":") ? isPrivateIPv6(address) : isPrivateIPv4(address)
    if (priv) throw new Error("El dominio resuelve a una IP privada")
  }
}
