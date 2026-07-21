-- Correccion de formato de fecha en los RPCs que devuelven marcas de tiempo al
-- cliente. El formato 'OF' de to_char produce un desplazamiento corto ("+00"),
-- que new Date() en JavaScript NO sabe parsear: devolvia Invalid Date y el eje
-- de las graficas mostraba ese texto. Se pasa a UTC con sufijo "Z", que es
-- ISO 8601 completo y parsea en cualquier navegador.
--
-- Afecta a my_activity y admin_user_activity; la definicion completa de ambas
-- se reemplaza aqui con el unico cambio del formato.

create or replace function public.my_activity(p_days int default 365)
returns jsonb language plpgsql security definer set search_path = public as $function$
declare
  result jsonb; v_uid uuid := auth.uid();
  v_days int := greatest(30, least(coalesce(p_days, 365), 366));
begin
  if v_uid is null then raise exception 'Se requiere sesion.'; end if;

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
  en_rango as (select * from eventos where cuando >= (current_date - (v_days - 1)))
  select jsonb_build_object(
    'days', v_days,
    'desde', to_char(current_date - (v_days - 1), 'YYYY-MM-DD'),
    'hasta', to_char(current_date, 'YYYY-MM-DD'),
    'total', (select count(*) from en_rango),
    'dias', (
      select coalesce(jsonb_object_agg(dia, n), '{}'::jsonb)
      from (select to_char(cuando::date, 'YYYY-MM-DD') as dia, count(*) as n
              from en_rango group by 1) s
    ),
    'por_tipo', (
      select coalesce(jsonb_object_agg(tipo, n), '{}'::jsonb)
      from (select tipo, count(*) n from en_rango group by 1) s
    ),
    'ultimos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'tipo', tipo, 'detalle', detalle,
               'cuando', to_char(cuando at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
             ) order by cuando desc), '[]'::jsonb)
      from (select * from en_rango order by cuando desc limit 15) t
    )
  ) into result;
  return result;
end; $function$;

create or replace function public.admin_user_activity(p_limit int default 50)
returns jsonb language plpgsql security definer set search_path = public as $function$
declare
  result jsonb;
  v_limit int := greatest(1, least(coalesce(p_limit, 50), 200));
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'No autorizado: se requiere admin';
  end if;

  with eventos as (
    select a.owner_id as uid, 'agente'::text as tipo, a.name as detalle, a.created_at as cuando
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
                 'cuando', to_char(t.cuando at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
               ) order by t.cuando desc), '[]'::jsonb)
        from (select e.tipo, e.detalle, e.cuando from eventos e
               where e.uid = u.id order by e.cuando desc limit 10) t
      ) as ultimos
    from auth.users u
    left join public.profiles p on p.id = u.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'nombre', nombre,
           'registrado', to_char(registrado at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
           'eventos', eventos_total,
           'ultima_actividad', to_char(ultima_actividad at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
           'ultimos', ultimos
         ) order by coalesce(ultima_actividad, registrado) desc), '[]'::jsonb)
    into result
  from (select * from resumen order by coalesce(ultima_actividad, registrado) desc limit v_limit) s;
  return result;
end; $function$;
