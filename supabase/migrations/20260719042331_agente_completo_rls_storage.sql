-- ============================================================
--  AGENTE COMPLETO — Fase 1: RLS + Storage
-- ============================================================

-- agent_versions: la metadata (número de versión, changelog) es legible por todos
-- para poder mostrar "v2.0 disponible" en el listado. Conocer code_path NO da acceso
-- al archivo: el acceso real lo controla la RLS de storage.
drop policy if exists agent_versions_select_all on public.agent_versions;
create policy agent_versions_select_all on public.agent_versions
  for select using (true);

drop policy if exists agent_versions_insert_own on public.agent_versions;
create policy agent_versions_insert_own on public.agent_versions
  for insert with check (exists (
    select 1 from public.marketplace_listings l
    join public.agents a on a.id = l.agent_id
    where l.id = agent_versions.listing_id and a.owner_id = auth.uid()));

drop policy if exists agent_versions_update_own on public.agent_versions;
create policy agent_versions_update_own on public.agent_versions
  for update using (exists (
    select 1 from public.marketplace_listings l
    join public.agents a on a.id = l.agent_id
    where l.id = agent_versions.listing_id and a.owner_id = auth.uid()));

-- downloads: cada usuario registra y ve sus propias descargas
drop policy if exists downloads_insert_own on public.downloads;
create policy downloads_insert_own on public.downloads
  for insert with check (user_id = auth.uid());
drop policy if exists downloads_select_own on public.downloads;
create policy downloads_select_own on public.downloads
  for select using (user_id = auth.uid());

-- purchases: el vendedor puede ver las compras de SUS listados (compradores + métricas)
drop policy if exists purchases_select_seller on public.purchases;
create policy purchases_select_seller on public.purchases
  for select using (exists (
    select 1 from public.marketplace_listings l
    join public.agents a on a.id = l.agent_id
    where l.id = purchases.listing_id and a.owner_id = auth.uid()));

-- storage: lectura del código = dueño de la carpeta O comprador (compra completada)
-- de CUALQUIER versión de ese listado. Se mantiene el caso viejo por code_path directo.
drop policy if exists agent_code_read on storage.objects;
create policy agent_code_read on storage.objects
  for select using (
    bucket_id = 'agent-code' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.purchases p
        join public.agent_versions v on v.listing_id = p.listing_id
        where p.buyer_id = auth.uid()
          and p.status = 'completada'
          and v.code_path = objects.name)
      or exists (
        select 1 from public.purchases p
        join public.marketplace_listings l on l.id = p.listing_id
        where p.buyer_id = auth.uid()
          and p.status = 'completada'
          and l.code_path = objects.name)
    ));

-- Bucket público para imágenes de producto (no son sensibles; se muestran en el marketplace).
insert into storage.buckets (id, name, public)
values ('agent-images', 'agent-images', true)
on conflict (id) do nothing;

drop policy if exists agent_images_read on storage.objects;
create policy agent_images_read on storage.objects
  for select using (bucket_id = 'agent-images');

drop policy if exists agent_images_owner_write on storage.objects;
create policy agent_images_owner_write on storage.objects
  for insert with check (bucket_id = 'agent-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists agent_images_owner_update on storage.objects;
create policy agent_images_owner_update on storage.objects
  for update using (bucket_id = 'agent-images' and (storage.foldername(name))[1] = auth.uid()::text);
