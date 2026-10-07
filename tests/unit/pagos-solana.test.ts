// Pruebas del riel de pagos en USDC (lib/pagos-solana.ts). Sin red: la
// verificación es la pieza que decide si se entrega un producto, así que se
// prueba por separado de cualquier RPC.

import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  PAY_DECIMALS,
  base58Encode,
  baseUnitsADecimal,
  buscarPago,
  centavosABaseUnits,
  construirUrlSolanaPay,
  esDireccionSolana,
  evaluarTransferencia,
  generarReferencia,
  type ConfigPagoSolana,
  type TransaccionParseada,
} from "../../lib/pagos-solana.ts"

const DESTINO = "6xBKjoTBabB5zrboXweLd6N14T87vcD5aq1mFxGTNutK"
const MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
const REF = "BDsEnYJ525WNMv9t2oBiAf8r3svqvraTcCP52nkAmWZg"
const OTRO_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
const OTRO_OWNER = "11111111111111111111111111111112"

interface Opciones {
  err?: unknown
  referencia?: string | null
  pre?: string | null
  post?: string
  mint?: string
  owner?: string
  formaString?: boolean
}

/** Transacción sintética en el formato jsonParsed de getTransaction. */
function tx(o: Opciones = {}): TransaccionParseada {
  const owner = o.owner ?? DESTINO
  const mint = o.mint ?? MINT
  const claves = ["Pagador1111111111111111111111111111111111", "CuentaDestino111111111111111111111111111111"]
  if (o.referencia !== null) claves.push(o.referencia ?? REF)
  return {
    meta: {
      err: o.err ?? null,
      preTokenBalances: o.pre === null ? [] : [{ owner, mint, uiTokenAmount: { amount: o.pre ?? "0" } }],
      postTokenBalances: [{ owner, mint, uiTokenAmount: { amount: o.post ?? "5000000" } }],
    },
    transaction: {
      message: {
        accountKeys: o.formaString ? claves : claves.map((pubkey) => ({ pubkey })),
      },
    },
  }
}

const esperado = { destino: DESTINO, mint: MINT, minimoBase: 5_000_000n, referencia: REF }

describe("conversión de montos", () => {
  test("USDC tiene 6 decimales y 1 centavo son 10.000 unidades", () => {
    assert.equal(PAY_DECIMALS, 6)
    assert.equal(centavosABaseUnits(1), 10_000n)
    assert.equal(centavosABaseUnits(500), 5_000_000n)
    assert.equal(centavosABaseUnits(1999), 19_990_000n)
  })

  test("rechaza centavos inválidos", () => {
    assert.throws(() => centavosABaseUnits(0))
    assert.throws(() => centavosABaseUnits(-5))
    assert.throws(() => centavosABaseUnits(1.5))
    assert.throws(() => centavosABaseUnits(Number.NaN))
  })

  test("baseUnitsADecimal sin ceros sobrantes ni notación científica", () => {
    assert.equal(baseUnitsADecimal(5_000_000n), "5")
    assert.equal(baseUnitsADecimal(1_500_000n), "1.5")
    assert.equal(baseUnitsADecimal(10_000n), "0.01")
    assert.equal(baseUnitsADecimal(1n), "0.000001")
    assert.equal(baseUnitsADecimal(19_990_000n), "19.99")
    assert.equal(baseUnitsADecimal(0n), "0")
  })
})

