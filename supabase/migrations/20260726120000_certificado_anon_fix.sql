-- El certificado es PÚBLICO y verificable: la ruta /certificado/pdf lo genera
-- del lado del servidor con el rol anon (sin sesión). El endurecimiento previo
-- (20260725160000) revocó EXECUTE a anon en issue_certificate y rompió la
-- descarga para TODOS los agentes (devolvía 500 "No se pudo emitir").
-- Se restaura: la función es segura para anon — solo inserta una instantánea
-- de datos reales del agente y exige >=3 competencias; no deja forjar valores
-- ni escalar privilegios.
grant execute on function public.issue_certificate(uuid, text) to anon, authenticated;
