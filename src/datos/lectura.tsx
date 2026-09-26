// Cola de lectura de documentos. Vive en el marco de la causa, así que sigue
// leyendo aunque la persona cambie de pantalla. Cada tanda de páginas se
// guarda apenas se lee: si se corta, al volver a arrastrar el archivo sigue
// desde donde quedó (lo reconoce por su huella).
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motivoNoLeible, sha256Hex, type PaginaLeida } from '../lib/documentos';
import { abrirPdf, crearOcr, esPdf, leerImagen, leerPaginaPdf, trabajadoresSugeridos, type ArchivoConRuta, type Ocr } from '../lib/lector';
import { sugerirParaDocumento } from '../lib/sugerencias';
import { supabase } from '../lib/supabase';
import { datosParaSugerir, type DatosParaSugerir } from './documentos';
import { traducirError } from './guardado';

export type EstadoTarea = 'esperando' | 'huella' | 'leyendo' | 'sugiriendo' | 'listo' | 'ya_estaba' | 'omitido' | 'error' | 'cancelado';

export type Tarea = {
  id: string;
  nombre: string;
  ruta: string;
  bytes: number;
  estado: EstadoTarea;
  paginas: number;
  leidas: number;
  porOcr: number;
  porCapa: number;
  documentoId?: string;
  mensaje?: string;
  sugerencias?: number;
};

type Contexto = {
  tareas: Tarea[];
  enCurso: boolean;
  pausado: boolean;
  agregar: (archivos: ArchivoConRuta[]) => void;
  pausar: () => void;
  seguir: () => void;
  cancelar: () => void;
  limpiar: () => void;
};

const LecturaContexto = createContext<Contexto | null>(null);

export function useLectura() {
  const c = useContext(LecturaContexto);
  if (!c) throw new Error('useLectura fuera del marco de la causa');
  return c;
}

export const TERMINADA = (e: EstadoTarea) => ['listo', 'ya_estaba', 'omitido', 'error', 'cancelado'].includes(e);
const TANDA = 4;

