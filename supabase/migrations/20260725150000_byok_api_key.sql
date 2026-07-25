-- ════════════════════════════════════════════════════════════════════
-- BYOK: cada agente de prompt trae su propia API key
-- El creador paga su propio consumo de IA, no Umbra. La llave se guarda
-- oculta (igual que endpoint y system_prompt): el cliente la puede
-- escribir pero NO leer; solo el service_role la usa en el servidor.
-- ════════════════════════════════════════════════════════════════════

alter table public.agents add column if not exists api_key text;

-- agents no tiene grant de SELECT a nivel de tabla (es por columna), así que la
-- columna nueva no es legible por defecto. Lo dejamos explícito de todos modos.
revoke select (api_key) on public.agents from anon, authenticated;
