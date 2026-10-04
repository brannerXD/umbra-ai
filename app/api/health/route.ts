// ========================================
// SALUD — GET /api/health
// ========================================
// Comprueba, sin exponer ningún secreto, que las piezas críticas funcionan:
//   - la llave secreta de Supabase del servidor (SUPABASE_SECRET_KEY): sirve
//     para confirmar una rotación de llaves sin adivinar,
//   - la red de Solana activa para los sellos y el saldo de su wallet (ambos
//     datos son públicos en la cadena de todas formas).

import { createClient } from "@supabase/supabase-js"
import { ATTESTER_WALLETS, type SolanaCluster } from "@/lib/solana"

export const dynamic = "force-dynamic"

// Lectura desde el SERVIDOR (sin cabecera Origin): el RPC oficial responde.
const SERVER_RPC: Record<SolanaCluster, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
}

async function balanceOf(cluster: SolanaCluster, address: string): Promise<number | null> {
  try {
    const res = await fetch(SERVER_RPC[cluster], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [address] }),
      cache: "no-store",
    })
    const data = await res.json()
    return typeof data?.result?.value === "number" ? data.result.value : null
  } catch {
    return null
  }
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  // 1. Llave secreta: sólo service_role puede leer internal_config.
  let serviceKeyStatus: "ok" | "invalida" | "falta" = "falta"
  let cluster: SolanaCluster = "devnet"
  if (url && serviceKey) {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    const { data, error } = await admin.from("internal_config").select("key, value").eq("key", "solana_cluster")
    if (error) {
      serviceKeyStatus = "invalida"
    } else {
      serviceKeyStatus = "ok"
      if (data?.[0]?.value === "mainnet-beta") cluster = "mainnet-beta"
    }
  }

  // 2. Wallet de sellos de la red activa.
  const wallet = ATTESTER_WALLETS[cluster]
  const lamports = await balanceOf(cluster, wallet)

  const ok = serviceKeyStatus === "ok" && lamports !== null
  return Response.json(
    {
      ok,
      supabaseSecretKey: serviceKeyStatus,
      solana: {
        cluster,
        wallet,
        balanceSol: lamports === null ? null : lamports / 1e9,
        // Cada sello cuesta ~0.000005 SOL; en mainnet se reserva 0.001 SOL que
        // nunca se gasta (mínimo de Solana para mantener viva la cuenta).
        sellosRestantesAprox:
          lamports === null
            ? null
            : Math.max(0, Math.floor((lamports - (cluster === "mainnet-beta" ? 1_000_000 : 10_000)) / 5000)),
      },
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  )
}