describe("base58 y referencias", () => {
  test("base58 coincide con el vector conocido", () => {
    assert.equal(base58Encode(new TextEncoder().encode("Hello World!")), "2NEpo7TZRRrLZSi2U")
  })

  test("los ceros iniciales se codifican como '1'", () => {
    assert.equal(base58Encode(new Uint8Array([0, 0, 1])), "112")
    assert.equal(base58Encode(new Uint8Array([])), "")
  })

  test("una referencia es una dirección válida y nunca se repite", () => {
    const vistas = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const r = generarReferencia()
      assert.ok(esDireccionSolana(r), `no parece una dirección: ${r}`)
      vistas.add(r)
    }
    assert.equal(vistas.size, 200)
  })

  test("esDireccionSolana rechaza lo que no es una dirección", () => {
    assert.ok(esDireccionSolana(DESTINO))
    assert.ok(!esDireccionSolana(""))
    assert.ok(!esDireccionSolana("corta"))
    assert.ok(!esDireccionSolana(DESTINO + "0")) // '0' no existe en base58
    assert.ok(!esDireccionSolana(`${DESTINO}?x=1`))
  })
})

describe("URL Solana Pay", () => {
  const url = construirUrlSolanaPay({
    destino: DESTINO,
    mint: MINT,
    montoBase: 1_500_000n,
    referencia: REF,
    mensaje: "Umbra — Agente & Co",
    memo: "umbra:pay:abc",
  })

  test("sigue el formato del estándar", () => {
    assert.ok(url.startsWith(`solana:${DESTINO}?`))
    const q = new URLSearchParams(url.slice(url.indexOf("?") + 1))
    assert.equal(q.get("amount"), "1.5")
    assert.equal(q.get("spl-token"), MINT)
    assert.equal(q.get("reference"), REF)
    assert.equal(q.get("memo"), "umbra:pay:abc")
  })

  test("el texto libre va codificado y no puede colar parámetros", () => {
    const q = new URLSearchParams(url.slice(url.indexOf("?") + 1))
    assert.equal(q.get("message"), "Umbra — Agente & Co")
    const mal = construirUrlSolanaPay({
      destino: DESTINO,
      mint: MINT,
      montoBase: 1_000_000n,
      referencia: REF,
      mensaje: "x&amount=0.000001&spl-token=otro",
    })
    const qm = new URLSearchParams(mal.slice(mal.indexOf("?") + 1))
    assert.equal(qm.get("amount"), "1")
    assert.equal(qm.get("spl-token"), MINT)
  })
})

describe("evaluarTransferencia — decide si se entrega el producto", () => {
  test("pago exacto con la referencia: se acepta", () => {
    const r = evaluarTransferencia(tx(), esperado)
    assert.ok(r.ok)
    assert.equal(r.recibido, 5_000_000n)
  })

  test("pagar de más se acepta", () => {
    assert.ok(evaluarTransferencia(tx({ post: "7000000" }), esperado).ok)
  })

  test("pagar de menos se rechaza (aunque sea 1 unidad)", () => {
    const r = evaluarTransferencia(tx({ post: "4999999" }), esperado)
    assert.ok(!r.ok)
    assert.equal(r.motivo, "monto_insuficiente")
  })

  test("cuenta con saldo previo: sólo cuenta lo que entró en ESTA transacción", () => {
    // La tesorería ya tenía 100 USDC; esta transacción sólo sumó 1.
    const r = evaluarTransferencia(tx({ pre: "100000000", post: "101000000" }), esperado)
    assert.ok(!r.ok)
    assert.equal(r.recibido, 1_000_000n)
    // Y con el monto completo sí pasa.
    assert.ok(evaluarTransferencia(tx({ pre: "100000000", post: "105000000" }), esperado).ok)
  })

  test("una cuenta de token recién creada (sin saldo previo) cuenta desde 0", () => {
    assert.ok(evaluarTransferencia(tx({ pre: null, post: "5000000" }), esperado).ok)
  })

  test("sin la referencia en la transacción: se rechaza", () => {
    const r = evaluarTransferencia(tx({ referencia: null }), esperado)
    assert.ok(!r.ok)
    assert.equal(r.motivo, "sin_referencia")
  })

  test("la referencia de OTRA compra no sirve", () => {
    const r = evaluarTransferencia(tx({ referencia: OTRO_OWNER }), esperado)
    assert.ok(!r.ok)
    assert.equal(r.motivo, "sin_referencia")
  })

  test("transacción fallida: se rechaza aunque los saldos parezcan correctos", () => {
    const r = evaluarTransferencia(tx({ err: { InstructionError: [0, "Custom"] } }), esperado)
    assert.ok(!r.ok)
    assert.equal(r.motivo, "fallida")
  })

  test("otro token (mint) no cuenta, aunque el monto sea el pedido", () => {
    const r = evaluarTransferencia(tx({ mint: OTRO_MINT }), esperado)
    assert.ok(!r.ok)
    assert.equal(r.motivo, "monto_insuficiente")
  })

  test("dinero que llega a OTRA wallet no cuenta", () => {
    const r = evaluarTransferencia(tx({ owner: OTRO_OWNER }), esperado)
    assert.ok(!r.ok)
    assert.equal(r.motivo, "monto_insuficiente")
  })

  test("sin transacción o sin metadatos: se rechaza", () => {
    assert.equal((evaluarTransferencia(null, esperado) as { motivo: string }).motivo, "sin_transaccion")
    const sinMeta = { ...tx(), meta: null }
    assert.equal((evaluarTransferencia(sinMeta, esperado) as { motivo: string }).motivo, "sin_transaccion")
  })

  test("acepta cuentas como texto (formato no parseado) y como objetos", () => {
    assert.ok(evaluarTransferencia(tx({ formaString: true }), esperado).ok)
    assert.ok(evaluarTransferencia(tx({ formaString: false }), esperado).ok)
  })

  test("un monto que no cabe en un Number sigue comparándose bien", () => {
    const grande = { ...esperado, minimoBase: 9_007_199_254_740_993n }
    assert.ok(!evaluarTransferencia(tx({ post: "9007199254740992" }), grande).ok)
    assert.ok(evaluarTransferencia(tx({ post: "9007199254740993" }), grande).ok)
  })
})

