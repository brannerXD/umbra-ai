-- Anade el cruce categoria x estado de competencias.
-- Motivo: la grafica de estado sola degeneraba en una dona de un solo segmento
-- cuando todas las competencias comparten estado, que no comunica nada.
-- Con la categoria como eje, el grafico informa aunque haya pocas filas.

create or replace function public.admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'No autorizado: se requiere admin';
  end if;

  select jsonb_build_object(
    'users_total',        (select count(*) from auth.users),
    'users_last_7d',      (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'agents_total',       (select count(*) from public.agents where not coalesce(archived, false)),
    'competitions_total', (select count(*) from public.competitions),
    'evaluations_total',  (select count(*) from public.evaluations),
    'listings_total',     (select count(*) from public.marketplace_listings where listed),
    'purchases_total',    (select count(*) from public.purchases),
    'certificates_total', (select count(*) from public.certificate_issuances),
    'competitions_by_status', (
      select coalesce(jsonb_object_agg(status, c), '{}'::jsonb)
      from (select status, count(*) c from public.competitions group by status) s
    ),
    'competitions_by_category', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'label', label,
               'en_curso',   en_curso,
               'proxima',    proxima,
               'completada', completada,
               'total',      total
             ) order by total desc), '[]'::jsonb)
      from (
        select
          coalesce(category_label, category, 'Sin categoria') as label,
          count(*) filter (where status = 'en-curso')   as en_curso,
          count(*) filter (where status = 'proxima')    as proxima,
          count(*) filter (where status = 'completada') as completada,
          count(*)                                      as total
        from public.competitions
        group by 1
      ) s
    ),
    'listings_by_type', (
      select coalesce(jsonb_object_agg(listing_type, c), '{}'::jsonb)
      from (select listing_type, count(*) c from public.marketplace_listings where listed group by listing_type) s
    ),
    'agents_by_category', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', c) order by c desc), '[]'::jsonb)
      from (
        select coalesce(category_label, category) label, count(*) c
        from public.agents where not coalesce(archived, false) group by 1
      ) s
    ),
    'top_agents', (
      select coalesce(jsonb_agg(jsonb_build_object('label', name, 'value', score) order by score desc), '[]'::jsonb)
      from (
        select name, score from public.agents where not coalesce(archived, false)
        order by score desc limit 6
      ) s
    )
  ) into result;

  return result;
end;
$$;
