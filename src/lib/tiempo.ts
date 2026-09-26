// Fechas en castellano rioplatense, cortas y claras.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function haceCuanto(fecha: string | Date | null | undefined, ahora: Date = new Date()): string {
  if (!fecha) return '';
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const segundos = Math.max(0, Math.round((ahora.getTime() - d.getTime()) / 1000));
  if (segundos < 5) return 'recién';
  if (segundos < 60) return `hace ${segundos} s`;
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  const mismoDia = d.toDateString() === ahora.toDateString();
  if (mismoDia) return `hace ${horas} h`;
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return `ayer, ${horaCorta(d)}`;
  const mismoAnio = d.getFullYear() === ahora.getFullYear();
  return `${d.getDate()} ${MESES[d.getMonth()]}${mismoAnio ? '' : ` ${d.getFullYear()}`}`;
}

export function horaCorta(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "2025-10-28" → "28/10/2025", sin pasar por zonas horarias. */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  if (!a || !m || !d) return iso;
  return `${d}/${m}/${a}`;
}

export type Precision = 'dia' | 'mes' | 'anio' | 'aproximada' | 'sin_fecha';

/** Muestra una fecha respetando su precisión: nunca inventa el día. */
export function fechaConPrecision(iso: string | null | undefined, precision: Precision): string {
  if (!iso || precision === 'sin_fecha') return '';
  const [a, m] = iso.slice(0, 10).split('-');
  if (precision === 'anio') return a;
  if (precision === 'mes') return `${MESES_LARGOS[Number(m) - 1]} de ${a}`;
  if (precision === 'aproximada') return `c. ${fechaCorta(iso)}`;
  return fechaCorta(iso);
}
