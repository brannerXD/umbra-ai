-- Bandeja de opiniones para el admin: incluye las privadas, asi que va por
-- SECURITY DEFINER con el mismo control que admin_stats.

create or replace function public.admin_feedback()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'No autorizado: se requiere admin';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', f.id,
           'message', f.message,
           'rating', f.rating,
           'author_consent', f.author_consent,
           'published', f.published,
           'created_at', f.created_at,
           'author', coalesce(p.username, 'Cuenta eliminada')
         ) order by f.created_at desc), '[]'::jsonb)
    into result
  from public.feedback f
  left join public.profiles p on p.id = f.user_id;

  return result;
end;
$$;

-- Publicar o despublicar una opinion. El check de la tabla impide publicar sin
-- consentimiento, asi que aqui se devuelve un mensaje claro en vez del error
-- crudo de Postgres.
create or replace function public.admin_set_feedback_published(
  p_id uuid,
  p_published boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_consent boolean;
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'No autorizado: se requiere admin';
  end if;

  select author_consent into v_consent from public.feedback where id = p_id;
  if v_consent is null then
    raise exception 'La opinion no existe.';
  end if;
  if p_published and not v_consent then
    raise exception 'El autor no autorizo publicar esta opinion.';
  end if;

  update public.feedback
     set published = p_published,
         published_at = case when p_published then now() else null end
   where id = p_id;
end;
$$;

revoke execute on function public.admin_feedback() from public, anon;
grant  execute on function public.admin_feedback() to authenticated;

revoke execute on function public.admin_set_feedback_published(uuid, boolean) from public, anon;
grant  execute on function public.admin_set_feedback_published(uuid, boolean) to authenticated;
