import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Miembro } from '../lib/tipos';

type EstadoSesion =
  | { tipo: 'cargando' }
  | { tipo: 'afuera' }
  | { tipo: 'sin_invitacion'; email: string }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'adentro'; sesion: Session; miembro: Miembro };

type Contexto = {
  estado: EstadoSesion;
  entrarConGoogle: () => Promise<void>;
  entrarConClave: (email: string, clave: string) => Promise<string | null>;
  salir: () => Promise<void>;
};

const SesionContexto = createContext<Contexto | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>({ tipo: 'cargando' });
  // Al volver de Google llegan casi juntos la sesión leída y el aviso de ingreso:
  // se verifica una sola vez por usuario.
  const verificacion = useRef<{ usuario: string; promesa: Promise<void> } | null>(null);

  const verificar = useCallback(async (sesion: Session | null) => {
    if (!sesion) {
      verificacion.current = null;
      setEstado({ tipo: 'afuera' });
      return;
    }
    if (verificacion.current?.usuario === sesion.user.id) return verificacion.current.promesa;
    const promesa = (async () => {
      const { data, error } = await supabase.rpc('registrar_ingreso');
      if (error) {
        verificacion.current = null;
        setEstado({ tipo: 'error', mensaje: error.message });
        return;
      }
      const r = data as { habilitado: boolean; email?: string; miembro?: Miembro };
      if (r.habilitado && r.miembro) setEstado({ tipo: 'adentro', sesion, miembro: r.miembro });
      else setEstado({ tipo: 'sin_invitacion', email: r.email ?? sesion.user.email ?? '' });
    })();
    verificacion.current = { usuario: sesion.user.id, promesa };
    return promesa;
  }, []);

  useEffect(() => {
    let vigente = true;
    supabase.auth.getSession().then(({ data }) => {
      if (vigente) void verificar(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') {
        // Fuera del callback: la documentación de Supabase recomienda no llamar a la API adentro.
        window.setTimeout(() => void verificar(sesion), 0);
      }
    });
    return () => {
      vigente = false;
      data.subscription.unsubscribe();
    };
  }, [verificar]);

  const valor = useMemo<Contexto>(
    () => ({
      estado,
      entrarConGoogle: async () => {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: 'select_account' } },
        });
      },
      entrarConClave: async (email, clave) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password: clave });
        return error ? error.message : null;
      },
      salir: async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('tp-cola');
        setEstado({ tipo: 'afuera' });
      },
    }),
    [estado],
  );

  return <SesionContexto.Provider value={valor}>{children}</SesionContexto.Provider>;
}

export function useSesion() {
  const c = useContext(SesionContexto);
  if (!c) throw new Error('useSesion fuera de ProveedorSesion');
  return c;
}

/** El miembro logueado. Solo usar dentro de pantallas protegidas. */
export function useYo(): Miembro {
  const { estado } = useSesion();
  if (estado.tipo !== 'adentro') throw new Error('useYo sin sesión');
  return estado.miembro;
}
