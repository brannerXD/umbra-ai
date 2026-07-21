-- Emite (o rota) la llave de una compra de tipo "acceso".
-- La llave se genera dentro de Postgres y se devuelve en claro UNA sola vez:
-- en la tabla queda solo su hash. Si el comprador la pierde, vuelve a llamar
-- esta funcion y la anterior deja de servir.
create or replace function public.issue_license(p_purchase_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_buyer   uuid;
  v_listing uuid;
  v_status  text;
  v_type    text;
  v_key     text;
begin
  select p.buyer_id, p.listing_id, p.status, l.listing_type
    into v_buyer, v_listing, v_status, v_type
  from purchases p
  join marketplace_listings l on l.id = p.listing_id
  where p.id = p_purchase_id;

  if v_buyer is null then
    raise exception 'La compra no existe.';
  end if;
  if v_buyer <> auth.uid() then
    raise exception 'No autorizado.';
  end if;
  if v_status <> 'completada' then
    raise exception 'La compra aun no esta completada.';
  end if;
  if v_type <> 'acceso' then
    raise exception 'Esta compra no otorga acceso por API.';
  end if;

  v_key := 'umbra_sk_' || encode(extensions.gen_random_bytes(24), 'hex');

  insert into agent_licenses (purchase_id, listing_id, buyer_id, key_hash, key_prefix)
  values (
    p_purchase_id,
    v_listing,
    v_buyer,
    encode(extensions.digest(v_key, 'sha256'), 'hex'),
    left(v_key, 17)
  )
  on conflict (purchase_id) do update set
    key_hash    = excluded.key_hash,
    key_prefix  = excluded.key_prefix,
    status      = 'activa',
    revoked_at  = null,
    created_at  = now();

  return v_key;
end;
$$;

-- Postgres concede EXECUTE a PUBLIC por defecto, y ademas Supabase aplica
-- ALTER DEFAULT PRIVILEGES que concede EXECUTE a anon sobre cada funcion nueva
-- del esquema public. Hay que retirar ambas: el revoke a PUBLIC no elimina la
-- concesion explicita al rol anon.
revoke execute on function public.issue_license(uuid) from public;
revoke execute on function public.issue_license(uuid) from anon;
grant  execute on function public.issue_license(uuid) to authenticated;
