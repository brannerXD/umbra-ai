-- ============================================================
--  AGENTE COMPLETO — Fase 1: métricas del vendedor
--  Devuelve los números del vendedor autenticado sobre SUS listados.
-- ============================================================
create or replace function public.seller_stats()
returns json
language sql
security definer
set search_path = public
as $$
  with my_listings as (
    select l.id, l.agent_id, l.price, l.listing_type, a.name as agent_name
    from marketplace_listings l
    join agents a on a.id = l.agent_id
    where a.owner_id = auth.uid()
  ),
  my_purchases as (
    select p.*, ml.agent_name
    from purchases p
    join my_listings ml on ml.id = p.listing_id
  ),
  my_downloads as (
    select d.*
    from downloads d
    join my_listings ml on ml.id = d.listing_id
  )
  select json_build_object(
    'listings_total',  (select count(*) from my_listings),
    'sales_total',     (select count(*) from my_purchases),
    'revenue_total',   (select coalesce(sum(price), 0) from my_purchases where status = 'completada'),
    'downloads_total', (select count(*) from my_downloads),
    'buyers', (
      select coalesce(json_agg(row_to_json(b) order by b.at desc), '[]'::json)
      from (
        select coalesce(pr.username, 'Usuario') as buyer,
               mp.agent_name as agent,
               mp.price, mp.price_unit, mp.status,
               mp.created_at as at
        from my_purchases mp
        left join profiles pr on pr.id = mp.buyer_id
      ) b
    ),
    'top_version', (
      select json_build_object('version', v.version, 'downloads', count(d.id))
      from my_downloads d
      join agent_versions v on v.id = d.version_id
      group by v.version
      order by count(d.id) desc
      limit 1
    ),
    'sales_by_agent', (
      select coalesce(json_agg(row_to_json(s)), '[]'::json)
      from (
        select ml.agent_name as label, count(mp.id) as value
        from my_listings ml
        left join my_purchases mp on mp.listing_id = ml.id
        group by ml.agent_name
        order by count(mp.id) desc
      ) s
    )
  );
$$;

grant execute on function public.seller_stats() to authenticated;
