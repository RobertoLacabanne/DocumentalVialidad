// Fechas de Excel que no dicen el día. Google Sheets guarda «febrero 2020»
// como una fecha (el 1/2/2020) con formato «mmmm yyyy»; al leer la planilla
// solo llega la fecha, y el día 1 quedaría como si fuera un dato. Acá se mira
// el formato de cada celda y, si no muestra el día, la celda vuelve a ser el
// texto que se ve en la planilla («febrero 2020» o «2020»).
import { strFromU8, unzipSync } from 'fflate';
import type { Celda } from './importacion';

export type SinDia = 'mes' | 'anio';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Qué muestra un formato de número: null si no es de fecha o si muestra el día. */
export function precisionDelFormato(codigo: string): SinDia | null {
  // Se descartan el texto entre comillas, los caracteres escapados y los corchetes ([$-es-AR], [Red]).
  const limpio = codigo.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/\[[^\]]*\]/g, '').toLowerCase();
  if (!/[ymd]/.test(limpio) || /[hs]/.test(limpio)) return null;
  if (/d/.test(limpio)) return null;
  if (/m/.test(limpio) && /y/.test(limpio)) return 'mes';
  if (/y/.test(limpio)) return 'anio';
  return null;
}

const atributo = (etiqueta: string, nombre: string) => new RegExp(`\\s${nombre}="([^"]*)"`).exec(etiqueta)?.[1];

/** "C8" → [7, 2] (fila y columna desde 0). */
function posicion(ref: string): [number, number] | null {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return null;
  const col = [...m[1]].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0) - 1;
  return [Number(m[2]) - 1, col];
}

/** Por hoja, las celdas con fecha cuyo formato no muestra el día. Clave: "fila,columna" desde 0. */
export function fechasSinDia(xlsx: Uint8Array): Map<string, Map<string, SinDia>> {
  const salida = new Map<string, Map<string, SinDia>>();
  let archivos: Record<string, Uint8Array>;
  try {
    archivos = unzipSync(xlsx);
  } catch {
    return salida;
  }
  const leer = (ruta: string) => (archivos[ruta] ? strFromU8(archivos[ruta]) : '');

  const estilos = leer('xl/styles.xml');
  const formatos = new Map<string, string>();
  for (const m of estilos.matchAll(/<numFmt\b[^>]*>/g)) {
    const id = atributo(m[0], 'numFmtId');
    const codigo = atributo(m[0], 'formatCode');
    if (id && codigo) formatos.set(id, codigo.replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  }
  const bloque = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(estilos)?.[1] ?? '';
  // Índice de estilo → precisión (los formatos de fecha incorporados de Excel siempre muestran el día).
  const porEstilo = [...bloque.matchAll(/<xf\b[^>]*>/g)].map((m) => {
    const codigo = formatos.get(atributo(m[0], 'numFmtId') ?? '');
    return codigo ? precisionDelFormato(codigo) : null;
  });
  if (!porEstilo.some(Boolean)) return salida;

  const libro = leer('xl/workbook.xml');
  const relaciones = new Map<string, string>();
  for (const m of leer('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)) {
    const id = atributo(m[0], 'Id');
    const destino = atributo(m[0], 'Target');
    if (id && destino) relaciones.set(id, destino.replace(/^\/?(xl\/)?/, 'xl/'));
  }
  for (const m of libro.matchAll(/<sheet\b[^>]*>/g)) {
    const nombre = (atributo(m[0], 'name') ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    const ruta = relaciones.get(atributo(m[0], 'r:id') ?? '');
    if (!ruta) continue;
    const celdas = new Map<string, SinDia>();
    for (const c of leer(ruta).matchAll(/<c\b[^>]*>/g)) {
      const t = atributo(c[0], 't');
      if (t && t !== 'n' && t !== 'd') continue;
      const precision = porEstilo[Number(atributo(c[0], 's') ?? -1)];
      const lugar = posicion(atributo(c[0], 'r') ?? '');
      if (precision && lugar) celdas.set(lugar.join(','), precision);
    }
    if (celdas.size) salida.set(nombre, celdas);
  }
  return salida;
}

/** Devuelve las filas con esas fechas convertidas en el texto que muestra la planilla. */
export function conFechasSinDia(filas: Celda[][], celdas: Map<string, SinDia> | undefined): Celda[][] {
  if (!celdas?.size) return filas;
  return filas.map((fila, i) =>
    fila.map((c, j) => {
      const precision = celdas.get(`${i},${j}`);
      if (!precision || !(c instanceof Date) || Number.isNaN(c.getTime())) return c;
      return precision === 'mes' ? `${MESES[c.getUTCMonth()]} ${c.getUTCFullYear()}` : String(c.getUTCFullYear());
    }),
  );
}
