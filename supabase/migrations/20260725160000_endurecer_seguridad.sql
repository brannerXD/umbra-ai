-- ════════════════════════════════════════════════════════════════════
-- ENDURECIMIENTO DE SEGURIDAD
-- 1) Cierra escalada de privilegios: quita UPDATE de profiles.is_admin.
--    Antes, cualquier usuario autenticado podia hacerse admin a si mismo.
-- 2) Cierra falsificacion de reputacion: el cliente ya no puede editar
--    score/wins/verified/comps_count/avg_score/etc. en agents. Esos valores
--    SOLO los escribe la Edge Function run-competition con service_role, que
--    ignora estos grants por columna.
-- 3) Restringe EXECUTE de las funciones SECURITY DEFINER a usuarios
--    autenticados (cada una valida dueno/admin adentro). El trigger
--    sync_agents_enrolled deja de ser invocable como RPC por nadie.
-- 4) Restaura los buckets de avatars e imagenes a publicos (la app los lee
--    por URL publica, getPublicUrl). agent-code permanece privado (solo
--    dueno/comprador via URL firmada).
-- No rompe flujos legitimos: verificado contra lo que la app escribe de verdad
-- (profiles: username/bio/avatar_url/avatar_chosen; agents: description/archived).
-- ════════════════════════════════════════════════════════════════════

-- ── 1 y 2. UPDATE por columna: solo lo que el usuario edita de verdad ──
revoke update on public.profiles from anon, authenticated;
grant  update (username, bio, avatar_url, avatar_chosen) on public.profiles to authenticated;

revoke update on public.agents from anon, authenticated;
grant  update (description, archived) on public.agents to authenticated;

-- ── 3. EXECUTE de funciones: solo autenticados; cada una valida adentro ──
revoke execute on function public.admin_feedback()                                    from public, anon;
grant  execute on function public.admin_feedback()                                    to authenticated;
revoke execute on function public.admin_growth(integer)                               from public, anon;
grant  execute on function public.admin_growth(integer)                               to authenticated;
revoke execute on function public.admin_set_feedback_published(uuid, boolean)         from public, anon;
grant  execute on function public.admin_set_feedback_published(uuid, boolean)         to authenticated;
revoke execute on function public.admin_stats()                                       from public, anon;
grant  execute on function public.admin_stats()                                       to authenticated;
revoke execute on function public.admin_user_activity(integer)                        from public, anon;
grant  execute on function public.admin_user_activity(integer)                        to authenticated;
revoke execute on function public.create_competition(text, text, text, text, integer) from public, anon;
grant  execute on function public.create_competition(text, text, text, text, integer) to authenticated;
revoke execute on function public.issue_certificate(uuid, text)                       from public, anon;
grant  execute on function public.issue_certificate(uuid, text)                       to authenticated;
revoke execute on function public.issue_license(uuid)                                 from public, anon;
grant  execute on function public.issue_license(uuid)                                 to authenticated;
revoke execute on function public.my_activity(integer)                                from public, anon;
grant  execute on function public.my_activity(integer)                                to authenticated;
revoke execute on function public.my_agent_prompt(uuid)                               from public, anon;
grant  execute on function public.my_agent_prompt(uuid)                               to authenticated;
revoke execute on function public.my_reputation_journey()                             from public, anon;
grant  execute on function public.my_reputation_journey()                             to authenticated;
revoke execute on function public.seller_stats()                                      from public, anon;
grant  execute on function public.seller_stats()                                      to authenticated;

-- El trigger no debe poder llamarse como RPC por nadie.
revoke execute on function public.sync_agents_enrolled() from public, anon, authenticated;

-- ── 4. Storage: avatars e imagenes publicos (assets publicos por diseno);
--       el codigo de agentes permanece privado (solo dueno/comprador). ──
update storage.buckets set public = true  where id in ('avatars', 'agent-images');
update storage.buckets set public = false where id = 'agent-code';
