-- Trayectoria de reputacion del usuario en sesion, para la grafica del perfil.
--
-- Reconstruye como crecio el score competencia a competencia usando la formula
-- REAL, la que escribe run-competition: suma acumulada por puesto (10 al 1o,
-- 4 al 2o, 2 al resto). El puesto se deriva del final_score dentro de cada
-- competencia, asi el numero coincide exactamente con el del ranking.
--
-- Nota: el desglose de /agente usa OTRA formula (victorias*10 + comps*2 +
-- promedio*0.5) y por eso muestra un total que no cuadra con el titular de la
-- misma pagina. Es un bug de interfaz, pendiente aparte.
--
-- Las fechas van en UTC con sufijo "Z": el formato 'OF' de to_char produce
-- "+00", que new Date() en JavaScript no sabe parsear (salia "Invalid Date").

create or replace function public.my_reputation_journey()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare result jsonb; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Se requiere sesion.'; end if;

  with entradas as (
    select ce.created_at, ce.final_score::numeric as puntuacion,
           c.title as competencia, ag.name as agente,
           rank() over (partition by ce.competition_id order by ce.final_score desc) as puesto
    from public.competition_entries ce
    join public.agents ag      on ag.id = ce.agent_id
    join public.competitions c on c.id  = ce.competition_id
    where ag.owner_id = v_uid and ce.final_score is not null
  ),
  con_puntos as (
    select *, case when puesto = 1 then 10 when puesto = 2 then 4 else 2 end as puntos
    from entradas
  ),
  acumulado as (
    select *, sum(puntos) over (order by created_at rows between unbounded preceding and current row) as score
    from con_puntos
  )
  select jsonb_build_object(
    'puntos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'fecha', to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
               'score', score, 'puntos', puntos, 'puntuacion', round(puntuacion),
               'puesto', puesto, 'gano', puesto = 1,
               'competencia', competencia, 'agente', agente
             ) order by created_at), '[]'::jsonb) from acumulado
    ),
    'hitos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'fecha', to_char(cuando at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
               'tipo', tipo, 'detalle', detalle
             ) order by cuando), '[]'::jsonb)
      from (
        select 'agente'::text as tipo, a.name as detalle, a.created_at as cuando
          from public.agents a where a.owner_id = v_uid
        union all
        select 'listado', ag.name, l.listed_at
          from public.marketplace_listings l
          join public.agents ag on ag.id = l.agent_id
         where ag.owner_id = v_uid and l.listed
        union all
        select 'venta', ag.name, pu.created_at
          from public.purchases pu
          join public.marketplace_listings l on l.id = pu.listing_id
          join public.agents ag on ag.id = l.agent_id
         where ag.owner_id = v_uid
      ) h
    ),
    'resumen', jsonb_build_object(
      'score',        (select coalesce(max(score), 0) from acumulado),
      'competencias', (select count(*) from entradas),
      'victorias',    (select count(*) from entradas where puesto = 1),
      'mejor',        (select coalesce(max(puntuacion), 0) from entradas),
      'agentes',      (select count(*) from public.agents where owner_id = v_uid)
    )
  ) into result;
  return result;
end; $function$;

revoke execute on function public.my_reputation_journey() from public, anon;
grant  execute on function public.my_reputation_journey() to authenticated;
