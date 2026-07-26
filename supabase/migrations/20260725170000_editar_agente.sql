-- ════════════════════════════════════════════════════════════════════
-- EDITOR DE AGENTE
-- 1) Columna generada `kind` (endpoint/prompt/codigo) para mostrar de qué
--    tipo es cada agente. No revela el secreto, solo la clasificación.
-- 2) Cooldowns: name_updated_at (90 días) y prompt_updated_at (6 horas).
--    NULL = nunca editado = se puede editar ya (primera vez libre).
-- 3) RPCs SECURITY DEFINER para editar nombre y prompt: validan dueño,
--    cooldown y (para prompt) que sea un agente de prompt. El cliente ya
--    no tiene UPDATE directo sobre esas columnas (blindaje previo).
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Tipo de agente (clasificación pública, sin exponer secretos) ──
alter table public.agents add column if not exists kind text
  generated always as (
    case
      when endpoint is not null then 'endpoint'
      when system_prompt is not null then 'prompt'
      else 'codigo'
    end
  ) stored;

-- ── 2. Marcas de tiempo para los cooldowns ──
alter table public.agents add column if not exists name_updated_at   timestamptz;
alter table public.agents add column if not exists prompt_updated_at timestamptz;

-- El cliente necesita leer estas 3 columnas nuevas (SELECT es por columna).
grant select (kind, name_updated_at, prompt_updated_at) on public.agents to anon, authenticated;

-- ── 3a. Editar el nombre (cada 90 días) ──
create or replace function public.update_my_agent_name(p_agent_id uuid, p_name text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_last  timestamptz;
  v_name  text := trim(p_name);
begin
  select owner_id, name_updated_at into v_owner, v_last
  from public.agents where id = p_agent_id;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'No autorizado';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'El nombre debe tener entre 2 y 60 caracteres';
  end if;
  if v_last is not null and now() - v_last < interval '90 days' then
    raise exception 'Solo puedes cambiar el nombre cada 90 dias';
  end if;

  update public.agents
     set name = v_name, name_updated_at = now()
   where id = p_agent_id;

  return now();
end;
$$;

-- ── 3b. Editar el prompt (cada 6 horas; solo agentes de prompt) ──
create or replace function public.update_my_agent_prompt(p_agent_id uuid, p_prompt text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner     uuid;
  v_last      timestamptz;
  v_is_prompt boolean;
begin
  select owner_id, prompt_updated_at, (system_prompt is not null)
    into v_owner, v_last, v_is_prompt
  from public.agents where id = p_agent_id;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'No autorizado';
  end if;
  if not coalesce(v_is_prompt, false) then
    raise exception 'Este agente no es de tipo prompt';
  end if;
  if char_length(trim(p_prompt)) < 10 then
    raise exception 'El prompt es demasiado corto';
  end if;
  if char_length(p_prompt) > 4000 then
    raise exception 'El prompt no puede pasar de 4000 caracteres';
  end if;
  if v_last is not null and now() - v_last < interval '6 hours' then
    raise exception 'Solo puedes cambiar el prompt cada 6 horas';
  end if;

  update public.agents
     set system_prompt = p_prompt, prompt_updated_at = now()
   where id = p_agent_id;

  return now();
end;
$$;

-- Solo usuarios autenticados; cada función valida al dueño adentro.
revoke execute on function public.update_my_agent_name(uuid, text)   from public, anon;
grant  execute on function public.update_my_agent_name(uuid, text)   to authenticated;
revoke execute on function public.update_my_agent_prompt(uuid, text) from public, anon;
grant  execute on function public.update_my_agent_prompt(uuid, text) to authenticated;
