-- Opiniones sobre Umbra. Nacen privadas: solo las ve el admin.
-- Publicar una exige consentimiento explicito del autor, y eso se hace cumplir
-- en la propia base para que no dependa de acordarse en la interfaz.

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  -- Si el usuario borra su cuenta, la opinion se conserva pero queda anonima.
  user_id    uuid references auth.users(id) on delete set null,
  rating     smallint check (rating between 1 and 5),
  message    text not null check (char_length(btrim(message)) between 3 and 2000),
  -- El autor autoriza que se muestre publicamente. El flujo para pedirlo se
  -- construye despues; por ahora se captura en el propio formulario.
  author_consent boolean not null default false,
  published      boolean not null default false,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),

  -- Sin consentimiento no se puede publicar. Es la regla del negocio, no un
  -- detalle de la interfaz, asi que vive aqui.
  constraint feedback_publicar_requiere_consentimiento
    check (not published or author_consent)
);

create index if not exists feedback_created_idx on public.feedback(created_at desc);

alter table public.feedback enable row level security;

-- Solo usuarios con sesion pueden opinar, y siempre en su propio nombre.
drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Cada quien ve lo que escribio.
drop policy if exists feedback_select_own on public.feedback;
create policy feedback_select_own on public.feedback
  for select to authenticated
  using (auth.uid() = user_id);

-- Las publicadas (que por el check ya tienen consentimiento) son visibles para
-- todos: deja listo el terreno para los testimonios en la landing.
drop policy if exists feedback_select_publicadas on public.feedback;
create policy feedback_select_publicadas on public.feedback
  for select to anon, authenticated
  using (published);

-- El admin lee todo a traves de admin_feedback(), no por politica.
revoke all on public.feedback from anon, authenticated;
grant select, insert on public.feedback to authenticated;
grant select on public.feedback to anon;
