import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ResultadoCampo } from '../componentes/Ficha';
import type { EstadoGuardado } from '../componentes/estados';
import { useToast } from '../componentes/Toast';
import { aliasDe, CAMPOS } from '../lib/etiquetas';
import { supabase } from '../lib/supabase';
import type { Miembro, Pieza, ResultadoGuardado } from '../lib/tipos';

type Pendiente = { tabla: string; id: string; campo: string; anterior: unknown; nuevo: unknown };

type Contexto = {
  estado: EstadoGuardado;
  guardarCampo: (tabla: string, id: string, campo: string, anterior: unknown, nuevo: unknown) => Promise<ResultadoCampo>;
};

const GuardadoContexto = createContext<Contexto | null>(null);
const CLAVE_COLA = 'tp-cola';

function leerCola(): Pendiente[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_COLA) ?? '[]') as Pendiente[];
  } catch {
    return [];
  }
}
function escribirCola(cola: Pendiente[]) {
  try {
    if (cola.length) localStorage.setItem(CLAVE_COLA, JSON.stringify(cola));
    else localStorage.removeItem(CLAVE_COLA);
  } catch {
    /* sin almacenamiento local: la cola vive solo en memoria */
  }
}

const esFallaDeRed = (mensaje: string) => !navigator.onLine || /fetch|network|conexi|timeout/i.test(mensaje);

export function ProveedorGuardado({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { avisar } = useToast();
  const [estado, setEstado] = useState<EstadoGuardado>(() => {
    const cola = leerCola();
    return cola.length ? { tipo: 'sin_conexion', enCola: cola.length } : { tipo: 'guardado', cuando: null };
  });
  const cola = useRef<Pendiente[]>(leerCola());
  const procesando = useRef(false);

  const quienCambio = useCallback(
    (fila: Record<string, unknown>) => {
      const miembros = qc.getQueryData<Miembro[]>(['miembros']) ?? [];
      const m = miembros.find((x) => x.user_id === fila.actualizado_por);
      return m ? aliasDe(m) : 'Otra persona';
    },
    [qc],
  );

  const aplicarEnCache = useCallback(
    (tabla: string, fila: Record<string, unknown>) => {
      if (tabla === 'pieza') {
        const p = fila as unknown as Pieza;
        qc.setQueryData<Pieza[]>(['piezas', p.causa_id], (lista) => {
          if (!lista) return lista;
          if (p.archivado_en) return lista.filter((x) => x.id !== p.id);
          const previa = lista.find((x) => x.id === p.id);
          if (previa && previa.version > p.version) return lista;
          return previa ? lista.map((x) => (x.id === p.id ? p : x)) : [...lista, p];
        });
      } else if (tabla === 'causa') {
        void qc.invalidateQueries({ queryKey: ['causas'] });
      } else if (tabla === 'miembro') {
        void qc.invalidateQueries({ queryKey: ['miembros'] });
      }
    },
    [qc],
  );

  const enviar = useCallback(
    async (p: Pendiente): Promise<ResultadoCampo | 'sin_red'> => {
      const { data, error } = await supabase.rpc('guardar_campo', {
        p_tabla: p.tabla,
        p_id: p.id,
        p_campo: p.campo,
        p_valor_anterior: p.anterior,
        p_valor_nuevo: p.nuevo,
      });
      if (error) {
        if (esFallaDeRed(error.message)) return 'sin_red';
        return { tipo: 'error', mensaje: traducirError(error.message) };
      }
      const r = data as ResultadoGuardado<Record<string, unknown>>;
      aplicarEnCache(p.tabla, r.fila);
      if (!r.ok) return { tipo: 'conflicto', actual: r.fila[p.campo], quien: quienCambio(r.fila) };
      return { tipo: 'ok' };
    },
    [aplicarEnCache, quienCambio],
  );

  const vaciarCola = useCallback(async () => {
    if (procesando.current || !cola.current.length) return;
    procesando.current = true;
    setEstado({ tipo: 'guardando' });
    while (cola.current.length) {
      const siguiente = cola.current[0];
      const r = await enviar(siguiente);
      if (r === 'sin_red') {
        setEstado({ tipo: 'sin_conexion', enCola: cola.current.length });
        procesando.current = false;
        return;
      }
      cola.current = cola.current.slice(1);
      escribirCola(cola.current);
      if (r.tipo === 'conflicto') {
        avisar(`Un cambio en cola no se aplicó: ${r.quien} ya había cambiado «${CAMPOS[siguiente.campo] ?? siguiente.campo}». Revisá la ficha.`, {
          tono: 'aviso',
          duracion: 9000,
        });
      } else if (r.tipo === 'error') {
        avisar(`Un cambio en cola no se pudo guardar: ${r.mensaje}`, { tono: 'error', duracion: 9000 });
      }
    }
    procesando.current = false;
    setEstado({ tipo: 'guardado', cuando: new Date() });
    avisar('Volvió la conexión. Se guardaron los cambios pendientes.');
  }, [enviar, avisar]);

  useEffect(() => {
    const alVolver = () => void vaciarCola();
    const alIrse = () => setEstado({ tipo: 'sin_conexion', enCola: cola.current.length });
    window.addEventListener('online', alVolver);
    window.addEventListener('offline', alIrse);
    if (navigator.onLine) void vaciarCola();
    return () => {
      window.removeEventListener('online', alVolver);
      window.removeEventListener('offline', alIrse);
    };
  }, [vaciarCola]);

  const guardarCampo = useCallback<Contexto['guardarCampo']>(
    async (tabla, id, campo, anterior, nuevo) => {
      const p: Pendiente = { tabla, id, campo, anterior, nuevo };
      if (!navigator.onLine || cola.current.length) {
        cola.current = [...cola.current, p];
        escribirCola(cola.current);
        setEstado({ tipo: 'sin_conexion', enCola: cola.current.length });
        return { tipo: 'ok' };
      }
      setEstado({ tipo: 'guardando' });
      const r = await enviar(p);
      if (r === 'sin_red') {
        cola.current = [...cola.current, p];
        escribirCola(cola.current);
        setEstado({ tipo: 'sin_conexion', enCola: cola.current.length });
        return { tipo: 'ok' };
      }
      if (r.tipo === 'error') setEstado({ tipo: 'error', mensaje: r.mensaje });
      else setEstado({ tipo: 'guardado', cuando: new Date() });
      return r;
    },
    [enviar],
  );

  const valor = useMemo(() => ({ estado, guardarCampo }), [estado, guardarCampo]);
  return <GuardadoContexto.Provider value={valor}>{children}</GuardadoContexto.Provider>;
}

export function useGuardado() {
  const c = useContext(GuardadoContexto);
  if (!c) throw new Error('useGuardado fuera de ProveedorGuardado');
  return c;
}

export function traducirError(mensaje: string): string {
  if (/row-level security|permission denied/i.test(mensaje)) return 'Tu cuenta no tiene acceso. Pedile a alguien del equipo que te habilite.';
  if (/check constraint/i.test(mensaje)) return 'Ese valor no es válido para este campo.';
  if (/duplicate key/i.test(mensaje)) return 'Ya existe otro registro con ese dato.';
  if (/invalid input syntax for type date/i.test(mensaje)) return 'La fecha no es válida.';
  return mensaje;
}
