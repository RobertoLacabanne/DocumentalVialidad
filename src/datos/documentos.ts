// Documentos leídos, su texto por página y las sugerencias pendientes, en
// tiempo real. Y lo que hace falta para proponer sugerencias.
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Documento, DocumentoPagina, DocumentoResumen, Sugerencia } from '../lib/tipos';
import { todas, useEnVivo } from './causa';

export type DocumentoVista = Documento & { resumen: DocumentoResumen | null };

export function useDocumentos(causaId: string) {
  const docs = useQuery({ queryKey: ['documentos', causaId], queryFn: () => todas<Documento>('documento', causaId) });
  const resumen = useQuery({
    queryKey: ['documentos-resumen', causaId],
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_resumen').select('*').eq('causa_id', causaId);
      if (error) throw new Error(error.message);
      return (data ?? []) as DocumentoResumen[];
    },
  });
  useEnVivo(causaId, ['documento'], [
    ['documentos', causaId],
    ['documentos-resumen', causaId],
  ]);
  const filas = useMemo<DocumentoVista[]>(() => {
    const r = new Map((resumen.data ?? []).map((x) => [x.documento_id, x]));
    return (docs.data ?? [])
      .map((d) => ({ ...d, resumen: r.get(d.id) ?? null }))
      .sort((a, b) => (a.ruta ?? a.nombre).localeCompare(b.ruta ?? b.nombre, 'es', { numeric: true }));
  }, [docs.data, resumen.data]);
  return { filas, cargando: docs.isLoading, error: docs.error as Error | null };
}

export function usePaginas(documentoId: string | null) {
  return useQuery({
    queryKey: ['paginas', documentoId],
    enabled: !!documentoId,
    queryFn: async () => {
      const filas: DocumentoPagina[] = [];
      for (let desde = 0; ; desde += 500) {
        const { data, error } = await supabase
          .from('documento_pagina')
          .select('id,documento_id,nro,texto,metodo,motor,confianza,leido_en')
          .eq('documento_id', documentoId!)
          .order('nro')
          .range(desde, desde + 499);
        if (error) throw new Error(error.message);
        filas.push(...((data ?? []) as DocumentoPagina[]));
        if (!data || data.length < 500) break;
      }
      return filas;
    },
  });
}

/** Una página por su id (para abrir un resultado de la búsqueda). */
export function usePaginaPorId(id: string | null) {
  return useQuery({
    queryKey: ['pagina', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('documento_pagina').select('documento_id,nro').eq('id', id!).maybeSingle();
      if (error) throw new Error(error.message);
      return data as { documento_id: string; nro: number } | null;
    },
  });
}

export function useSugerencias(causaId: string) {
  const q = useQuery({ queryKey: ['sugerencias', causaId], queryFn: () => todas<Sugerencia>('sugerencia', causaId) });
  useEnVivo(causaId, ['sugerencia'], [['sugerencias', causaId]]);
  return q.data ?? [];
}

export type DatosParaSugerir = {
  efectos: { id: string; numero: string }[];
  contrataciones: { id: string; identificador: string; expediente: string | null }[];
  personas: { id: string; nombre: string; identificadores: { tipo: string; valor: string }[] }[];
  enlaces: { entidad_id: string; sha256: string | null; nombre_archivo: string | null }[];
  piezas: { id: string; numero_orden: string | null; titulo: string }[];
};

/** Todo lo de la causa contra lo que se compara el texto de un documento, fresco en el momento. */
export async function datosParaSugerir(causaId: string): Promise<DatosParaSugerir> {
  const [efectos, contrataciones, personas, identificadores, enlaces, piezas] = await Promise.all([
    todas<{ id: string; numero: string }>('efecto', causaId, 'id,numero'),
    todas<{ id: string; identificador: string; expediente: string | null }>('contratacion', causaId, 'id,identificador,expediente'),
    todas<{ id: string; nombre: string }>('persona', causaId, 'id,nombre'),
    todas<{ persona_id: string | null; tipo: string; valor: string }>('identificador', causaId, 'persona_id,tipo,valor'),
    todas<{ entidad_id: string; sha256: string | null; nombre_archivo: string | null }>('enlace', causaId, 'entidad_id,sha256,nombre_archivo'),
    todas<{ id: string; numero_orden: string | null; titulo: string }>('pieza', causaId, 'id,numero_orden,titulo'),
  ]);
  const porPersona = new Map<string, { tipo: string; valor: string }[]>();
  for (const i of identificadores) if (i.persona_id) porPersona.set(i.persona_id, [...(porPersona.get(i.persona_id) ?? []), i]);
  return {
    efectos,
    contrataciones,
    personas: personas.map((p) => ({ ...p, identificadores: porPersona.get(p.id) ?? [] })),
    enlaces,
    piezas,
  };
}
