-- Series diarias de actividad, construidas con los datos que ya existen.
-- Devuelve todos los dias del rango, incluidos los de cero, para que las
-- graficas no mientan uniendo puntos separados por semanas.

create or replace function public.admin_growth(p_days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_days int := greatest(7, least(coalesce(p_days, 30), 365));
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'No autorizado: se requiere admin';
  end if;

  with dias as (
    select generate_series(
      (current_date - (v_days - 1))::date,
      current_date,
      interval '1 day'
    )::date as dia
  ),
  serie as (
    select
      d.dia,
      (select count(*) from auth.users u              where u.created_at::date = d.dia) as usuarios,
      (select count(*) from public.agents a           where a.created_at::date = d.dia) as agentes,
      (select count(*) from public.competitions c     where c.created_at::date = d.dia) as competencias,
      (select count(*) from public.purchases pu       where pu.created_at::date = d.dia) as compras,
      (select count(*) from public.api_calls ac       where ac.at::date = d.dia)         as llamadas,
      (select count(*) from public.downloads dl       where dl.created_at::date = d.dia) as descargas,
      (select count(*) from public.evaluations e      where e.created_at::date = d.dia)  as evaluaciones
    from dias d
  )
  select jsonb_build_object(
    'days', v_days,
    'series', coalesce(jsonb_agg(jsonb_build_object(
      'dia',          to_char(dia, 'YYYY-MM-DD'),
      'usuarios',     usuarios,
      'agentes',      agentes,
      'competencias', competencias,
      'compras',      compras,
      'llamadas',     llamadas,
      'descargas',    descargas,
      'evaluaciones', evaluaciones
    ) order by dia), '[]'::jsonb),
    -- Acumulado total a hoy, para contrastar el ritmo con el tamano.
    'totales', jsonb_build_object(
      'usuarios',     (select count(*) from auth.users),
      'agentes',      (select count(*) from public.agents),
      'competencias', (select count(*) from public.competitions),
      'compras',      (select count(*) from public.purchases),
      'llamadas',     (select count(*) from public.api_calls),
      'descargas',    (select count(*) from public.downloads),
      'opiniones',    (select count(*) from public.feedback)
    )
  ) into result
  from serie;

  return result;
end;
$$;

revoke execute on function public.admin_growth(int) from public, anon;
grant  execute on function public.admin_growth(int) to authenticated;
