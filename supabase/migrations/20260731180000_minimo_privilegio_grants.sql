-- Endurecimiento de privilegios (minimo privilegio) para anon/authenticated.
-- RLS ya bloquea el abuso (verificado en pentest), pero por defecto Supabase
-- concede casi todo a estos roles; esto quita lo que la app NUNCA usa, para que
-- un futuro error de policy o un RLS deshabilitado por accidente no se vuelva
-- explotable. Las funciones SECURITY DEFINER (owned by postgres) y service_role
-- NO se ven afectadas: corren con sus propios privilegios.

-- 1) Privilegios que ningun cliente usa nunca:
--    - DELETE: no existe ninguna policy DELETE => el cliente jamas borra via API.
--    - TRUNCATE/TRIGGER/REFERENCES: no son alcanzables por PostgREST.
revoke truncate, delete, trigger, references on all tables in schema public from anon, authenticated;

-- 2) Tablas que solo escribe el servidor (RPC SECURITY DEFINER / service_role),
--    nunca el cliente (solo tienen policy SELECT para leer):
revoke insert, update on public.competitions, public.evaluations, public.certificate_issuances from anon, authenticated;

-- 3) anon no crea ni edita recursos de usuario (RLS ya lo bloquea porque no hay
--    auth.uid(); esto lo hace explicito y reduce superficie):
revoke insert, update on public.agents, public.agent_versions, public.competition_entries, public.marketplace_listings from anon;
