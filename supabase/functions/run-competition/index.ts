// Ejecuta una competencia completa:
// 1. Llama al endpoint de cada agente inscrito con el prompt de la competencia.
// 2. Evalúa las respuestas con un LLM (Groq) según la rúbrica (accuracy/reasoning/structure/utility).
// 3. Guarda evaluaciones, determina el ganador y actualiza las estadísticas de los agentes.
//
// Usa la service role key (inyectada automáticamente por Supabase) para poder
// escribir en tablas que los clientes anónimos no pueden modificar.

import { createClient } from "npm:@supabase/supabase-js@2"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const AGENT_TIMEOUT_MS = 10000
const JUDGE_MODEL = "llama-3.3-70b-versatile"

interface AgentAnswer {
  entryId: string
  agentId: string
  agentName: string
  response: string | null
  responseTimeMs: number | null
}

async function callAgent(endpoint: string, prompt: string): Promise<{ response: string | null; ms: number | null }> {
  const started = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS)
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return { response: null, ms: null }
    const body = await res.json().catch(() => null)
    if (!body || typeof body.respuesta !== "string") return { response: null, ms: null }
    return { response: body.respuesta, ms: Date.now() - started }
  } catch {
    clearTimeout(timeout)
    return { response: null, ms: null }
  }
}

interface Judged {
  accuracy: number
  reasoning: number
  structure: number
  utility: number
  comments: string
}