export function ProveedorLectura({ causaId, children }: { causaId: string; children: ReactNode }) {
  const qc = useQueryClient();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [pausado, setPausado] = useState(false);
  const archivos = useRef(new Map<string, File>());
  const corriendo = useRef(false);
  const frenar = useRef<'pausa' | 'cancelar' | null>(null);
  const ocr = useRef<Promise<Ocr> | null>(null);
  const cierreOcr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const datos = useRef<{ en: number; d: DatosParaSugerir } | null>(null);

  const cambiar = useCallback((id: string, cambio: Partial<Tarea> | ((t: Tarea) => Partial<Tarea>)) => {
    setTareas((l) => l.map((t) => (t.id === id ? { ...t, ...(typeof cambio === 'function' ? cambio(t) : cambio) } : t)));
  }, []);

  const obtenerOcr = useCallback(() => {
    if (cierreOcr.current) clearTimeout(cierreOcr.current);
    ocr.current ??= crearOcr();
    return ocr.current;
  }, []);

  const agregar = useCallback((lista: ArchivoConRuta[]) => {
    setTareas((previas) => {
      const nuevas: Tarea[] = [];
      for (const { archivo, ruta } of lista) {
        if (archivo.name.startsWith('.')) continue;
        const repetida = previas.some((t) => t.ruta === ruta && t.bytes === archivo.size && !TERMINADA(t.estado));
        if (repetida) continue;
        const id = crypto.randomUUID();
        const motivo = motivoNoLeible(archivo.name);
        if (!motivo) archivos.current.set(id, archivo);
        nuevas.push({
          id,
          nombre: archivo.name,
          ruta,
          bytes: archivo.size,
          estado: motivo ? 'omitido' : 'esperando',
          mensaje: motivo ?? undefined,
          paginas: 0,
          leidas: 0,
          porOcr: 0,
          porCapa: 0,
        });
      }
      return [...previas, ...nuevas];
    });
  }, []);

  const leer = useCallback(
    async (t: Tarea) => {
      const archivo = archivos.current.get(t.id);
      if (!archivo) return cambiar(t.id, { estado: 'error', mensaje: 'Se perdió el archivo: volvé a arrastrarlo.' });
      let pdf: Awaited<ReturnType<typeof abrirPdf>> | null = null;
      try {
        cambiar(t.id, { estado: 'huella', mensaje: undefined });
        const buf = await archivo.arrayBuffer();
        const sha256 = await sha256Hex(buf);
        let paginas = 1;
        if (esPdf(archivo)) {
          pdf = await abrirPdf(buf);
          paginas = pdf.numPages;
        }
        const { data: reg, error: e1 } = await supabase.rpc('registrar_documento', {
          p_causa: causaId,
          p_datos: { sha256, nombre: archivo.name, ruta: t.ruta, bytes: archivo.size, tipo_mime: archivo.type || null, paginas },
        });
        if (e1) throw new Error(e1.message);
        const r = reg as { id: string; ya_estaba: boolean; leidas: number; nombre: string };
        void qc.invalidateQueries({ queryKey: ['documentos', causaId] });
        if (r.ya_estaba && r.leidas >= paginas) {
          const otroNombre = r.nombre !== archivo.name ? ` como «${r.nombre}»` : '';
          return cambiar(t.id, { estado: 'ya_estaba', documentoId: r.id, paginas, leidas: paginas, mensaje: `Ya estaba leído${otroNombre}.` });
        }
        const { data: hechas, error: e2 } = await supabase.from('documento_pagina').select('nro').eq('documento_id', r.id);
        if (e2) throw new Error(e2.message);
        const leidas = new Set((hechas ?? []).map((p) => (p as { nro: number }).nro));
        const faltan = Array.from({ length: paginas }, (_, i) => i + 1).filter((n) => !leidas.has(n));
        cambiar(t.id, { estado: 'leyendo', documentoId: r.id, paginas, leidas: leidas.size, mensaje: leidas.size ? `Sigue desde donde había quedado (${leidas.size} de ${paginas} páginas ya leídas).` : undefined });

        const pendientes: PaginaLeida[] = [];
        const guardar = async () => {
          if (!pendientes.length) return;
          const tanda = pendientes.splice(0);
          const { error } = await supabase.rpc('guardar_paginas', { p_documento: r.id, p_paginas: tanda });
          if (error) throw new Error(error.message);
          void qc.invalidateQueries({ queryKey: ['documentos-resumen', causaId] });
        };
        let siguiente = 0;
        const trabajar = async () => {
          while (siguiente < faltan.length && !frenar.current) {
            const nro = faltan[siguiente++];
            const p = pdf ? await leerPaginaPdf(pdf, nro, obtenerOcr) : await leerImagen(archivo, obtenerOcr);
            pendientes.push(p);
            cambiar(t.id, (x) => ({ leidas: x.leidas + 1, porOcr: x.porOcr + (p.metodo === 'ocr' ? 1 : 0), porCapa: x.porCapa + (p.metodo === 'capa_texto' ? 1 : 0) }));
            if (pendientes.length >= TANDA) await guardar();
          }
        };
        await Promise.all(Array.from({ length: pdf ? Math.min(trabajadoresSugeridos(), faltan.length) : 1 }, trabajar));
        await guardar();

        if (frenar.current === 'pausa') return cambiar(t.id, { estado: 'esperando', mensaje: 'En pausa: lo leído quedó guardado.' });
        if (frenar.current === 'cancelar') {
          return cambiar(t.id, { estado: 'cancelado', mensaje: 'Cancelado. Lo leído quedó guardado: si lo volvés a arrastrar, sigue desde ahí.' });
        }

        // Sugerencias: con todo el texto del documento y los datos de la causa en ese momento.
        cambiar(t.id, { estado: 'sugiriendo' });
        if (!datos.current || Date.now() - datos.current.en > 60_000) datos.current = { en: Date.now(), d: await datosParaSugerir(causaId) };
        const [{ data: textos }, { data: doc }] = await Promise.all([
          supabase.from('documento_pagina').select('nro,texto').eq('documento_id', r.id).order('nro'),
          supabase.from('documento').select('efecto_id,pieza_id').eq('id', r.id).single(),
        ]);
        const items = sugerirParaDocumento(
          { nombre: archivo.name, ruta: t.ruta, sha256, paginas: ((textos ?? []) as { nro: number; texto: string | null }[]).map((x) => ({ nro: x.nro, texto: x.texto ?? '' })), actual: doc ?? undefined },
          datos.current.d,
        );
        let nuevas = 0;
        if (items.length) {
          const { data: n, error: e3 } = await supabase.rpc('guardar_sugerencias', { p_causa: causaId, p_entidad: r.id, p_items: items });
          if (e3) throw new Error(e3.message);
          nuevas = n as number;
          void qc.invalidateQueries({ queryKey: ['sugerencias', causaId] });
        }
        cambiar(t.id, { estado: 'listo', sugerencias: nuevas, mensaje: undefined });
        void qc.invalidateQueries({ queryKey: ['documentos', causaId] });
      } catch (e) {
        cambiar(t.id, { estado: 'error', mensaje: traducirError((e as Error).message) });
      } finally {
        await pdf?.loadingTask.destroy();
      }
    },
    [causaId, cambiar, obtenerOcr, qc],
  );

  // El bucle: toma el próximo archivo en espera, de a uno.
  useEffect(() => {
    if (corriendo.current || pausado) return;
    const proxima = tareas.find((t) => t.estado === 'esperando');
    if (!proxima) {
      if (ocr.current && !cierreOcr.current) {
        // Sin nada para leer, libera la memoria del OCR al rato.
        cierreOcr.current = setTimeout(() => {
          void ocr.current?.then((o) => o.cerrar());
          ocr.current = null;
          cierreOcr.current = null;
        }, 30_000);
      }
      return;
    }
    corriendo.current = true;
    frenar.current = null;
    void leer(proxima).finally(() => {
      corriendo.current = false;
      if (frenar.current === 'cancelar') {
        setTareas((l) => l.map((t) => (t.estado === 'esperando' ? { ...t, estado: 'cancelado', mensaje: 'Cancelado antes de empezar.' } : t)));
      }
      frenar.current = null;
      setTareas((l) => [...l]);
    });
  }, [tareas, pausado, leer]);

  const enCurso = tareas.some((t) => !TERMINADA(t.estado) && !(pausado && t.estado === 'esperando'));

  // Si se cierra la pestaña a mitad de camino, se avisa.
  useEffect(() => {
    if (!enCurso) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [enCurso]);

  useEffect(
    () => () => {
      frenar.current = 'cancelar';
      void ocr.current?.then((o) => o.cerrar());
    },
    [],
  );

  const valor = useMemo<Contexto>(
    () => ({
      tareas,
      enCurso,
      pausado,
      agregar,
      pausar: () => {
        frenar.current = 'pausa';
        setPausado(true);
      },
      seguir: () => {
        frenar.current = null;
        setPausado(false);
      },
      cancelar: () => {
        frenar.current = 'cancelar';
        setPausado(false);
        setTareas((l) => l.map((t) => (t.estado === 'esperando' ? { ...t, estado: 'cancelado', mensaje: 'Cancelado antes de empezar.' } : t)));
      },
      limpiar: () => {
        setTareas((l) => {
          for (const t of l) if (TERMINADA(t.estado)) archivos.current.delete(t.id);
          return l.filter((t) => !TERMINADA(t.estado));
        });
      },
    }),
    [tareas, enCurso, pausado, agregar],
  );

  return <LecturaContexto.Provider value={valor}>{children}</LecturaContexto.Provider>;
}
