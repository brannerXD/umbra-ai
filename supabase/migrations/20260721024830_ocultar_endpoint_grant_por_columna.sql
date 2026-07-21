-- El endpoint del vendedor es el activo que protege la modalidad "Licencia por
-- URL": si cualquiera puede leerlo, nadie necesita comprar el acceso. Hasta
-- ahora la politica agents_select_all (using true) lo exponia a todo el mundo,
-- incluidos usuarios anonimos, y ademas viajaba al navegador en cada consulta.
--
-- RLS filtra filas, no columnas. Y un revoke por columna es un no-op mientras
-- exista un GRANT SELECT a nivel de TABLA, porque este cubre todas las columnas
-- de forma implicita. La forma correcta es retirar el permiso de tabla y
-- volver a concederlo columna por columna, omitiendo endpoint.
--
-- INSERT y UPDATE quedan intactos: el registro de agentes debe seguir pudiendo
-- guardar el endpoint aunque despues nadie pueda leerlo de vuelta.
-- service_role conserva el acceso completo: lo necesitan run-competition y el
-- proxy de /api/v1/run.

revoke select on public.agents from anon, authenticated;

grant select (
  id, owner_id, name, description, category, avatar_url, verified,
  score, wins, comps_count, created_at, avg_score, category_label,
  last_comp, score_evolution, archived
) on public.agents to anon, authenticated;
