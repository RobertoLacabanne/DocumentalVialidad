import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true si la app tiene los datos de conexión a Supabase. */
export const hayConexion = Boolean(url && clave);

/** Acceso con correo y contraseña: solo para desarrollo local y pruebas automáticas. */
export const accesoConClave = import.meta.env.VITE_ACCESO_CON_CLAVE === 'true';

export const supabase: SupabaseClient = hayConexion
  ? createClient(url!, clave!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      realtime: { params: { eventsPerSecond: 20 } },
    })
  : (null as unknown as SupabaseClient);
