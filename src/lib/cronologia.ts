// Cronología: agrupar por año y mes, mostrar la fecha con su precisión y
// filtrar por persona (por nombre, apellido o cómo figura agendada).

import { claveNombre } from './nombres';

export type HitoBase = { tipo: string; fecha: string; fecha_precision: string; fecha_texto: string | null; titulo: string; detalle: string | null };

export const TIPOS_HITO: { valor: string; etiqueta: string; plural: string }[] = [
  { valor: 'pieza', etiqueta: 'Pieza', plural: 'Piezas' },
  { valor: 'mensaje', etiqueta: 'Mensaje', plural: 'Mensajes relevantes' },
  { valor: 'paso', etiqueta: 'Trámite', plural: 'Trámite de contrataciones' },
  { valor: 'allanamiento', etiqueta: 'Allanamiento', plural: 'Allanamientos' },
  { valor: 'acto', etiqueta: 'Acto procesal', plural: 'Actos procesales' },
  { valor: 'planteo', etiqueta: 'Planteo', plural: 'Planteos y resoluciones' },
  { valor: 'resolucion', etiqueta: 'Resolución', plural: 'Planteos y resoluciones' },
];

export const etiquetaHito = (t: string) => TIPOS_HITO.find((x) => x.valor === t)?.etiqueta ?? t;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2021-04-16" con su precisión → "16 abr", "abril", "2021"… (el año lo da el grupo). */
export function fechaHito(h: Pick<HitoBase, 'fecha' | 'fecha_precision'>): { dia: string; aproximada: boolean } {
  const [a, m, d] = h.fecha.split('-').map(Number);
  if (h.fecha_precision === 'anio') return { dia: String(a), aproximada: false };
  if (h.fecha_precision === 'mes') return { dia: MESES[m - 1], aproximada: false };
  return { dia: `${d} ${MESES_CORTOS[m - 1]}`, aproximada: h.fecha_precision === 'aproximada' };
}

export type GrupoMes<T extends HitoBase = HitoBase> = { clave: string; anio: number; mes: number; titulo: string; hitos: T[] };

/** Ordena por fecha y agrupa por año y mes. Lo que solo tiene año va al principio de su año. */
export function agruparPorMes<T extends HitoBase>(hitos: T[]): GrupoMes<T>[] {
  const ordenados = [...hitos].sort((x, y) => x.fecha.localeCompare(y.fecha) || x.titulo.localeCompare(y.titulo, 'es'));
  const grupos: GrupoMes<T>[] = [];
  for (const h of ordenados) {
    const [a, m] = h.fecha.split('-').map(Number);
    const soloAnio = h.fecha_precision === 'anio';
    const clave = soloAnio ? `${a}` : `${a}-${m}`;
    let g = grupos.find((x) => x.clave === clave);
    if (!g) {
      g = { clave, anio: a, mes: soloAnio ? 0 : m, titulo: soloAnio ? `${a} (sin mes)` : `${MESES[m - 1]} ${a}`, hitos: [] };
      grupos.push(g);
    }
    g.hitos.push(h);
  }
  return grupos.sort((x, y) => x.anio - y.anio || x.mes - y.mes);
}

const SOCIEDAD = /\b(s\.?\s?r\.?\s?l|s\.?\s?a|s\.?\s?a\.?\s?s|s\.?\s?h|srl|sa|sas|y\s+cia|ltda)\.?$/i;

/** Palabras con las que se busca a una persona en los textos: el nombre, el apellido y cómo figura agendada. */
export function clavesDePersona(p: { nombre: string; tipo_persona: string; alias?: string[] }): string[] {
  const claves = new Set<string>();
  const completo = claveNombre(p.nombre.replace(SOCIEDAD, ''));
  if (completo.length >= 4) claves.add(completo);
  const palabras = completo.split(' ').filter((w) => w.length >= 4);
  if (p.tipo_persona === 'juridica') {
    if (palabras[0] && palabras[0].length >= 5) claves.add(palabras[0]);
  } else if (palabras.length > 1) {
    claves.add(palabras[palabras.length - 1]);
  }
  for (const a of p.alias ?? []) {
    const c = claveNombre(a);
    if (c.length >= 4) claves.add(c);
  }
  return [...claves];
}

/** ¿El texto menciona a la persona? Coincidencia por nombre, a revisar: no es una identificación. */
export function mencionaPersona(texto: string | null | undefined, claves: string[]): boolean {
  if (!texto) return false;
  const t = ` ${claveNombre(texto)} `;
  return claves.some((c) => t.includes(` ${c} `));
}
