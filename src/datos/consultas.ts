import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { aliasDe } from '../lib/etiquetas';
import { supabase } from '../lib/supabase';
import type { Causa, EstadoProcesalPieza, EventoHistorial, Miembro, Pieza } from '../lib/tipos';
import type { FilaIndice } from '../componentes/TablaPiezas';
import { refrescarAlConectar } from './causa';

export const COLUMNAS_PIEZA =
  'id,causa_id,numero_orden,orden_clave,tipo,titulo,fecha_desde,fecha_hasta,fecha_precision,autor,destinatarios,' +
  'resumen,observaciones_analista,efecto_id,sobre,lugar_secuestro,fecha_secuestro,informe_id,fojas,conversacion_id,' +
  'mensaje_id,relevancia,estado_trabajo,responsable,etiquetas,origen,creado_en,creado_por,actualizado_en,' +
  'actualizado_por,version,archivado_en,archivado_por';

const PAGINA = 1000;

/** Cada suscripción necesita un canal propio: dos componentes no pueden compartir el mismo nombre. */
const canal = (base: string) => `${base}:${Math.random().toString(36).slice(2, 10)}`;

/** Trae todas las filas paginando de a 1000 (el límite de la API). */
async function traerTodo<T>(armar: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const todo: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await armar(desde, desde + PAGINA - 1);
    if (error) throw new Error(error.message);
    todo.push(...(data ?? []));
    if (!data || data.length < PAGINA) break;
  }
  return todo;
}

// ---------------------------------------------------------------------
// Miembros
// ---------------------------------------------------------------------
export function useMiembros() {
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: ['miembros'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('miembro')
        .select('id,email,nombre,alias,activo,user_id,invitado_por,ultimo_ingreso,creado_en,creado_por,actualizado_en,actualizado_por,version,archivado_en,archivado_por')
        .is('archivado_en', null)
        .order('alias', { nullsFirst: false });
      if (error) throw new Error(error.message);
      return data as Miembro[];
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    const suscripcion = supabase
      .channel(canal('miembros'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'miembro' }, () => {
        void qc.invalidateQueries({ queryKey: ['miembros'] });
      })
      .subscribe(refrescarAlConectar(qc, [['miembros']]));
    return () => {
      void supabase.removeChannel(suscripcion);
    };
  }, [qc]);

  return consulta;
}

/** Busca a una persona del equipo por correo o por id de usuario. */
export function useDirectorio() {
  const { data: miembros = [] } = useMiembros();
  return useMemo(() => {
    const porEmail = new Map(miembros.map((m) => [m.email, m]));
    const porUsuario = new Map(miembros.filter((m) => m.user_id).map((m) => [m.user_id!, m]));
    return {
      miembros,
      porEmail: (email: string | null | undefined) => (email ? porEmail.get(email) : undefined),
      porUsuario: (id: string | null | undefined) => (id ? porUsuario.get(id) : undefined),
      alias: (email: string | null | undefined) => aliasDe(email ? porEmail.get(email) : undefined, email),
      aliasUsuario: (id: string | null | undefined) => {
        const m = id ? porUsuario.get(id) : undefined;
        return m ? aliasDe(m) : id ? 'Alguien del equipo' : 'Sistema';
      },
    };
  }, [miembros]);
}

// ---------------------------------------------------------------------
// Causas
// ---------------------------------------------------------------------
const COLUMNAS_CAUSA =
  'id,legajo_fiscalia,numero_oga,caratula,fiscales,delitos,objeto,estado,fecha_alta,formato_cita,observaciones,' +
  'creado_en,creado_por,actualizado_en,actualizado_por,version,archivado_en,archivado_por';

export function useCausas() {
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: ['causas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('causa').select(COLUMNAS_CAUSA).is('archivado_en', null).order('fecha_alta', { ascending: false });
      if (error) throw new Error(error.message);
      return data as unknown as Causa[];
    },
  });
  useEffect(() => {
    const suscripcion = supabase
      .channel(canal('causas'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'causa' }, () => {
        void qc.invalidateQueries({ queryKey: ['causas'] });
      })
      .subscribe(refrescarAlConectar(qc, [['causas']]));
    return () => {
      void supabase.removeChannel(suscripcion);
    };
  }, [qc]);
  return consulta;
}

