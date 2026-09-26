// Lectura de la planilla EXPEDIENTES DE CONTRATACIÓN: una hoja por licitación,
// con el número de expediente y la fecha de inicio arriba, y el trámite paso a
// paso (PROCEDIMIENTO · Fs. · FECHA · FIRMANTE · OBSERVACIONES).
//
// Se transcribe lo que dice la hoja. Los montos que aparecen escritos en las
// observaciones se proponen como sugerencia: los confirma una persona.

import { normalizar, texto, type Celda } from './importacion';

export type Precision = 'dia' | 'mes' | 'anio' | 'aproximada' | 'sin_fecha';

export type PasoImportado = {
  orden: number;
  fila: number;
  descripcion: string;
  fojas?: string;
  fecha?: string;
  fecha_precision: Precision;
  fecha_texto?: string;
  firmante_texto?: string;
  link?: string;
  observaciones?: string;
};

export type OfertaImportada = {
  orden: number;
  fila: number;
  oferente_texto: string;
  fojas?: string;
  link?: string;
  observaciones?: string;
  /** Monto encontrado en el texto de la oferta. Sugerencia hasta que se confirme. */
  monto_sugerido?: number;
};

export type Sugerencia = { campo: 'presupuesto_oficial' | 'reserva_presupuestaria'; monto: number; fuente: string; fila: number };

