-- Atestaciones on-chain del Trust Score (Solana).
-- Registra cada vez que Umbra sella en la cadena el estado reputacional de un
-- agente: el hash SHA-256 del snapshot + la firma de la transacción. Con esto
-- la web puede mostrar "Verificado en Solana" enlazando al explorador, y
-- cualquiera puede recalcular el hash desde los datos públicos y comprobarlo.
--
-- Solo el SERVIDOR escribe aquí (service_role / RPC). El cliente solo LEE.
-- Tabla puramente aditiva: no toca ninguna tabla existente.

create table if not exists public.onchain_attestations (
  id             uuid primary key default gen_random_uuid(),
  agent_id       uuid not null references public.agents(id) on delete cascade,
  cluster        text not null default 'devnet'
                   check (cluster in ('devnet', 'mainnet-beta')),
  -- Hash canónico (hex) del snapshot reputacional en el momento de atestar.
  payload_hash   text not null check (char_length(payload_hash) = 64),
  -- Firma (base58) de la transacción de Solana que contiene el memo.
  signature      text not null,
  -- Wallet que firmó la atestación (base58).
  wallet         text not null,
  -- Snapshot público sellado (para mostrarlo y poder re-verificar el hash).
  snapshot       jsonb not null,
  issued_at      timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- Un agente puede tener varias atestaciones (historial), pero no repetir la
-- misma firma.
create unique index if not exists onchain_attestations_signature_key
  on public.onchain_attestations (signature);

create index if not exists onchain_attestations_agent_idx
  on public.onchain_attestations (agent_id, issued_at desc);

alter table public.onchain_attestations enable row level security;

-- Lectura pública: las atestaciones son pruebas públicas por diseño.
drop policy if exists onchain_attestations_select on public.onchain_attestations;
create policy onchain_attestations_select
  on public.onchain_attestations for select
  using (true);

-- Mínimo privilegio (mismo criterio que 20260731180000): el cliente solo lee.
-- La escritura la hace el servidor (service_role / RPC SECURITY DEFINER).
revoke insert, update, delete, truncate, trigger, references
  on public.onchain_attestations from anon, authenticated;
grant select on public.onchain_attestations to anon, authenticated;

-- ── Sellado automático ────────────────────────────────────────────────────
-- Cada hora, el cron llama a la Edge Function `attest-agents`, que sella en
-- Solana (devnet) los agentes cuyo estado público cambió desde su último sello.
-- Misma autenticación que run_due_competitions: el secreto interno del cron.
-- La llave de la wallet firmante NO va en esta migración (repo público): se
-- guarda aparte en public.internal_config ('solana_attester_secret').
create or replace function public.attest_agents_tick()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_secret text;
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2a2VqbHNpbnR2a2Nxd2lzZGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTY4ODgsImV4cCI6MjA5ODQzMjg4OH0.TAtoSTubuY0mZ_JUxDx94HUMOTrMQDy-fdq54IJB1Ck';
  v_url text := 'https://lvkejlsintvkcqwisdes.supabase.co/functions/v1/attest-agents';
begin
  select value into v_secret from public.internal_config where key = 'cron_secret';
  if v_secret is null then return; end if;
  if not exists (select 1 from public.internal_config where key = 'solana_attester_secret') then return; end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_anon,
      'Authorization', 'Bearer ' || v_anon,
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    -- Cada sello espera confirmación de Solana (~1 s): con el timeout por
    -- defecto de pg_net (5 s) la llamada se cortaba a mitad del lote.
    timeout_milliseconds := 120000
  );
end;
$function$;

revoke all on function public.attest_agents_tick() from public, anon, authenticated;

select cron.unschedule('umbra-attest-agents')
  where exists (select 1 from cron.job where jobname = 'umbra-attest-agents');
select cron.schedule('umbra-attest-agents', '17 * * * *', 'select public.attest_agents_tick()');
