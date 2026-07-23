-- ════════════════════════════════════════════════════════════════════
-- AGENTES POR PROMPT
-- Permite crear un agente sin desplegar ningun servidor: el usuario
-- escribe un prompt de sistema y Umbra lo ejecuta contra un modelo.
-- ════════════════════════════════════════════════════════════════════

alter table public.agents add column if not exists system_prompt text;

-- El prompt de sistema es el activo del creador, igual que el endpoint del
-- vendedor: si fuera publico, cualquiera copiaria al agente que va ganando.
-- El GRANT de SELECT en agents es a nivel de columna, asi que la columna
-- nueva NO queda legible por defecto. Lo dejamos explicito de todos modos.
revoke select (system_prompt) on public.agents from anon, authenticated;

-- El dueño si necesita releerlo para poder iterar sobre su prompt.
create or replace function public.my_agent_prompt(p_agent_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select a.system_prompt
  from public.agents a
  where a.id = p_agent_id
    and a.owner_id = auth.uid()
$$;

-- Supabase concede EXECUTE a anon por defecto en funciones nuevas.
revoke execute on function public.my_agent_prompt(uuid) from public, anon;
grant execute on function public.my_agent_prompt(uuid) to authenticated;
