-- Refuerzo de fiabilidad del inicio automatico: el cron solo dispara una
-- competencia programada si tiene AL MENOS UN agente inscrito. Antes, una
-- competencia vencida sin agentes se disparaba igual, run-competition devolvia
-- 400 "no hay agentes" y como run_due_competitions ya habia puesto scheduled_at
-- = null, quedaba en 'proxima' para siempre (nunca arrancaba). Ahora espera:
-- si mas tarde se inscribe un agente, el siguiente tick la dispara.
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
    where c.status = 'proxima' and c.scheduled_at is not null and c.scheduled_at <= now()
      and exists (select 1 from public.competition_entries e where e.competition_id = c.id)
  loop
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', v_anon,
        'Authorization', 'Bearer ' || v_anon,
        'x-cron-secret', v_secret
      ),
      body := jsonb_build_object('competitionId', r.id)
    );
    -- Evita re-disparo antes de que run-competition cambie el estado.
    update public.competitions set scheduled_at = null where id = r.id;
  end loop;
end;
$function$;
