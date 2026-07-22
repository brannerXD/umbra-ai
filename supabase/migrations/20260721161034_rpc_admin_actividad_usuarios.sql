-- Actividad por usuario, DERIVADA de las tablas existentes en vez de un
-- sistema de tracking aparte. Ventaja: funciona hacia atras (muestra lo que ya
-- ocurrio, no solo lo futuro) y no puede quedar desincronizada por olvidar
-- instrumentar una accion nueva.
--
-- Lo que no cubre son las visitas y clics: de eso se encarga Vercel Analytics.

create or replace function public.admin_user_activity(p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_limit int := greatest(1, least(coalesce(p_limit, 50), 200));
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'No autorizado: se requiere admin';
  end if;

  with eventos as (
    select a.owner_id as uid, 'agente'::text as tipo,
           a.name as detalle, a.created_at as cuando
      from public.agents a where a.owner_id is not null
    union all
    select ag.owner_id, 'competencia', c.title, ce.created_at
      from public.competition_entries ce
      join public.agents ag on ag.id = ce.agent_id
      join public.competitions c on c.id = ce.competition_id
     where ag.owner_id is not null
    union all
    select pu.buyer_id, 'compra', ag.name, pu.created_at
      from public.purchases pu
      join public.marketplace_listings l on l.id = pu.listing_id
      join public.agents ag on ag.id = l.agent_id
    union all
    select lic.buyer_id, 'llamada_api', ag.name, ac.at
      from public.api_calls ac
      join public.agent_licenses lic on lic.id = ac.license_id
      join public.marketplace_listings l on l.id = ac.listing_id
      join public.agents ag on ag.id = l.agent_id
    union all
    select dl.user_id, 'descarga', ag.name, dl.created_at
      from public.downloads dl
      join public.marketplace_listings l on l.id = dl.listing_id
      join public.agents ag on ag.id = l.agent_id
     where dl.user_id is not null
    union all
    select f.user_id, 'opinion', left(f.message, 60), f.created_at
      from public.feedback f where f.user_id is not null
  ),
  resumen as (
    select
      u.id,
      coalesce(p.username, split_part(u.email, '@', 1)) as nombre,
      u.created_at as registrado,
      (select count(*) from eventos e where e.uid = u.id) as eventos_total,
      (select max(e.cuando) from eventos e where e.uid = u.id) as ultima_actividad,
      (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'tipo', t.tipo, 'detalle', t.detalle,
                 'cuando', to_char(t.cuando, 'YYYY-MM-DD"T"HH24:MI:SSOF')
               ) order by t.cuando desc), '[]'::jsonb)
        from (
          select e.tipo, e.detalle, e.cuando
            from eventos e where e.uid = u.id
           order by e.cuando desc limit 10
        ) t
      ) as ultimos
    from auth.users u
    left join public.profiles p on p.id = u.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id,
           'nombre', nombre,
           'registrado', to_char(registrado, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
           'eventos', eventos_total,
           'ultima_actividad', to_char(ultima_actividad, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
           'ultimos', ultimos
         ) order by coalesce(ultima_actividad, registrado) desc), '[]'::jsonb)
    into result
  from (select * from resumen order by coalesce(ultima_actividad, registrado) desc limit v_limit) s;

  return result;
end;
$$;

revoke execute on function public.admin_user_activity(int) from public, anon;
grant  execute on function public.admin_user_activity(int) to authenticated;
