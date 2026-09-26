// Consultas en tiempo real de efectos, procedimientos, personas, incidencias y actividad.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Efecto,
  EstadoProcesalEfecto,
  EventoHistorial,
  Identificador,
  IncidenciaProcesal,
  Persona,
  Procedimiento,
  RolEnCausa,
} from '../lib/tipos';

export const canal = (base: string) => `${base}:${Math.random().toString(36).slice(2, 10)}`;

export async function todas<T>(tabla: string, causaId: string, columnas = '*', orden?: string): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    let q = supabase.from(tabla).select(columnas).eq('causa_id', causaId).is('archivado_en', null);
    if (orden) q = q.order(orden, { ascending: true, nullsFirst: false });
    const { data, error } = await q.range(desde, desde + 999);
    if (error) throw new Error(error.message);
    filas.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return filas;
}

/** Refresca las consultas indicadas cuando cambia alguna de las tablas, para esta causa. */
export function useEnVivo(causaId: string, tablas: string[], claves: unknown[][]) {
  const qc = useQueryClient();
  const firma = tablas.join(',');
  useEffect(() => {
    let c = supabase.channel(canal(`vivo:${firma}:${causaId}`));
    for (const t of tablas) {
      c = c.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `causa_id=eq.${causaId}` }, () => {
        for (const k of claves) void qc.invalidateQueries({ queryKey: k });
      });
    }
    c.subscribe();
    return () => {
      void supabase.removeChannel(c);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [causaId, firma, qc]);
}

const COLUMNAS_EFECTO =
  'id,causa_id,procedimiento_id,numero,numero_clave,sobre,numero_interno,soporte,tipo_material,descripcion_acta,propietario,' +
  'tenedor,resolucion_autorizante,apto_analisis,informe_id,tiene_informe_gabinete,observaciones_gabinete,ubicacion_fisica,' +
  'responsable,responsable_alias,requiere_escribiente,estado,prioridad,fojas_aprox,fecha_inicio,fecha_fin,link_escaneo,' +
  'lugar_secuestro,patron_contrasena,observaciones,origen,creado_en,creado_por,actualizado_en,actualizado_por,version,' +
  'archivado_en,archivado_por';

export type EfectoVista = Efecto & {
  procedimiento: Procedimiento | null;
  informe_numero: string | null;
  situacion: EstadoProcesalEfecto | null;
  piezas: number;
};

export function useEfectos(causaId: string) {
  const efectos = useQuery({ queryKey: ['efectos', causaId], queryFn: () => todas<Efecto>('efecto', causaId, COLUMNAS_EFECTO, 'numero_clave') });
  const procedimientos = useQuery({ queryKey: ['procedimientos', causaId], queryFn: () => todas<Procedimiento>('procedimiento', causaId, '*', 'fecha') });
  const informes = useQuery({
    queryKey: ['informes-ref', causaId],
    queryFn: () => todas<{ id: string; numero: string }>('informe', causaId, 'id,numero'),
  });
  const estados = useQuery({
    queryKey: ['estado-procesal-efectos', causaId],
    queryFn: async () => {
      const { data, error } = await supabase.from('efecto_estado_procesal').select('*').eq('causa_id', causaId);
      if (error) throw new Error(error.message);
      return data as EstadoProcesalEfecto[];
    },
  });
  const piezas = useQuery({
    queryKey: ['piezas-por-efecto', causaId],
    queryFn: async () => {
      const filas = await todas<{ efecto_id: string | null }>('pieza', causaId, 'efecto_id');
      const conteo = new Map<string, number>();
      for (const f of filas) if (f.efecto_id) conteo.set(f.efecto_id, (conteo.get(f.efecto_id) ?? 0) + 1);
      return conteo;
    },
  });

  useEnVivo(causaId, ['efecto', 'procedimiento', 'informe', 'incidencia_procesal', 'incidencia_alcance', 'pieza'], [
    ['efectos', causaId],
    ['procedimientos', causaId],
    ['informes-ref', causaId],
    ['estado-procesal-efectos', causaId],
    ['estado-procesal', causaId],
    ['piezas-por-efecto', causaId],
    ['piezas-efecto'],
    ['incidencias-efecto'],
  ]);

  const filas = useMemo<EfectoVista[]>(() => {
    const proc = new Map((procedimientos.data ?? []).map((p) => [p.id, p]));
    const inf = new Map((informes.data ?? []).map((i) => [i.id, i.numero]));
    const est = new Map((estados.data ?? []).map((e) => [e.efecto_id, e]));
    return (efectos.data ?? []).map((e) => ({
      ...e,
      procedimiento: e.procedimiento_id ? proc.get(e.procedimiento_id) ?? null : null,
      informe_numero: e.informe_id ? inf.get(e.informe_id) ?? null : null,
      situacion: est.get(e.id) ?? null,
      piezas: piezas.data?.get(e.id) ?? 0,
    }));
  }, [efectos.data, procedimientos.data, informes.data, estados.data, piezas.data]);

  return {
    filas,
    procedimientos: procedimientos.data ?? [],
    cargando: efectos.isLoading,
    error: efectos.error as Error | null,
    reintentar: () => void efectos.refetch(),
  };
}

