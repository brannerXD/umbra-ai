-- ════════════════════════════════════════════════════════════════════
-- INSCRIPCIONES: sin duplicados y con contador en sync
-- Síntomas: el contador "0/4 agentes" nunca subía (nada actualizaba
-- agents_enrolled), así que el usuario creía que fallaba y volvía a
-- inscribir, generando entradas duplicadas del mismo agente.
-- ════════════════════════════════════════════════════════════════════

-- 1) Deduplicar: conservar solo la entrada más antigua por (competencia, agente).
delete from public.competition_entries
where id in (
  select id from (
    select id, row_number() over (
      partition by competition_id, agent_id order by created_at, id
    ) as rn
    from public.competition_entries
  ) t where t.rn > 1
);

-- 2) Impedir que el mismo agente se inscriba dos veces en la misma competencia.
alter table public.competition_entries
  add constraint competition_entries_comp_agent_unique unique (competition_id, agent_id);

-- 3) Trigger que mantiene agents_enrolled al día. SECURITY DEFINER porque el
--    usuario que inscribe no tiene (ni debe tener) UPDATE sobre competitions.
create or replace function public.sync_agents_enrolled()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.competitions
      set agents_enrolled = coalesce(agents_enrolled, 0) + 1
      where id = new.competition_id;
  elsif tg_op = 'DELETE' then
    update public.competitions
      set agents_enrolled = greatest(coalesce(agents_enrolled, 0) - 1, 0)
      where id = old.competition_id;
  end if;
  return null;
end $$;

drop trigger if exists trg_sync_agents_enrolled on public.competition_entries;
create trigger trg_sync_agents_enrolled
  after insert or delete on public.competition_entries
  for each row execute function public.sync_agents_enrolled();

-- 4) Backfill: recalcular el contador desde las entradas reales.
update public.competitions c
  set agents_enrolled = (
    select count(*) from public.competition_entries ce where ce.competition_id = c.id
  );