export type ContratacionImportada = {
  hoja: string;
  identificador: string;
  titulo?: string;
  tipo_procedimiento?: string;
  expediente?: string;
  fecha_inicio?: string;
  fecha_inicio_texto?: string;
  pasos: PasoImportado[];
  ofertas: OfertaImportada[];
  sugerencias: Sugerencia[];
  filasOrigen: number;
  avisos: string[];
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const esUrl = (t: string) => /^https?:\/\/\S+$/i.test(t.trim());

function iso(a: number, m: number, d: number): string | null {
  const f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Fecha de un paso del trámite. Solo se completa cuando es inequívoca; si no, queda el texto. */
export function fechaDelTramite(c: Celda): { fecha?: string; precision: Precision; texto?: string } {
  if (c instanceof Date && !Number.isNaN(c.getTime())) {
    const f = iso(c.getUTCFullYear(), c.getUTCMonth() + 1, c.getUTCDate());
    return f ? { fecha: f, precision: 'dia', texto: `${c.getUTCDate()}/${c.getUTCMonth() + 1}/${c.getUTCFullYear()}` } : { precision: 'sin_fecha' };
  }
  const t = texto(c);
  if (!t) return { precision: 'sin_fecha' };
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/.exec(t);
  if (m) {
    const a = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const f = iso(a, Number(m[2]), Number(m[1]));
    return f ? { fecha: f, precision: 'dia', texto: t } : { precision: 'aproximada', texto: t };
  }
  m = /^([a-záéíóú]+)\s+(?:de\s+)?(\d{4})$/i.exec(t);
  if (m && MESES.includes(normalizar(m[1]))) {
    return { fecha: iso(Number(m[2]), MESES.indexOf(normalizar(m[1])) + 1, 1)!, precision: 'mes', texto: t };
  }
  if (/^\d{4}$/.test(t)) return { fecha: `${t}-01-01`, precision: 'anio', texto: t };
  return { precision: /\d/.test(t) ? 'aproximada' : 'sin_fecha', texto: t };
}

/** "$16.163.917,90" → 16163917.9. Devuelve los montos escritos con signo $ en el texto. */
export function montosEnTexto(t: string): number[] {
  const encontrados: number[] = [];
  for (const m of t.matchAll(/\$\s*([\d.]+(?:,\d{1,2})?)/g)) {
    const n = Number(m[1].replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(n) && n > 0) encontrados.push(n);
  }
  return encontrados;
}

const etiqueta = (c: Celda) => normalizar(texto(c)).replace(/[:.]$/, '');

function valorDeFila(fila: Celda[]): string | undefined {
  return fila.slice(1).map((c) => texto(c)).find(Boolean);
}

/** Lee una hoja con el formato de EXPEDIENTES DE CONTRATACIÓN. */
export function leerHojaContratacion(hoja: string, filas: Celda[][]): ContratacionImportada | null {
  const iEnc = filas.findIndex((f) => {
    const t = f.map(etiqueta);
    return t.includes('procedimiento') && t.some((x) => x === 'fs' || x === 'fojas') && t.includes('fecha');
  });
  if (iEnc < 0) return null;

  const enc = filas[iEnc].map(etiqueta);
  const col = {
    descripcion: enc.indexOf('procedimiento'),
    fojas: enc.findIndex((x) => x === 'fs' || x === 'fojas'),
    fecha: enc.indexOf('fecha'),
    firmante: enc.indexOf('firmante'),
    observaciones: enc.indexOf('observaciones'),
  };

  const r: ContratacionImportada = { hoja, identificador: hoja.trim(), pasos: [], ofertas: [], sugerencias: [], filasOrigen: 0, avisos: [] };
  // Excel no admite «/» en el nombre de la hoja: «LP 05/2020» puede llegar como «LP 05_2020».
  const barra = r.identificador.replace(/(\d)\s*_\s*(\d)/g, '$1/$2');
  if (barra !== r.identificador) {
    r.avisos.push(`La hoja se llama «${r.identificador}» (Excel no admite «/» en los nombres de hoja): se toma «${barra}». Revisalo.`);
    r.identificador = barra;
  }

  for (const f of filas.slice(0, iEnc)) {
    const e = etiqueta(f[0]);
    if (!e) {
      const t = f.map((c) => texto(c)).find(Boolean);
      if (t && !r.titulo) r.titulo = t;
      continue;
    }
    if (/^(nro|n°|nº|numero) de expediente$|^expediente$/.test(e)) r.expediente = valorDeFila(f);
    else if (/^fecha de inicio$/.test(e)) {
      const celda = f.slice(1).find((c) => texto(c));
      const d = fechaDelTramite(celda);
      r.fecha_inicio = d.fecha;
      r.fecha_inicio_texto = d.texto;
    } else if (!r.titulo) r.titulo = texto(f[0]);
  }
  if (r.titulo) {
    const m = /^(licitaci[oó]n(?: p[uú]blica| privada)?|concurso de precios|contrataci[oó]n directa|compra directa)\b/i.exec(r.titulo);
    if (m) r.tipo_procedimiento = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  }

  const val = (f: Celda[], i: number) => (i < 0 ? '' : texto(f[i]));
  let actual: PasoImportado | null = null;
  for (let i = iEnc + 1; i < filas.length; i++) {
    const f = filas[i];
    const desc = val(f, col.descripcion);
    const resto = [val(f, col.fojas), val(f, col.fecha), val(f, col.firmante), val(f, col.observaciones)];
    if (!desc && resto.every((x) => !x)) continue;
    r.filasOrigen++;
    if (desc) {
      const d = fechaDelTramite(col.fecha < 0 ? null : f[col.fecha]);
      actual = {
        orden: r.pasos.length + 1,
        fila: i + 1,
        descripcion: desc,
        fojas: val(f, col.fojas) || undefined,
        fecha: d.fecha,
        fecha_precision: d.precision,
        fecha_texto: d.texto,
        firmante_texto: val(f, col.firmante) || undefined,
      };
      const obs = val(f, col.observaciones);
      if (obs) {
        if (esUrl(obs)) actual.link = obs;
        else actual.observaciones = obs;
      }
      r.pasos.push(actual);
    } else if (actual) {
      // Celdas combinadas en la planilla: la fila siguiente completa el mismo paso (casi siempre, el link).
      const obs = val(f, col.observaciones);
      if (obs && esUrl(obs) && !actual.link) actual.link = obs;
      else if (obs) actual.observaciones = actual.observaciones ? `${actual.observaciones}\n${obs}` : obs;
      if (!actual.fojas && val(f, col.fojas)) actual.fojas = val(f, col.fojas);
      if (!actual.firmante_texto && val(f, col.firmante)) actual.firmante_texto = val(f, col.firmante);
      if (!actual.fecha_texto && val(f, col.fecha)) {
        const d = fechaDelTramite(f[col.fecha]);
        Object.assign(actual, { fecha: d.fecha, fecha_precision: d.precision, fecha_texto: d.texto });
      }
    } else {
      r.avisos.push(`La fila ${i + 1} tiene datos pero no dice a qué paso corresponde: no se importa.`);
    }
  }

  for (const p of r.pasos) {
    const m = /^oferta\s+(?:de\s+)?(.+)$/i.exec(p.descripcion);
    if (m) {
      const montos = montosEnTexto(p.observaciones ?? '');
      r.ofertas.push({
        orden: r.ofertas.length + 1,
        fila: p.fila,
        oferente_texto: m[1].trim(),
        fojas: p.fojas,
        link: p.link,
        observaciones: p.observaciones,
        monto_sugerido: montos.length === 1 ? montos[0] : undefined,
      });
      if (montos.length > 1) r.avisos.push(`La oferta de ${m[1].trim()} menciona más de un monto: se carga sin monto para que lo completes.`);
      continue;
    }
    const montos = montosEnTexto(p.observaciones ?? '');
    if (montos.length !== 1) continue;
    const d = normalizar(p.descripcion + ' ' + (p.observaciones ?? ''));
    if (/presupuesto/.test(normalizar(p.descripcion)) && !r.sugerencias.some((s) => s.campo === 'presupuesto_oficial')) {
      r.sugerencias.push({ campo: 'presupuesto_oficial', monto: montos[0], fuente: p.descripcion, fila: p.fila });
    } else if (/reserva/.test(d) && !r.sugerencias.some((s) => s.campo === 'reserva_presupuestaria')) {
      r.sugerencias.push({ campo: 'reserva_presupuestaria', monto: montos[0], fuente: p.descripcion, fila: p.fila });
    }
  }
  return r;
}

export const formatoPesos = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

/** "18.415.263,50" o "$ 1.100" → número. Punto de miles y coma decimal, como en los expedientes. */
export function montoDeTexto(t: string | null | undefined): number | null | undefined {
  const limpio = (t ?? '').replace(/[$\s]/g, '');
  if (!limpio) return null;
  if (!/^\d{1,3}(\.?\d{3})*(,\d{1,2})?$/.test(limpio)) return undefined;
  const n = Number(limpio.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/** 18415263.5 → "18.415.263,50" (para editar). */
export const montoEditable = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Diferencia de una oferta contra el presupuesto oficial, en porcentaje. */
export function diferenciaPorcentual(monto: number | null, base: number | null): number | null {
  if (monto === null || base === null || base === 0) return null;
  return ((monto - base) / base) * 100;
}
