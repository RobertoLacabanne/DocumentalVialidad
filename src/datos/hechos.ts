// Consultas en tiempo real de la Fase 2: contrataciones (con su trámite y sus
// ofertas), conversaciones, mensajes y vínculos entre fichas.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Contratacion, Conversacion, ConversacionResumen, Mensaje, Oferta, PasoTramite, Vinculo } from '../lib/tipos';
import { canal, refrescarAlConectar, todas, useEnVivo } from './causa';

export type ContratacionVista = Contratacion & { pasos: PasoTramite[]; ofertas: Oferta[] };

const porOrden = <T extends { orden: number | null; creado_en: string }>(a: T, b: T) =>
  (a.orden ?? Number.MAX_SAFE_INTEGER) - (b.orden ?? Number.MAX_SAFE_INTEGER) || a.creado_en.localeCompare(b.creado_en);

export function useContrataciones(causaId: string) {
  const contrataciones = useQuery({
    queryKey: ['contrataciones', causaId],
    queryFn: () => todas<Contratacion>('contratacion', causaId, '*', 'identificador'),
  });
  const pasos = useQuery({ queryKey: ['pasos', causaId], queryFn: () => todas<PasoTramite>('paso_tramite', causaId) });
  const ofertas = useQuery({ queryKey: ['ofertas', causaId], queryFn: () => todas<Oferta>('oferta', causaId) });
  useEnVivo(causaId, ['contratacion', 'paso_tramite', 'oferta'], [
    ['contrataciones', causaId],
    ['pasos', causaId],
    ['ofertas', causaId],
  ]);
  const filas = useMemo<ContratacionVista[]>(() => {
    const ps = new Map<string, PasoTramite[]>();
    for (const p of pasos.data ?? []) ps.set(p.contratacion_id, [...(ps.get(p.contratacion_id) ?? []), p]);
    const os = new Map<string, Oferta[]>();
    for (const o of ofertas.data ?? []) os.set(o.contratacion_id, [...(os.get(o.contratacion_id) ?? []), o]);
    return (contrataciones.data ?? [])
      .map((c) => ({ ...c, pasos: (ps.get(c.id) ?? []).sort(porOrden), ofertas: (os.get(c.id) ?? []).sort(porOrden) }))
      .sort((a, b) => a.identificador.localeCompare(b.identificador, 'es', { numeric: true }));
  }, [contrataciones.data, pasos.data, ofertas.data]);
  return { filas, cargando: contrataciones.isLoading, error: contrataciones.error as Error | null };
}

export function useVinculos(causaId: string) {
  const q = useQuery({ queryKey: ['vinculos', causaId], queryFn: () => todas<Vinculo>('vinculo', causaId) });
  useEnVivo(causaId, ['vinculo'], [['vinculos', causaId]]);
  return q.data ?? [];
}

export type PiezaRef = { id: string; numero_orden: string | null; titulo: string; efecto_id: string | null };

export function usePiezasRef(causaId: string) {
  const q = useQuery({
    queryKey: ['piezas-ref', causaId],
    queryFn: () => todas<PiezaRef>('pieza', causaId, 'id,numero_orden,titulo,efecto_id', 'orden_clave'),
  });
  useEnVivo(causaId, ['pieza'], [['piezas-ref', causaId]]);
  return q.data ?? [];
}

export type ConversacionVista = Conversacion & { resumen: ConversacionResumen | null };

export function useConversaciones(causaId: string) {
  const conversaciones = useQuery({
    queryKey: ['conversaciones', causaId],
    queryFn: () => todas<Conversacion>('conversacion', causaId, '*', 'titulo'),
  });
  const resumenes = useQuery({
    queryKey: ['conversaciones-resumen', causaId],
    queryFn: async () => {
      const { data, error } = await supabase.from('conversacion_resumen').select('*').eq('causa_id', causaId);
      if (error) throw new Error(error.message);
      return data as ConversacionResumen[];
    },
  });
  useEnVivo(causaId, ['conversacion'], [['conversaciones', causaId], ['conversaciones-resumen', causaId]]);
  const filas = useMemo<ConversacionVista[]>(() => {
    const r = new Map((resumenes.data ?? []).map((x) => [x.conversacion_id, x]));
    return (conversaciones.data ?? []).map((c) => ({ ...c, resumen: r.get(c.id) ?? null }));
  }, [conversaciones.data, resumenes.data]);
  return { filas, cargando: conversaciones.isLoading, error: conversaciones.error as Error | null };
}

