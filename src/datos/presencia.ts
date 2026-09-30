import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export type Presente = { email: string; alias: string; vista: string; piezaId: string | null; desde: string };

// Un solo canal de presencia por causa, compartido y con contador de usos.
// La liberación se demora un instante para que un desmontaje y montaje
// seguidos (navegación, modo estricto de React) no cierren y reabran el canal.
type Registro = {
  canal: RealtimeChannel;
  usos: number;
  oyentes: Set<(lista: Presente[]) => void>;
  suscripto: boolean;
  estado: Presente | null;
};
const registros = new Map<string, Registro>();

function tomar(causaId: string, clave: string): Registro {
  const existente = registros.get(causaId);
  if (existente) {
    existente.usos += 1;
    return existente;
  }
  const canal = supabase.channel(`presencia:${causaId}`, { config: { presence: { key: clave } } });
  const r: Registro = { canal, usos: 1, oyentes: new Set(), suscripto: false, estado: null };
  canal
    .on('presence', { event: 'sync' }, () => {
      const lista = Object.values(canal.presenceState<Presente>())
        .map((metas) => metas[metas.length - 1])
        .filter(Boolean) as Presente[];
      r.oyentes.forEach((f) => f(lista));
    })
    .subscribe((s) => {
      if (s === 'SUBSCRIBED') {
        r.suscripto = true;
        if (r.estado) void canal.track(r.estado);
      }
    });
  registros.set(causaId, r);
  return r;
}

function soltar(causaId: string) {
  const r = registros.get(causaId);
  if (!r) return;
  r.usos -= 1;
  window.setTimeout(() => {
    if (r.usos <= 0 && registros.get(causaId) === r) {
      registros.delete(causaId);
      void supabase.removeChannel(r.canal);
    }
  }, 1500);
}

/**
 * Quién está conectado a la causa y qué ficha está mirando.
 * Usa Presence de Supabase Realtime: no escribe nada en la base.
 */
export function usePresencia(causaId: string, yo: { email: string; alias: string }, vista: string, piezaId: string | null) {
  const [presentes, setPresentes] = useState<Presente[]>([]);
  const registro = useRef<Registro | null>(null);
  const desde = useRef(new Date().toISOString());

  useEffect(() => {
    if (!causaId) return;
    const r = tomar(causaId, yo.email);
    registro.current = r;
    r.oyentes.add(setPresentes);
    return () => {
      r.oyentes.delete(setPresentes);
      registro.current = null;
      soltar(causaId);
    };
  }, [causaId, yo.email]);

  useEffect(() => {
    const r = registro.current;
    if (!r) return;
    r.estado = { email: yo.email, alias: yo.alias, desde: desde.current, vista, piezaId };
    if (r.suscripto) void r.canal.track(r.estado);
  }, [causaId, vista, piezaId, yo.email, yo.alias]);

  const viendoPorPieza = useMemo(() => {
    const mapa: Record<string, { alias: string; email: string }[]> = {};
    for (const p of presentes) {
      if (p.email === yo.email || !p.piezaId) continue;
      (mapa[p.piezaId] ??= []).push({ alias: p.alias, email: p.email });
    }
    return mapa;
  }, [presentes, yo.email]);

  return { presentes, viendoPorPieza };
}