describe("buscarPago — con un RPC simulado", () => {
  const cfg: ConfigPagoSolana = {
    destino: DESTINO,
    mint: MINT,
    cluster: "mainnet-beta",
    rpcUrls: ["https://rpc-a.test", "https://rpc-b.test"],
    commitment: "finalized",
  }
  const pedido = { minimoBase: 5_000_000n, referencia: REF }

  type Handler = (url: string, method: string, params: unknown[]) => unknown | Error
  function rpcSimulado(handler: Handler): { fetchFn: typeof fetch; llamadas: string[] } {
    const llamadas: string[] = []
    const fetchFn = (async (url: string, init: RequestInit) => {
      const { method, params } = JSON.parse(String(init.body))
      llamadas.push(`${url}#${method}`)
      const r = handler(url, method, params)
      if (r instanceof Error) throw r
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: r }), { status: 200 })
    }) as unknown as typeof fetch
    return { fetchFn, llamadas }
  }

  test("sin transacciones con esa referencia: pendiente", async () => {
    const { fetchFn } = rpcSimulado(() => [])
    assert.deepEqual(await buscarPago(cfg, pedido, fetchFn), { estado: "pendiente" })
  })

  test("encuentra y valida el pago", async () => {
    const { fetchFn } = rpcSimulado((_u, m) =>
      m === "getSignaturesForAddress" ? [{ signature: "sigOK", err: null }] : tx(),
    )
    const r = await buscarPago(cfg, pedido, fetchFn)
    assert.deepEqual(r, { estado: "pagado", signature: "sigOK", recibido: 5_000_000n })
  })

  test("ignora el señuelo con menos dinero y toma el pago real", async () => {
    const { fetchFn } = rpcSimulado((_u, m, p) => {
      if (m === "getSignaturesForAddress") {
        return [
          { signature: "senuelo", err: null },
          { signature: "fallida", err: { InstructionError: [0, "x"] } },
          { signature: "real", err: null },
        ]
      }
      return (p[0] as string) === "senuelo" ? tx({ post: "10" }) : tx()
    })
    const r = await buscarPago(cfg, pedido, fetchFn)
    assert.equal(r.estado, "pagado")
    assert.equal((r as { signature: string }).signature, "real")
  })

  test("sólo señuelos: sigue pendiente", async () => {
    const { fetchFn } = rpcSimulado((_u, m) =>
      m === "getSignaturesForAddress" ? [{ signature: "s1", err: null }] : tx({ post: "1" }),
    )
    assert.deepEqual(await buscarPago(cfg, pedido, fetchFn), { estado: "pendiente" })
  })

  test("si un RPC falla, rota al siguiente y sigue", async () => {
    const { fetchFn, llamadas } = rpcSimulado((url, m) => {
      if (url.includes("rpc-a")) return new Error("503")
      return m === "getSignaturesForAddress" ? [{ signature: "s", err: null }] : tx()
    })
    const r = await buscarPago(cfg, pedido, fetchFn)
    assert.equal(r.estado, "pagado")
    assert.ok(llamadas.some((l) => l.startsWith("https://rpc-b.test")))
  })

  test("sin red no se confunde con 'no ha pagado'", async () => {
    const { fetchFn } = rpcSimulado(() => new Error("sin conexión"))
    assert.deepEqual(await buscarPago(cfg, pedido, fetchFn), { estado: "sin_red" })
  })

  test("pide los datos con el nivel de confirmación configurado", async () => {
    const vistos: unknown[] = []
    const { fetchFn } = rpcSimulado((_u, m, p) => {
      vistos.push(p)
      return m === "getSignaturesForAddress" ? [{ signature: "s", err: null }] : tx()
    })
    await buscarPago(cfg, pedido, fetchFn)
    assert.deepEqual(vistos[0], [REF, { limit: 20, commitment: "finalized" }])
    assert.equal((vistos[1] as unknown[])[1] && ((vistos[1] as [string, { commitment: string }])[1].commitment), "finalized")
  })
})

