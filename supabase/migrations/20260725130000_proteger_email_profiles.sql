-- ════════════════════════════════════════════════════════════════════
-- PROTEGER EL EMAIL EN PROFILES
-- El correo estaba legible por anon/authenticated (fuga de privacidad). Con el
-- buscador y los perfiles públicos eso quedaría expuesto. Las filas siguen
-- siendo públicas (username, avatar, bio...), pero el email no.
--
-- OJO: revoke select (email) es un no-op mientras exista el GRANT SELECT de
-- tabla, porque ese grant cubre todas las columnas. Hay que revocar el de tabla
-- y re-conceder columna por columna, dejando el email fuera.
-- El dueño obtiene su propio correo desde la sesión de auth, no de esta tabla.
-- ════════════════════════════════════════════════════════════════════

revoke select on public.profiles from anon, authenticated;

grant select (
  id, username, avatar_url, avatar_chosen, bio, is_admin, created_at, username_updated_at
) on public.profiles to anon, authenticated;
