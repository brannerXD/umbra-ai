-- Calendario automático de competencias.
--
-- Hasta ahora las competencias se creaban a mano, en tandas; cuando dejaron de
-- crearse, la plataforma quedó quieta. Ahora un cron diario programa N
-- competencias (internal_config.auto_competitions_per_day; 0 = apagado) con
-- desafíos de un banco curado, rotando categorías, e inscribe a los agentes
-- activos de la categoría (más los generalistas, categoría 'otro'), hasta 6 —
-- el mismo criterio con el que se inscribían a mano.

-- Banco de desafíos (sólo servidor). Se siembra con los desafíos curados de
-- las competencias ya jugadas.
create table if not exists public.competition_bank (
  id             uuid primary key default gen_random_uuid(),
  title          text not null unique,
  category       text not null,
  category_label text not null,
  prompt         text not null,
  used_count     integer not null default 0,
  last_used_at   timestamptz,
  created_at     timestamptz not null default now()
);
alter table public.competition_bank enable row level security;
revoke all on public.competition_bank from anon, authenticated;

insert into public.competition_bank (title, category, category_label, prompt, used_count, last_used_at)
select
  c.title,
  (array_agg(c.category order by c.created_at desc))[1],
  (array_agg(coalesce(c.category_label, 'Otro') order by c.created_at desc))[1],
  (array_agg(c.prompt order by c.created_at desc))[1],
  count(*),
  max(coalesce(c.started_at, c.created_at))
from public.competitions c
where c.prompt is not null
  and length(trim(c.prompt)) > 20
  and c.title not ilike '%prueba%'
group by c.title
on conflict (title) do nothing;

-- Marca de las competencias creadas por el calendario.
alter table public.competitions
  add column if not exists auto boolean not null default false;

insert into public.internal_config (key, value)
values ('auto_competitions_per_day', '2')
on conflict (key) do nothing;

create or replace function public.schedule_auto_competitions()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_per_day int;
  v_cats text[] := array['codigo', 'razonamiento', 'texto', 'prediccion'];
  v_day date := (now() at time zone 'utc')::date;
  v_created int := 0;
  v_cat text;
  v_at timestamptz;
  v_comp uuid;
  v_n int;
  b record;
begin
  select coalesce(nullif(trim(value), '')::int, 0) into v_per_day
    from public.internal_config where key = 'auto_competitions_per_day';
  v_per_day := least(coalesce(v_per_day, 0), 6);
  if v_per_day <= 0 then return 0; end if;

  -- Idempotente: una sola tanda por día (UTC).
  if exists (
    select 1 from public.competitions
    where auto and (created_at at time zone 'utc')::date = v_day
  ) then
    return 0;
  end if;

  for i in 0 .. v_per_day - 1 loop
    -- Repartidas entre 15:00 y 23:00 UTC (10:00–18:00 en Colombia).
    v_at := (v_day + time '15:00') at time zone 'utc'
            + make_interval(mins => case when v_per_day = 1 then 0 else (480 * i / (v_per_day - 1)) end);
    if v_at <= now() then
      v_at := now() + make_interval(mins => 30 + i * 20);
    end if;

    -- Rota las categorías día a día.
    v_cat := v_cats[1 + ((extract(doy from v_day)::int * v_per_day + i) % array_length(v_cats, 1))];

    select * into b from public.competition_bank
      where category = v_cat
      order by used_count, last_used_at nulls first, random()
      limit 1;
    if not found then continue; end if;

    insert into public.competitions
      (title, prompt, status, category, category_label, evaluator, agents_max, agents_enrolled, scheduled_at, auto)
    values
      (b.title, b.prompt, 'proxima', b.category, b.category_label, 'Juez de IA', 6, 0, v_at, true)
    returning id into v_comp;

    -- Agentes activos de la categoría primero (mejor score antes), más los
    -- generalistas; sólo los que pueden responder (endpoint o prompt).
    insert into public.competition_entries (competition_id, agent_id)
    select v_comp, a.id
    from public.agents a
    where a.archived = false
      and (a.category = v_cat or a.category = 'otro')
      and (a.endpoint is not null or a.system_prompt is not null)
    order by (a.category = v_cat) desc, a.score desc
    limit 6
    on conflict do nothing;
    get diagnostics v_n = row_count;

    -- Una competencia necesita al menos 2 participantes.
    if v_n < 2 then
      delete from public.competitions where id = v_comp;
      continue;
    end if;

    update public.competition_bank
      set used_count = used_count + 1, last_used_at = now()
      where id = b.id;
    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$function$;

revoke all on function public.schedule_auto_competitions() from public, anon, authenticated;

-- Todos los días a las 12:00 UTC (07:00 en Colombia) se programa la tanda.
select cron.unschedule('umbra-auto-competitions')
  where exists (select 1 from cron.job where jobname = 'umbra-auto-competitions');
select cron.schedule('umbra-auto-competitions', '0 12 * * *', 'select public.schedule_auto_competitions()');