async function judgeWithGroq(
  apiKey: string,
  prompt: string,
  answers: AgentAnswer[],
): Promise<Record<string, Judged>> {
  const respondents = answers.filter((a) => a.response !== null)
  if (respondents.length === 0) return {}

  const rubric = `Eres el juez de una competencia de agentes de IA. Evalúa cada respuesta del 0 al 100 según:
- accuracy: ¿la respuesta es factualmente correcta y completa?
- reasoning: ¿el razonamiento detrás de la respuesta es sólido?
- structure: ¿es clara, bien organizada y fácil de leer?
- utility: ¿es útil y aplicable al contexto pedido?

PROMPT ORIGINAL:
${prompt}

RESPUESTAS A EVALUAR:
${respondents.map((a) => `### ${a.agentName}\n${a.response}`).join("\n\n")}

Responde ÚNICAMENTE con JSON válido, sin texto adicional, con esta forma exacta:
{"${respondents[0].agentName}": {"accuracy": 0, "reasoning": 0, "structure": 0, "utility": 0, "comments": "..."}, ...un objeto por cada agente listado arriba}`

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: rubric }],
    }),
  })

  if (!res.ok) {
    console.error("Groq API error", res.status, await res.text().catch(() => ""))
    return {}
  }

  const data = await res.json()
  const text: string = data?.choices?.[0]?.message?.content ?? ""
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return {}

  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    return {}
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const groqKey = Deno.env.get("GROQ_API_KEY")

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    const { competitionId } = await req.json()
    if (!competitionId) {
      return new Response(JSON.stringify({ ok: false, message: "Falta competitionId." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    if (!groqKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "Falta configurar el secreto GROQ_API_KEY en el proyecto de Supabase.",
        }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      )
    }

    const { data: comp, error: compError } = await supabase
      .from("competitions")
      .select("*")
      .eq("id", competitionId)
      .single()

    if (compError || !comp) {
      return new Response(JSON.stringify({ ok: false, message: "Competencia no encontrada." }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    if (comp.status === "completada") {
      return new Response(JSON.stringify({ ok: false, message: "Esta competencia ya finalizó." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const { data: entries, error: entriesError } = await supabase
      .from("competition_entries")
      .select("id, agent_id, agents(id, name, endpoint)")
      .eq("competition_id", competitionId)

    if (entriesError || !entries || entries.length === 0) {
      return new Response(JSON.stringify({ ok: false, message: "No hay agentes inscritos." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const now = new Date()
    const endsAt = new Date(now.getTime() + 10 * 60 * 1000)
    await supabase
      .from("competitions")
      .update({ status: "en-curso", started_at: now.toISOString(), ends_at: endsAt.toISOString() })
      .eq("id", competitionId)

    // 1. Llamar a cada agente en paralelo.
    interface EntryWithAgent {
      id: string
      agent_id: string
      agents: { id: string; name: string; endpoint: string | null } | null
    }
    const answers: AgentAnswer[] = await Promise.all(
      (entries as EntryWithAgent[]).map(async (e) => {
        const agent = e.agents
        if (!agent?.endpoint) {
          return { entryId: e.id, agentId: e.agent_id, agentName: agent?.name ?? "—", response: null, responseTimeMs: null }
        }
        const { response, ms } = await callAgent(agent.endpoint, comp.prompt ?? "")
        return { entryId: e.id, agentId: e.agent_id, agentName: agent.name, response, responseTimeMs: ms }
      }),
    )

    // 2. Guardar las respuestas.
    await Promise.all(
      answers.map((a) =>
        supabase
          .from("competition_entries")
          .update({ response: a.response, response_time_ms: a.responseTimeMs })
          .eq("id", a.entryId),
      ),
    )

    // 3. Evaluar con Groq.
    const judged = await judgeWithGroq(groqKey, comp.prompt ?? "", answers)

    // 4. Guardar evaluaciones y puntajes finales.
    const scored = await Promise.all(
      answers.map(async (a) => {
        const j = judged[a.agentName]
        if (!j) return { ...a, finalScore: null }
        const finalScore = Math.round((j.accuracy + j.reasoning + j.structure + j.utility) / 4)
        await supabase.from("evaluations").insert({
          entry_id: a.entryId,
          accuracy: j.accuracy,
          reasoning: j.reasoning,
          structure: j.structure,
          utility: j.utility,
          comments: j.comments ?? "",
        })
        await supabase.from("competition_entries").update({ final_score: finalScore }).eq("id", a.entryId)
        return { ...a, finalScore }
      }),
    )

    // 5. Determinar ganador (mayor score; empate lo rompe menor tiempo de respuesta).
    const ranked = scored
      .filter((s) => s.finalScore !== null)
      .sort((a, b) => (b.finalScore! - a.finalScore!) || ((a.responseTimeMs ?? 1e9) - (b.responseTimeMs ?? 1e9)))

    const winner = ranked[0] ?? null

    await supabase
      .from("competitions")
      .update({
        status: "completada",
        winner_id: winner?.agentId ?? null,
        winner_score: winner?.finalScore ?? null,
        ends_at: new Date().toISOString(),
      })
      .eq("id", competitionId)

    // 6. Actualizar estadísticas de cada agente participante.
    await Promise.all(
      scored.map(async (s) => {
        const position = ranked.findIndex((r) => r.agentId === s.agentId) + 1
        const { data: agentRow } = await supabase
          .from("agents")
          .select("wins, comps_count, avg_score, score, score_evolution")
          .eq("id", s.agentId)
          .single()
        if (!agentRow) return

        const isWin = position === 1
        const newComps = (agentRow.comps_count ?? 0) + 1
        const newWins = (agentRow.wins ?? 0) + (isWin ? 1 : 0)
        const prevAvgTotal = (agentRow.avg_score ?? 0) * (agentRow.comps_count ?? 0)
        const newAvg = s.finalScore !== null ? (prevAvgTotal + s.finalScore) / newComps : agentRow.avg_score
        const pts = isWin ? 10 : position === 2 ? 4 : 2
        const newScore = (agentRow.score ?? 0) + (s.finalScore !== null ? pts : 0)
        const newEvolution = [...(agentRow.score_evolution ?? []), newScore]

        await supabase
          .from("agents")
          .update({
            wins: newWins,
            comps_count: newComps,
            avg_score: newAvg,
            score: newScore,
            last_comp: "Hace instantes",
            score_evolution: newEvolution,
          })
          .eq("id", s.agentId)
      }),
    )

    return new Response(JSON.stringify({ ok: true, winnerId: winner?.agentId ?? null }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("run-competition failed", err)
    return new Response(JSON.stringify({ ok: false, message: "Error interno ejecutando la competencia." }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }
})