describe("transacción REAL de devnet (fixture)", () => {
  // Pago hecho de verdad en Solana devnet con token y wallets desechables:
  // transferencia SPL con la referencia como cuenta extra + memo. Comprueba que
  // el evaluador entiende el formato real de getTransaction, no sólo el simulado.
  const f = JSON.parse(
    readFileSync(new URL("./fixtures/solana-pay-devnet.json", import.meta.url), "utf8"),
  ) as {
    destino: string
    mint: string
    referencia: string
    signature: string
    minimoBase: string
    tx: TransaccionParseada
  }
  const real = { destino: f.destino, mint: f.mint, minimoBase: BigInt(f.minimoBase), referencia: f.referencia }

  test("el pago real se acepta y recibe exactamente 5 USDC", () => {
    const r = evaluarTransferencia(f.tx, real)
    assert.ok(r.ok)
    assert.equal(r.recibido, 5_000_000n)
  })

  test("exigir un centavo más de lo pagado lo rechaza", () => {
    const r = evaluarTransferencia(f.tx, { ...real, minimoBase: 5_010_000n })
    assert.ok(!r.ok)
    assert.equal(r.motivo, "monto_insuficiente")
  })

  test("con la referencia de otra compra no vale", () => {
    const r = evaluarTransferencia(f.tx, { ...real, referencia: REF })
    assert.ok(!r.ok)
    assert.equal(r.motivo, "sin_referencia")
  })

  test("otra tesorería u otro mint: no vale", () => {
    assert.ok(!evaluarTransferencia(f.tx, { ...real, destino: DESTINO }).ok)
    assert.ok(!evaluarTransferencia(f.tx, { ...real, mint: MINT }).ok)
  })

  test("la misma transacción NO vale como pago de otra referencia", () => {
    // Defensa contra reutilizar una firma ajena para otra compra.
    const r = evaluarTransferencia(f.tx, { ...real, referencia: generarReferencia() })
    assert.ok(!r.ok)
  })
})
