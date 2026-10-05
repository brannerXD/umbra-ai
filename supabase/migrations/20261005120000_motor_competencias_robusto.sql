-- Motor de competencias robusto.
--
-- 1. El cron llamaba a run-competition con el timeout por defecto de pg_net
--    (5 s). Al cortarse la conexión, la Edge Function moría a mitad de camino:
--    competencias con respuestas pero SIN puntajes, o atascadas "en-curso" para
--    siempre. Ahora el timeout es de 150 s (el máximo de una Edge Function).
-- 2. Vigilante: una competencia "en-curso" desde hace más de 15 min se
--    considera atascada y se vuelve a lanzar. run-competition reutiliza las
--    respuestas ya guardadas, así que sólo repite lo que faltó (el juez).
-- 3. judge_attempts: cuántas veces falló el juez. run-competition reintenta
--    (re-programa en 10 min) hasta 3 veces antes de cerrar sin ganador.

alter table public.competitions
  add column if not exists judge_attempts integer not null default 0;

create or replace function public.run_due_competitions()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_secret text;
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2a2VqbHNpbnR2a2Nxd2lzZGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTY4ODgsImV4cCI6MjA5ODQzMjg4OH0.TAtoSTubuY0mZ_JUxDx94HUMOTrMQDy-fdq54IJB1Ck';
  v_url text := 'https://lvkejlsintvkcqwisdes.supabase.co/functions/v1/run-competition';
begin
  select value into v_secret from public.internal_config where key = 'cron_secret';
  if v_secret is null then return; end if;

  for r in
    select c.id from public.competitions c
    where exists (select 1 from public.competition_entries e where e.competition_id = c.id)
      and (
        -- Programadas y vencidas.
        (c.status = 'proxima' and c.scheduled_at is not null and c.scheduled_at <= now())
        -- Atascadas: en curso hace más de 15 min (la función murió a medias).
        or (c.status = 'en-curso' and c.started_at < now() - interval '15 minutes')
      )
  loop
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', v_anon,
        'Authorization', 'Bearer ' || v_anon,
        'x-cron-secret', v_secret
      ),
      body := jsonb_build_object('competitionId', r.id),
      -- Si la conexión se corta, la Edge Function se cancela: hay que esperar
      -- lo que tarde (agentes + juez), hasta el máximo de 150 s.
      timeout_milliseconds := 150000
    );
    -- Evita re-disparo antes de que run-competition cambie el estado: las
    -- programadas pierden su fecha y las atascadas se marcan como recién
    -- iniciadas (run-competition las vuelve a marcar al empezar).
    update public.competitions
      set scheduled_at = null,
          started_at = case when status = 'en-curso' then now() else started_at end
      where id = r.id;
  end loop;
end;
$function$;