export function useIncidencias(causaId: string) {
  const q = useQuery({
    queryKey: ['incidencias', causaId],
    queryFn: () => todas<IncidenciaProcesal>('incidencia_procesal', causaId, '*', 'creado_en'),
  });
  useEnVivo(causaId, ['incidencia_procesal'], [['incidencias', causaId]]);
  return q;
}

/** Cuántas fichas (piezas, efectos, procedimientos…) alcanza cada situación procesal. */
export function useAlcances(causaId: string) {
  const q = useQuery({
    queryKey: ['alcances', causaId],
    queryFn: async () => {
      const filas = await todas<{ incidencia_id: string }>('incidencia_alcance', causaId, 'incidencia_id');
      const conteo = new Map<string, number>();
      for (const f of filas) conteo.set(f.incidencia_id, (conteo.get(f.incidencia_id) ?? 0) + 1);
      return conteo;
    },
  });
  useEnVivo(causaId, ['incidencia_alcance'], [['alcances', causaId]]);
  return q.data ?? new Map<string, number>();
}

export type PersonaVista = Persona & { identificadores: Identificador[]; roles: RolEnCausa[] };

export function usePersonas(causaId: string) {
  const personas = useQuery({ queryKey: ['personas', causaId], queryFn: () => todas<Persona>('persona', causaId, '*', 'nombre') });
  const identificadores = useQuery({ queryKey: ['identificadores', causaId], queryFn: () => todas<Identificador>('identificador', causaId) });
  const roles = useQuery({ queryKey: ['roles', causaId], queryFn: () => todas<RolEnCausa>('rol_en_causa', causaId) });
  useEnVivo(causaId, ['persona', 'identificador', 'rol_en_causa'], [
    ['personas', causaId],
    ['identificadores', causaId],
    ['roles', causaId],
  ]);
  const filas = useMemo<PersonaVista[]>(() => {
    const ids = new Map<string, Identificador[]>();
    for (const i of identificadores.data ?? []) if (i.persona_id) ids.set(i.persona_id, [...(ids.get(i.persona_id) ?? []), i]);
    const rs = new Map<string, RolEnCausa[]>();
    for (const r of roles.data ?? []) rs.set(r.persona_id, [...(rs.get(r.persona_id) ?? []), r]);
    return (personas.data ?? [])
      .map((p) => ({ ...p, identificadores: ids.get(p.id) ?? [], roles: rs.get(p.id) ?? [] }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [personas.data, identificadores.data, roles.data]);
  return {
    filas,
    identificadoresSueltos: (identificadores.data ?? []).filter((i) => !i.persona_id),
    cargando: personas.isLoading,
    error: personas.error as Error | null,
  };
}

export function useActividad(causaId: string, limite = 25) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['actividad', causaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auditoria')
        .select('id,ocurrido_en,causa_id,tabla,registro_id,accion,usuario_id,usuario_email,cambios,despues')
        .eq('causa_id', causaId)
        .order('ocurrido_en', { ascending: false })
        .order('id', { ascending: false })
        .limit(limite);
      if (error) throw new Error(error.message);
      return data as EventoHistorial[];
    },
  });
  useEffect(() => {
    const c = supabase
      .channel(canal(`actividad:${causaId}`))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'auditoria', filter: `causa_id=eq.${causaId}` }, (cambio) => {
        qc.setQueryData<EventoHistorial[]>(['actividad', causaId], (lista = []) =>
          [cambio.new as EventoHistorial, ...lista.filter((e) => e.id !== (cambio.new as EventoHistorial).id)].slice(0, limite),
        );
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(c);
    };
  }, [causaId, qc, limite]);
  return q;
}
