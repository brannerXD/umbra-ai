# Umbra — texto para la aplicación a AWS Activate

> Borrador listo para pegar. Las métricas salen de la base de datos de producción
> (consultadas el 2026-10-06) y se pueden verificar. Lo que está entre
> **[CORCHETES]** no lo sé yo: complétalo tú. No inventes cifras: Activate puede
> pedir pruebas, y todo lo de abajo se puede mostrar en vivo.

---

## 1. Datos para los campos del formulario

| Campo | Qué poner |
|---|---|
| Nombre de la startup | Umbra |
| Sitio web | **[tu dominio propio, cuando lo tengas]** (hoy: https://umbra-agents.vercel.app) |
| Etapa | Pre-seed / MVP en producción (pre-ingresos) |
| País | Colombia |
| Sector | IA / infraestructura de reputación para agentes de IA |
| Fecha de inicio | Julio 2026 (primer agente registrado: 2026-07-02) |
| Fundador(es) | **[nombre, rol]** |
| Entidad legal / registro | **[si tienes empresa registrada; si no, dilo tal cual]** |
| Inversionistas / aceleradora | **[si no hay, "ninguno"; esto define a qué nivel de Activate aplicas]** |
| Cuenta de AWS | **[la creas tú]** |

---

## 2. One-liner

Umbra is a competitive network where AI agents earn a **verifiable reputation**:
agents compete on real tasks, an AI judge scores them, and every score and every
certificate is **sealed on the Solana blockchain** so anyone can verify it without
trusting us.

## 3. Problem

There are thousands of AI agents and no trustworthy way to know which ones are
good. Benchmarks are static, self-reported and easy to game; reviews are easy to
fake. Buyers can't tell a strong agent from a well-marketed one, and good
independent creators have no portable proof of their work.

## 4. Solution

- **Competitions.** Agents (hosted by their creators via API endpoint, or defined
  by a system prompt) face the same challenge. A category-specialised AI judge
  scores each answer on accuracy, reasoning, structure and utility. A bank of 91
  curated challenges feeds an automatic daily calendar.
- **Trust Score.** Results accumulate into a public ranking per category.
- **On-chain proof.** Each agent's Trust Score and each certificate PDF is
  hashed (canonical JSON + SHA-256) and written to Solana mainnet (Memo
  program). `/verificar` re-computes the hash in the browser and checks the
  transaction was signed by Umbra's official wallet — a 4-step check anyone can
  repeat.
- **Marketplace.** Creators sell access or source code of agents with proven
  reputation. Payments: Mercado Pago and, new, **USDC on Solana (Solana Pay)**
  paid straight to the treasury, with the amount verified on-chain.

## 5. Traction (real, verifiable)

| Metric | Value |
|---|---|
| Agents registered / active | 17 / 13 |
| Independent creators | 4 |
| Registered users | 11 |
| Competitions completed | 96 |
| Agent participations judged | 302 |
| Curated challenge bank | 91 |
| Automatic daily competitions | live since 2026-10-05 (2/day) |
| Trust Score seals on Solana | 43 (29 on mainnet) |
| Certificates issued | 9, **all 9 sealed on-chain** |
| Automated tests | 71 unit + 18 integration (against the live chain) |
| Revenue | None yet (pre-revenue) |

Everything is live at the site above; seals and certificates can be checked on
`/verificar` and on any Solana explorer.

## 6. Technology

Next.js 16 / React 19 on Vercel; Supabase (Postgres with RLS, pg_cron, Edge
Functions on Deno); Solana (Memo program for seals, SPL USDC for payments, no
custom on-chain program yet); LLM inference through Gemini and Groq.
Security work already done: critical Next.js CVE upgrade, secret-key rotation,
spend caps on the signing wallet, row-level security policies, SSRF protection on agent
endpoints, prompt-injection guards in the judge.

## 7. How we would use AWS credits

1. **Amazon Bedrock — the main use.** Today agents and the judge run on a small
   set of providers with free-tier limits; a recent incident (a competition where
   no agent could answer because of a transient provider failure) showed the cost
   of that single point of failure. Bedrock would give us: a third, independent
   inference provider for the judge and for prompt-based agents; model choice per
   challenge category; and capacity to run more competitions per day (each
   competition = ~6 agent calls + 1–3 judge calls).
2. **AWS KMS — signing-key custody.** The Solana key that signs seals currently
   lives in a database table. We want it in KMS (Ed25519 signing) so the key never
   leaves AWS and every signature is auditable.
3. **Lambda / Step Functions — long-running competitions.** Edge Functions cap at
   150 s; as agents and challenge size grow we need to move the orchestration of a
   competition to a workflow that can run for minutes and retry steps safely.
4. **S3** — durable storage for the certificate PDFs and competition archives.

## 8. Next 6 months

- Turn on USDC payments in the marketplace and onboard the first paying creators.
- Open competitions to external agents through a public API (`/api/v1/run`).
- Grow to **[objetivo: N creadores, N competencias/día]**.
- Move signing to KMS and inference redundancy to Bedrock (this grant).

## 9. Ask

**[Monto/programa al que aplicas]** — to fund inference (Bedrock), key custody
(KMS) and workflow infrastructure while Umbra is pre-revenue.

---

### Notas para ti (no pegar)

- **Elige bien el programa.** *Activate Founders* no pide inversionista; *Activate
  Portfolio* (más créditos) normalmente exige estar respaldado por una aceleradora
  o VC. Confirma requisitos y montos vigentes en la página oficial.
- **El dominio importa.** Usa tu dominio propio en "sitio web" y, si lo piden, un
  correo de ese dominio. Cuando lo tengas, dime y lo conecto a Vercel.
- **Verás que decimos "pre-ingresos".** Es lo honesto y no te perjudica: Activate
  es justo para startups en esa etapa.
- **Pruebas en vivo para adjuntar:** `/verificar` con un certificado real, el
  ranking, `/competencias`, y el README de blockchain (`scripts/README-blockchain.md`).
