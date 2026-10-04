-- Sello on-chain de cada CERTIFICADO (Solana).
-- Cada fila de certificate_issuances recibe su propio hash SHA-256 y la firma
-- de la transacción de Solana que lo contiene (memo umbra:cert:v1:<id>:<hash>).
-- Lo escribe sólo la Edge Function attest-certificate (service_role); el
-- cliente sigue con permiso de SÓLO lectura sobre la tabla (sin cambios).

alter table public.certificate_issuances
  add column if not exists cert_hash          text check (cert_hash is null or char_length(cert_hash) = 64),
  add column if not exists cert_snapshot      jsonb,
  add column if not exists onchain_signature  text,
  add column if not exists onchain_cluster    text check (onchain_cluster is null or onchain_cluster in ('devnet', 'mainnet-beta')),
  add column if not exists onchain_wallet     text,
  add column if not exists onchain_at         timestamptz,
  -- Reclamo atómico: evita que dos peticiones simultáneas publiquen dos tx.
  add column if not exists onchain_claimed_at timestamptz;

create unique index if not exists certificate_issuances_onchain_signature_key
  on public.certificate_issuances (onchain_signature)
  where onchain_signature is not null;

-- Buscar un certificado por su hash (página /verificar).
create index if not exists certificate_issuances_cert_hash_idx
  on public.certificate_issuances (cert_hash)
  where cert_hash is not null;

-- Pendientes de sellar (los recoge el cron).
create index if not exists certificate_issuances_pending_idx
  on public.certificate_issuances (issued_at)
  where onchain_signature is null;

-- El cron horario ahora también sella los certificados que quedaron pendientes.
create or replace function public.attest_agents_tick()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_secret text;
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2a2VqbHNpbnR2a2Nxd2lzZGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTY4ODgsImV4cCI6MjA5ODQzMjg4OH0.TAtoSTubuY0mZ_JUxDx94HUMOTrMQDy-fdq54IJB1Ck';
  v_base text := 'https://lvkejlsintvkcqwisdes.supabase.co/functions/v1/';
  v_headers jsonb;
begin
  select value into v_secret from public.internal_config where key = 'cron_secret';
  if v_secret is null then return; end if;
  if not exists (select 1 from public.internal_config where key = 'solana_attester_secret') then return; end if;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', v_anon,
    'Authorization', 'Bearer ' || v_anon,
    'x-cron-secret', v_secret
  );

  -- Cada sello espera confirmación de Solana (~1 s): con el timeout por
  -- defecto de pg_net (5 s) la llamada se cortaba a mitad del lote.
  perform net.http_post(url := v_base || 'attest-agents', headers := v_headers,
                        body := '{}'::jsonb, timeout_milliseconds := 120000);
  perform net.http_post(url := v_base || 'attest-certificate', headers := v_headers,
                        body := '{}'::jsonb, timeout_milliseconds := 120000);
end;
$function$;

revoke all on function public.attest_agents_tick() from public, anon, authenticated;