export function useCausa(id: string | undefined) {
  const { data: causas, ...resto } = useCausas();
  return { ...resto, data: causas?.find((c) => c.id === id) };
}

export function useConteoPiezas() {
  return useQuery({
    queryKey: ['conteo-piezas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pieza').select('causa_id').is('archivado_en', null).limit(100000);
      if (error) throw new Error(error.message);
      const conteo = new Map<string, number>();
      for (const f of data as { causa_id: string }[]) conteo.set(f.causa_id, (conteo.get(f.causa_id) ?? 0) + 1);
      return conteo;
    },
  });
}

// ---------------------------------------------------------------------
// Índice de prueba: piezas + efectos + informes + estado procesal, en tiempo real
// ---------------------------------------------------------------------
type Referencia = { id: string; numero: string };

export function useIndice(causaId: string, miUsuario: string | null) {
  const qc = useQueryClient();
  const [recienLlegadas, setRecienLlegadas] = useState<Set<string>>(new Set());
  const [conectado, setConectado] = useState<'conectando' | 'conectado' | 'desconectado'>('conectando');

  const piezas = useQuery({
    queryKey: ['piezas', causaId],
    queryFn: () =>
      traerTodo<Pieza>((desde, hasta) =>
        supabase
          .from('pieza')
          .select(COLUMNAS_PIEZA)
          .eq('causa_id', causaId)
          .is('archivado_en', null)
          .order('orden_clave', { ascending: true, nullsFirst: false })
          .order('creado_en', { ascending: true })
          .range(desde, hasta) as unknown as PromiseLike<{ data: Pieza[] | null; error: { message: string } | null }>,
      ),
  });
  const efectos = useQuery({
    queryKey: ['efectos-ref', causaId],
    queryFn: () =>
      traerTodo<Referencia>((desde, hasta) =>
        supabase.from('efecto').select('id,numero').eq('causa_id', causaId).range(desde, hasta),
      ),
  });
  const informes = useQuery({
    queryKey: ['informes-ref', causaId],
    queryFn: () =>
      traerTodo<Referencia>((desde, hasta) =>
        supabase.from('informe').select('id,numero').eq('causa_id', causaId).range(desde, hasta),
      ),
  });
  const estados = useQuery({
    queryKey: ['estado-procesal', causaId],
    queryFn: async () => {
      const { data, error } = await supabase.from('pieza_estado_procesal').select('*').eq('causa_id', causaId);
      if (error) throw new Error(error.message);
      return data as EstadoProcesalPieza[];
    },
  });

  const refUsuario = useRef(miUsuario);
  refUsuario.current = miUsuario;

  useEffect(() => {
    const suscripcion = supabase
      .channel(canal(`indice:${causaId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pieza', filter: `causa_id=eq.${causaId}` }, (cambio) => {
        const nueva = cambio.new as Pieza;
        if (!nueva?.id) return;
        qc.setQueryData<Pieza[]>(['piezas', causaId], (lista = []) => {
          const sin = lista.filter((p) => p.id !== nueva.id);
          const previa = lista.find((p) => p.id === nueva.id);
          if (nueva.archivado_en) return sin;
          if (previa && previa.version > nueva.version) return lista;
          return [...sin, nueva];
        });
        if (cambio.eventType === 'INSERT' && nueva.creado_por !== refUsuario.current) {
          setRecienLlegadas((s) => new Set(s).add(nueva.id));
          window.setTimeout(
            () =>
              setRecienLlegadas((s) => {
                const n = new Set(s);
                n.delete(nueva.id);
                return n;
              }),
            3000,
          );
        }
        void qc.invalidateQueries({ queryKey: ['estado-procesal', causaId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'efecto', filter: `causa_id=eq.${causaId}` }, () => {
        void qc.invalidateQueries({ queryKey: ['efectos-ref', causaId] });
        void qc.invalidateQueries({ queryKey: ['estado-procesal', causaId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'informe', filter: `causa_id=eq.${causaId}` }, () => {
        void qc.invalidateQueries({ queryKey: ['informes-ref', causaId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidencia_procesal', filter: `causa_id=eq.${causaId}` }, () => {
        void qc.invalidateQueries({ queryKey: ['estado-procesal', causaId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidencia_alcance', filter: `causa_id=eq.${causaId}` }, () => {
        void qc.invalidateQueries({ queryKey: ['estado-procesal', causaId] });
      })
      .subscribe((estado) => {
        if (estado === 'SUBSCRIBED') {
          setConectado('conectado');
          // Al reconectar, traigo lo que me perdí.
          void qc.invalidateQueries({ queryKey: ['piezas', causaId] });
        } else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT' || estado === 'CLOSED') {
          setConectado('desconectado');
        }
      });
    return () => {
      void supabase.removeChannel(suscripcion);
    };
  }, [causaId, qc]);

  const directorio = useDirectorio();

  const filas = useMemo<FilaIndice[]>(() => {
    const ef = new Map((efectos.data ?? []).map((e) => [e.id, e.numero]));
    const inf = new Map((informes.data ?? []).map((i) => [i.id, i.numero]));
    const est = new Map((estados.data ?? []).map((e) => [e.pieza_id, e]));
    return (piezas.data ?? []).map((p) => ({
      ...p,
      efecto_numero: p.efecto_id ? ef.get(p.efecto_id) ?? null : null,
      informe_numero: p.informe_id ? inf.get(p.informe_id) ?? null : null,
      situacion: est.get(p.id) ?? null,
      responsable_alias: p.responsable ? directorio.alias(p.responsable) : null,
    }));
  }, [piezas.data, efectos.data, informes.data, estados.data, directorio]);

  return {
    filas,
    cargando: piezas.isLoading,
    error: piezas.error as Error | null,
    reintentar: () => void piezas.refetch(),
    recienLlegadas,
    conectado,
  };
}

// ---------------------------------------------------------------------
// Historial de una ficha, en tiempo real
// ---------------------------------------------------------------------
export function useHistorial(registroId: string | null) {
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: ['historial', registroId],
    enabled: Boolean(registroId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auditoria')
        .select('id,ocurrido_en,causa_id,tabla,registro_id,accion,usuario_id,usuario_email,cambios')
        .eq('registro_id', registroId!)
        .order('ocurrido_en', { ascending: false })
        .limit(60);
      if (error) throw new Error(error.message);
      return data as EventoHistorial[];
    },
  });

  useEffect(() => {
    if (!registroId) return;
    const suscripcion = supabase
      .channel(canal(`historial:${registroId}`))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'auditoria', filter: `registro_id=eq.${registroId}` }, (cambio) => {
        qc.setQueryData<EventoHistorial[]>(['historial', registroId], (lista = []) =>
          lista.some((e) => e.id === (cambio.new as EventoHistorial).id) ? lista : [cambio.new as EventoHistorial, ...lista],
        );
      })
      .subscribe(refrescarAlConectar(qc, [['historial', registroId]]));
    return () => {
      void supabase.removeChannel(suscripcion);
    };
  }, [registroId, qc]);

  return consulta;
}

// ---------------------------------------------------------------------
// Enlaces de una ficha
// ---------------------------------------------------------------------
export type Enlace = {
  id: string;
  entidad_id: string;
  etiqueta: string;
  url: string | null;
  ruta_local: string | null;
  nombre_archivo: string | null;
  sha256: string | null;
  creado_en: string;
};

export function useEnlaces(entidadId: string | null) {
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: ['enlaces', entidadId],
    enabled: Boolean(entidadId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enlace')
        .select('id,entidad_id,etiqueta,url,ruta_local,nombre_archivo,sha256,creado_en')
        .eq('entidad_id', entidadId!)
        .is('archivado_en', null)
        .order('creado_en');
      if (error) throw new Error(error.message);
      return data as Enlace[];
    },
  });
  useEffect(() => {
    if (!entidadId) return;
    const suscripcion = supabase
      .channel(canal(`enlaces:${entidadId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enlace', filter: `entidad_id=eq.${entidadId}` }, () => {
        void qc.invalidateQueries({ queryKey: ['enlaces', entidadId] });
      })
      .subscribe(refrescarAlConectar(qc, [['enlaces', entidadId]]));
    return () => {
      void supabase.removeChannel(suscripcion);
    };
  }, [entidadId, qc]);
  return consulta;
}