const COLUMNAS_MENSAJE =
  'id,causa_id,conversacion_id,orden,fecha,fecha_hora,fecha_hora_texto,emisor,receptor,tipo,contenido,hash_contenido,relevante,' +
  'observacion,origen,creado_en,creado_por,actualizado_en,actualizado_por,version,archivado_en,archivado_por';

/** Todos los mensajes de una conversación, en orden. Los cambios (relevante, observación) llegan solos. */
export function useMensajes(conversacionId: string | null) {
  const qc = useQueryClient();
  const clave = ['mensajes', conversacionId];
  const q = useQuery({
    queryKey: clave,
    enabled: Boolean(conversacionId),
    queryFn: async () => {
      const filas: Mensaje[] = [];
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await supabase
          .from('mensaje')
          .select(COLUMNAS_MENSAJE)
          .eq('conversacion_id', conversacionId!)
          .is('archivado_en', null)
          .order('orden', { ascending: true, nullsFirst: false })
          .order('creado_en', { ascending: true })
          .range(desde, desde + 999);
        if (error) throw new Error(error.message);
        filas.push(...((data ?? []) as unknown as Mensaje[]));
        if (!data || data.length < 1000) break;
      }
      return filas;
    },
  });
  useEffect(() => {
    if (!conversacionId) return;
    const c = supabase
      .channel(canal(`mensajes:${conversacionId}`))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensaje', filter: `conversacion_id=eq.${conversacionId}` }, (cambio) => {
        const nuevo = cambio.new as Mensaje;
        qc.setQueryData<Mensaje[]>(['mensajes', conversacionId], (lista) =>
          lista?.map((m) => (m.id === nuevo.id && m.version <= nuevo.version ? { ...m, ...nuevo } : m)),
        );
        void qc.invalidateQueries({ queryKey: ['conversaciones-resumen', nuevo.causa_id] });
      })
      // Una conversación puede tener miles de mensajes: se vuelven a traer solo al reconectarse.
      .subscribe(refrescarAlConectar(qc, [['mensajes', conversacionId]], { tambienLaPrimera: false }));
    return () => {
      void supabase.removeChannel(c);
    };
  }, [conversacionId, qc]);
  return { mensajes: q.data ?? [], cargando: q.isLoading, error: q.error as Error | null };
}

/** Actualiza un mensaje en la caché apenas se guarda, sin esperar al tiempo real. */
export function useAplicarMensaje() {
  const qc = useQueryClient();
  return (fila: Mensaje) => {
    qc.setQueryData<Mensaje[]>(['mensajes', fila.conversacion_id], (lista) => lista?.map((m) => (m.id === fila.id ? { ...m, ...fila } : m)));
    void qc.invalidateQueries({ queryKey: ['conversaciones-resumen', fila.causa_id] });
  };
}

export type MensajeRef = Pick<Mensaje, 'id' | 'conversacion_id' | 'fecha' | 'fecha_hora_texto' | 'emisor' | 'receptor' | 'tipo' | 'contenido' | 'relevante'>;

/** Mensajes sueltos por id (los vinculados a una contratación, por ejemplo). */
export function useMensajesPorId(ids: string[]) {
  const clave = [...ids].sort().join(',');
  const q = useQuery({
    queryKey: ['mensajes-ref', clave],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mensaje')
        .select('id,conversacion_id,fecha,fecha_hora_texto,emisor,receptor,tipo,contenido,relevante')
        .in('id', ids)
        .is('archivado_en', null);
      if (error) throw new Error(error.message);
      return data as MensajeRef[];
    },
  });
  return q.data ?? [];
}

/** Lo que está del otro lado de cada vínculo de una ficha. */
export function vinculosDe(vinculos: Vinculo[], id: string) {
  return vinculos
    .filter((v) => v.origen_id === id || v.destino_id === id)
    .map((v) => ({ vinculo: v, otro: v.origen_id === id ? v.destino_id : v.origen_id }));
}
