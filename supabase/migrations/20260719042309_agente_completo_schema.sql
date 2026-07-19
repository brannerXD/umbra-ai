-- ============================================================
--  AGENTE COMPLETO — Fase 1: esquema (aditivo, compatible)
-- ============================================================

-- 1) Metadata rica en los listados (todo nullable → no rompe filas existentes)
alter table public.marketplace_listings
  add column if not exists image_url         text,
  add column if not exists documentation     text,
  add column if not exists compatible_models text[],
  add column if not exists git_repo          text,
  add column if not exists technologies      text[],
  add column if not exists dependencies      text,
  add column if not exists readme            text;

-- 2) Versiones del agente completo (v1.0, v1.1, v2.0...). Cada versión = su ZIP inmutable.
create table if not exists public.agent_versions (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  version    text not null,
  code_path  text not null,
  changelog  text,
  created_at timestamptz not null default now(),
  unique (listing_id, version)
);
alter table public.agent_versions enable row level security;
create index if not exists agent_versions_listing_idx on public.agent_versions (listing_id);

-- 3) Estado y versión comprada en las compras
alter table public.purchases
  add column if not exists status     text not null default 'completada',
  add column if not exists version_id uuid references public.agent_versions(id);

do $$ begin
  alter table public.purchases add constraint purchases_status_check
    check (status in ('pendiente','completada','reembolsada'));
exception when duplicate_object then null; end $$;

create unique index if not exists purchases_listing_buyer_uidx
  on public.purchases (listing_id, buyer_id);

-- 4) Registro de descargas (alimenta las métricas del vendedor)
create table if not exists public.downloads (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  version_id uuid references public.agent_versions(id) on delete set null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.downloads enable row level security;
create index if not exists downloads_listing_idx on public.downloads (listing_id);

-- 5) Backfill: cada listado 'codigo' existente con code_path recibe su versión v1.0,
--    para que las compras y descargas actuales sigan funcionando con el nuevo modelo.
insert into public.agent_versions (listing_id, version, code_path, changelog)
select l.id, 'v1.0', l.code_path, 'Versión inicial.'
from public.marketplace_listings l
where l.listing_type = 'codigo'
  and l.code_path is not null
  and not exists (select 1 from public.agent_versions v where v.listing_id = l.id);
