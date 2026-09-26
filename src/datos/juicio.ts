// Consultas en tiempo real de la Fase 3: ofrecimiento de prueba, actos
// procesales y cronología.
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Admision, Clase, Incorporacion, ItemOfrecido } from '../lib/ofrecimiento';
import { supabase } from '../lib/supabase';
import type { Comunes } from '../lib/tipos';
import { todas, useEnVivo, type PersonaVista } from './causa';
import type { FilaIndice } from '../componentes/TablaPiezas';

export type FilaOfrecimiento = Comunes & {
  causa_id: string;
  clase: Clase;
  pieza_id: string | null;
  persona_id: string | null;
  numero: string | null;
  descripcion: string | null;
  objeto: string | null;
  entregada_defensa: boolean;
  fecha_entrega: string | null;
  constancia_entrega: string | null;
  acuerdo_probatorio: string | null;
  incorporacion: Incorporacion | null;
  introduce_id: string | null;
  partes_a_exhibir: string | null;
  requiere_escaneo: boolean;
  ubicacion_fisica: string | null;
  admision: Admision;
  numero_auto: string | null;
  impugnada: boolean;
  motivo_impugnacion: string | null;
  imputados: string[];
  todos_los_imputados: boolean;
  tambien_ofrecida_por: string[];
  observaciones: string | null;
};

export type ItemVista = FilaOfrecimiento & ItemOfrecido & { piezaFila: FilaIndice | null; personaFila: PersonaVista | null };

export function useOfrecimiento(causaId: string, piezas: FilaIndice[], personas: PersonaVista[]) {
  const q = useQuery({
    queryKey: ['ofrecimiento', causaId],
    queryFn: () => todas<FilaOfrecimiento>('ofrecimiento_item', causaId, '*', 'numero_clave'),
  });
  useEnVivo(causaId, ['ofrecimiento_item'], [['ofrecimiento', causaId]]);
  const items = useMemo<ItemVista[]>(() => {
    const mp = new Map(piezas.map((p) => [p.id, p]));
    const mpe = new Map(personas.map((p) => [p.id, p]));
    return (q.data ?? []).map((f) => {
      const p = f.pieza_id ? mp.get(f.pieza_id) ?? null : null;
      const pe = f.persona_id ? mpe.get(f.persona_id) ?? null : null;
      return {
        ...f,
        imputados: f.imputados ?? [],
        tambien_ofrecida_por: f.tambien_ofrecida_por ?? [],
        piezaFila: p,
        personaFila: pe,
        pieza: p
          ? {
              numero_orden: p.numero_orden,
              titulo: p.titulo,
              efecto_numero: p.efecto_numero,
              informe_numero: p.informe_numero,
              sobre: p.sobre,
              fojas: p.fojas,
              situacion: p.situacion?.situacion ?? null,
              incidencia: p.situacion?.titulo ?? null,
            }
          : null,
        persona: pe ? { nombre: pe.nombre, cargo: pe.cargo } : null,
      };
    });
  }, [q.data, piezas, personas]);
  return { items, cargando: q.isLoading, error: q.error as Error | null };
}

export type TipoActo = 'allanamiento' | 'resolucion' | 'audiencia' | 'planteo' | 'otro';

export type ActoProcesal = Comunes & {
  causa_id: string;
  fecha: string | null;
  fecha_precision: string;
  tipo: TipoActo;
  titulo: string;
  descripcion: string | null;
  observaciones: string | null;
  link: string | null;
};

export function useActos(causaId: string) {
  const q = useQuery({ queryKey: ['actos', causaId], queryFn: () => todas<ActoProcesal>('acto_procesal', causaId, '*', 'fecha') });
  useEnVivo(causaId, ['acto_procesal'], [['actos', causaId], ['cronologia', causaId]]);
  return q.data ?? [];
}

export type TipoHito = 'pieza' | 'mensaje' | 'paso' | 'allanamiento' | 'acto' | 'planteo' | 'resolucion';

export type Hito = {
  tipo: TipoHito;
  id: string;
  fecha: string;
  fecha_precision: string;
  fecha_texto: string | null;
  titulo: string;
  detalle: string | null;
  referencia: string | null;
  relacionados: string[];
};

export function useCronologia(causaId: string) {
  const q = useQuery({
    queryKey: ['cronologia', causaId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('cronologia', { p_causa: causaId });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Hito[]).map((h) => ({ ...h, relacionados: h.relacionados ?? [] }));
    },
  });
  useEnVivo(causaId, ['pieza', 'mensaje', 'paso_tramite', 'procedimiento', 'acto_procesal', 'incidencia_procesal', 'vinculo'], [['cronologia', causaId]]);
  return { hitos: q.data ?? [], cargando: q.isLoading, error: q.error as Error | null };
}
