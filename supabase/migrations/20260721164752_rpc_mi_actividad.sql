-- Actividad del usuario en sesion, para el mapa de contribuciones de su perfil.
-- Misma fuente derivada que admin_user_activity, pero acotada a auth.uid():
-- cada quien ve solo la suya. No requiere ser admin.
--
-- Devuelve los dias con actividad (los vacios los rellena el cliente al dibujar
-- la cuadricula) y los ultimos eventos con su detalle.

create or replace function public.my_activity(p_days int default 365)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_uid  uuid := auth.uid();
  v_days int := greatest(30, least(coalesce(p_days, 365), 366));
begin
  if v_uid is null then
    raise exception 'Se requiere sesion.';
  end if;

  with eventos as (
    select 'agente'::text as tipo, a.name as detalle, a.created_at as cuando
      from public.agents a where a.owner_id = v_uid
    union all
    select 'competencia', c.title, ce.created_at
      from public.competition_entries ce
      join public.agents ag on ag.id = ce.agent_id
      join public.competitions c on c.id = ce.competition_id
     where ag.owner_id = v_uid
    union all
    select 'compra', ag.name, pu.created_at
      from public.purchases pu
      join public.marketplace_listings l on l.id = pu.listing_id
      join public.agents ag on ag.id = l.agent_id
     where pu.buyer_id = v_uid
    union all
    select 'llamada_api', ag.name, ac.at
      from public.api_calls ac
      join public.agent_licenses lic on lic.id = ac.license_id
      join public.marketplace_listings l on l.id = ac.listing_id
      join public.agents ag on ag.id = l.agent_id
     where lic.buyer_id = v_uid
    union all
    select 'descarga', ag.name, dl.created_at
      from public.downloads dl
      join public.marketplace_listings l on l.id = dl.listing_id
      join public.agents ag on ag.id = l.agent_id
     where dl.user_id = v_uid
    union all
    select 'opinion', left(f.message, 60), f.created_at
      from public.feedback f where f.user_id = v_uid
  ),
  en_rango as (
    select * from eventos
     where cuando >= (current_date - (v_days - 1))
  )
  select jsonb_build_object(
    'days', v_days,
    'desde', to_char(current_date - (v_days - 1), 'YYYY-MM-DD'),
    'hasta', to_char(current_date, 'YYYY-MM-DD'),
    'total', (select count(*) from en_rango),
    -- Solo los dias con actividad: la cuadricula completa la dibuja el cliente.
    'dias', (
      select coalesce(jsonb_object_agg(dia, n), '{}'::jsonb)
      from (
        select to_char(cuando::date, 'YYYY-MM-DD') as dia, count(*) as n
        from en_rango group by 1
      ) s
    ),
    'por_tipo', (
      select coalesce(jsonb_object_agg(tipo, n), '{}'::jsonb)
      from (select tipo, count(*) n from en_rango group by 1) s
    ),
    'ultimos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'tipo', tipo, 'detalle', detalle,
               'cuando', to_char(cuando, 'YYYY-MM-DD"T"HH24:MI:SSOF')
             ) order by cuando desc), '[]'::jsonb)
      from (select * from en_rango order by cuando desc limit 15) t
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.my_activity(int) from public, anon;
grant  execute on function public.my_activity(int) to authenticated;
