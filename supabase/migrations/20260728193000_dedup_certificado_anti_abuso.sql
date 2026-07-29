-- Anti-abuso: la funcion de certificados es anonima (la usa la ruta del PDF en
-- /certificado/pdf, que corre como anon). Antes insertaba una fila por cada
-- llamada, lo que permitia a un anonimo inflar la tabla certificate_issuances.
-- Ahora reutiliza una emision reciente (5 min) para el mismo agente+formato en
-- vez de crear una nueva. No cambia el resultado que ve el usuario: los datos
-- del certificado son los mismos dentro de esa ventana.
create or replace function public.issue_certificate(p_agent_id uuid, p_format text)
 returns certificate_issuances
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  a public.agents%rowtype;
  result public.certificate_issuances%rowtype;
begin
  if p_format not in ('web', 'pdf') then
    raise exception 'Formato de certificado invalido: %', p_format;
  end if;

  select * into a from public.agents where id = p_agent_id;
  if not found then
    raise exception 'Agente no encontrado';
  end if;

  -- Elegibilidad: minimo de competencias (igual que MIN_COMPS_FOR_CERTIFICATE en la app).
  if coalesce(a.comps_count, 0) < 3 then
    raise exception 'El agente no es elegible para certificado';
  end if;

  -- Reutiliza una emision reciente para el mismo agente+formato (evita spam anonimo).
  select * into result
  from public.certificate_issuances
  where agent_id = a.id and format = p_format
    and issued_at > now() - interval '5 minutes'
  order by issued_at desc
  limit 1;
  if found then
    return result;
  end if;

  insert into public.certificate_issuances
    (agent_id, format, agent_name, avg_score, comps_count, wins, score)
  values
    (a.id, p_format, a.name, a.avg_score, coalesce(a.comps_count, 0), coalesce(a.wins, 0), coalesce(a.score, 0))
  returning * into result;

  return result;
end;
$function$;
