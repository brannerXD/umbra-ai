// ========================================
// Variables de entorno del SERVIDOR (nunca importar desde el cliente)
// ========================================

/**
 * Llave secreta de Supabase (service_role / sb_secret_...). Sólo la usan las
 * rutas API del servidor. Se aceptan varios nombres:
 *  - SUPABASE_SECRET_KEY: el nombre canónico.
 *  - SUPABASE_SECRET_KEY_rotated: Vercel no permite renombrar variables
 *    "Sensitive"; al rotar la llave el 2026-10-04 quedó con este nombre.
 *  - SUPABASE_SERVICE_ROLE_KEY: nombre antiguo de Supabase.
 */
export function supabaseSecretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SECRET_KEY_rotated ??
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}
