-- Sistema de licencias para la modalidad "Licencia por URL".
-- El comprador recibe una llave con la que llama a la API de Umbra; Umbra
-- reenvia la peticion al endpoint del vendedor sin revelarlo nunca.

create table if not exists public.agent_licenses (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null unique references public.purchases(id) on delete cascade,
  listing_id  uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_id    uuid not null references auth.users(id) on delete cascade,
  -- Solo se guarda el hash. La llave en claro se muestra una unica vez al
  -- emitirla; si el comprador la pierde, rota y se emite otra.
  key_hash    text not null unique,
  key_prefix  text not null,
  status      text not null default 'activa' check (status in ('activa','revocada')),
  calls_count bigint not null default 0,
  last_used_at timestamptz,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

create index if not exists agent_licenses_buyer_idx on public.agent_licenses(buyer_id);
create index if not exists agent_licenses_hash_idx  on public.agent_licenses(key_hash);

-- Medicion: sin esto el modelo de cobro "por uso" no se puede facturar.
create table if not exists public.api_calls (
  id          uuid primary key default gen_random_uuid(),
  license_id  uuid not null references public.agent_licenses(id) on delete cascade,
  listing_id  uuid not null references public.marketplace_listings(id) on delete cascade,
  at          timestamptz not null default now(),
  ok          boolean not null default false,
  status_code int,
  latency_ms  int
);

create index if not exists api_calls_license_idx on public.api_calls(license_id, at desc);

alter table public.agent_licenses enable row level security;
alter table public.api_calls      enable row level security;

drop policy if exists agent_licenses_select_own on public.agent_licenses;
create policy agent_licenses_select_own on public.agent_licenses
  for select using (auth.uid() = buyer_id);

-- El vendedor ve el consumo de los agentes que publico, para sus metricas.
drop policy if exists api_calls_select_seller on public.api_calls;
create policy api_calls_select_seller on public.api_calls
  for select using (
    exists (
      select 1 from public.marketplace_listings l
      join public.agents a on a.id = l.agent_id
      where l.id = api_calls.listing_id and a.owner_id = auth.uid()
    )
  );

drop policy if exists api_calls_select_buyer on public.api_calls;
create policy api_calls_select_buyer on public.api_calls
  for select using (
    exists (
      select 1 from public.agent_licenses lic
      where lic.id = api_calls.license_id and lic.buyer_id = auth.uid()
    )
  );

-- Nadie escribe estas tablas desde el cliente: solo el proxy (service_role) y
-- la funcion issue_license. Por eso no hay politicas de insert/update/delete.
revoke all on public.agent_licenses from anon, authenticated;
revoke all on public.api_calls      from anon, authenticated;

-- El hash queda fuera de lo que puede leer el comprador.
grant select (
  id, purchase_id, listing_id, buyer_id, key_prefix, status,
  calls_count, last_used_at, created_at, revoked_at
) on public.agent_licenses to authenticated;

grant select on public.api_calls to authenticated;
