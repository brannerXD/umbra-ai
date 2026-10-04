# Umbra — Sello on-chain del Trust Score (Solana)

Umbra sella en **Solana** la reputación de cada agente: escribe en la cadena una
huella SHA-256 de su estado público (score, victorias, competencias, promedio).
Cualquiera puede recalcular esa huella desde los datos y compararla con la de la
cadena → **reputación verificable e independiente de nuestro servidor**.

Hoy corre en **devnet** (gratis, sin dinero real).

## Cómo funciona

1. **Cron horario** (`umbra-attest-agents`, pg_cron, minuto 17) llama a
   `public.attest_agents_tick()`, que invoca la Edge Function `attest-agents`
   con el secreto interno del cron.
2. **`supabase/functions/attest-agents`** busca agentes cuyo estado público
   cambió desde su último sello (máx. 10 por pasada), arma el payload canónico,
   calcula el SHA-256 y publica una tx con el **programa Memo**:
   `umbra:v1:<agentId>:<sha256>`. Registra firma + snapshot en
   `public.onchain_attestations` (lectura pública, escritura sólo servidor).
3. El **dueño** de un agente también puede pedir "Sellar ahora" desde la página
   del agente (cooldown de 10 min).
4. En `/agente`, el bloque **Sello on-chain** (`components/agente/onchain-seal.tsx`)
   muestra el último sello y un botón **Verificar en la cadena**: el navegador
   lee la tx directo del RPC de Solana, recalcula el hash del snapshot y los
   compara. Umbra no interviene en la verificación.

## Certificados (cada uno con su propio sello)

Cada certificado PDF descargado (`certificate_issuances`) se sella en Solana al
emitirse: `app/certificado/pdf/route.tsx` llama a la Edge Function
`attest-certificate`, que publica el memo `umbra:cert:v1:<certId>:<sha256>` y
guarda `cert_hash` + `onchain_signature`. El PDF imprime N.º de certificado,
hash, firma de la transacción y un **QR** a `/verificar?c=<certId>`.
Si la red falla, el PDF sale con "sello en proceso" y el cron lo completa.

`/verificar` (pública) acepta ID, hash o la URL del QR y comprueba en el
navegador: (1) hash recalculado desde los datos, (2) = hash registrado,
(3) = memo en Solana, (4) la tx la firmó la wallet oficial de Umbra
(`UMBRA_ATTESTER_WALLET` en `lib/solana.ts`). El paso 4 evita suplantaciones:
cualquiera puede escribir un memo idéntico desde otra wallet.

## Pruebas

- `npm test` — unitarias (sin red): formato canónico con **vectores dorados
  reales** de producción, reintentos del RPC, detección de manipulación campo
  a campo y de suplantación de wallet.
- `npm run test:chain` — integración contra producción (anon key): todos los
  sellos verifican en Solana, seguridad de las Edge Functions (401/400/404/405,
  idempotencia) y permisos de la base (anon no puede escribir ni leer la llave).

## Piezas

- `supabase/functions/_shared/umbra-attestation.ts` — **fuente única** del
  formato canónico y el hash (la usan Edge Functions, web y pruebas).
- `supabase/functions/_shared/solana-signer.ts` — wallet + envío del memo.
- `lib/solana.ts` — verificación desde el navegador (RPC público, sin librerías).
- `supabase/functions/attest-agents` y `attest-certificate` — firman y publican.
- `supabase/migrations/20260828120000_onchain_attestations.sql` — tabla + cron.
- `scripts/publish-attestation.mjs` — publicación manual desde tu máquina (debug).

## Redes y wallets (devnet / mainnet)

La red activa se cambia SIN redesplegar, en `public.internal_config`:
`solana_cluster` = `devnet` | `mainnet-beta`. Cada sello guarda su red, así que
los de devnet siguen verificando después del cambio.

| Red | Wallet oficial (pública) | Llave privada |
|---|---|---|
| devnet | `BDsEnYJ525WNMv9t2oBiAf8r3svqvraTcCP52nkAmWZg` | `internal_config.solana_attester_secret` + `scripts/.devnet-keypair.json` |
| mainnet | `6xBKjoTBabB5zrboXweLd6N14T87vcD5aq1mFxGTNutK` | `internal_config.solana_attester_secret_mainnet` + `scripts/.mainnet-keypair.json` |

Las llaves NUNCA van al repo (los .json están en .gitignore). Las direcciones
públicas están en `ATTESTER_WALLETS` (`lib/solana.ts`): verificar exige que la
tx la firme la wallet de su red.

**Frenos de gasto en mainnet** (`_shared/solana-signer.ts`): reserva mínima de
0.001 SOL que nunca se gasta y tope de 30 sellos por hora (agentes +
certificados). Si se alcanza, los certificados quedan "en proceso" y el cron
los completa después.

**Lectura desde el navegador:** el RPC oficial de mainnet responde 403 a
navegadores; `lib/solana.ts` lee por PublicNode (`solana-rpc.publicnode.com`).

**Estado en vivo:** `GET /api/health` → red activa, wallet, saldo y sellos
restantes aproximados (además valida la llave secreta de Supabase).

## Wallet firmante

- Dirección pública (devnet): `BDsEnYJ525WNMv9t2oBiAf8r3svqvraTcCP52nkAmWZg`
- La llave privada **no está en el repo**: vive en `public.internal_config`
  (`solana_attester_secret`, RLS sin grants → sólo service_role) y localmente en
  `scripts/.devnet-keypair.json` (gitignored).
- Cada sello cuesta ~0.000005 SOL de devnet. Si se queda sin fondos, la función
  responde 503 "sin SOL" y no sella nada (el sitio sigue igual). Recargar en
  https://faucet.solana.com (red devnet).

## Pasar a mainnet

1. Enviar SOL (red **Solana**) a la wallet mainnet de arriba.
2. `update internal_config set value='mainnet-beta' where key='solana_cluster'`.
3. El siguiente cron sella cada agente una vez en mainnet; los certificados
   nuevos se sellan en mainnet al emitirse.
