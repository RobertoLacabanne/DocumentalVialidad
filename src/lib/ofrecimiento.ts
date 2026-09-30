// Ofrecimiento de prueba para el juicio: la lógica de la planilla «Prueba a
// mostrar en debate con testigos» (Nº, entregado, acuerdo probatorio, si se
// exhibe y con quién, escanear, imputados vinculados, ubicación, Nº según el
// auto de remisión, pertinencia) y el listado para el requerimiento.
//
// Lo que falta se escribe como [completar: …]; nada se deduce.

import type { Paragraph as TParagraph, TextRun as TTextRun } from 'docx';
import { armarCita } from './cita';
import { FUENTE_INFORME } from './informe';
import { compararOrden } from './orden';
import type { SituacionProcesal } from './tipos';

export type Clase = 'testimonial' | 'pericial' | 'documental' | 'informativa' | 'instrumental' | 'otra';
export type Incorporacion = 'exhibicion' | 'lectura' | 'no_se_incorpora';
export type Admision = 'pendiente' | 'admitida' | 'rechazada';

export const CLASES: { valor: Clase; etiqueta: string; titulo: string; persona: boolean }[] = [
  { valor: 'testimonial', etiqueta: 'Testigos', titulo: 'TESTIMONIAL', persona: true },
  { valor: 'pericial', etiqueta: 'Peritos', titulo: 'PERICIAL', persona: true },
  { valor: 'documental', etiqueta: 'Documental', titulo: 'DOCUMENTAL', persona: false },
  { valor: 'informativa', etiqueta: 'Informativa', titulo: 'INFORMATIVA', persona: false },
  { valor: 'instrumental', etiqueta: 'Instrumental', titulo: 'INSTRUMENTAL', persona: false },
  { valor: 'otra', etiqueta: 'Otra', titulo: 'OTRA PRUEBA', persona: false },
];

export const INCORPORACIONES: { valor: Incorporacion; etiqueta: string }[] = [
  { valor: 'exhibicion', etiqueta: 'Se exhibe' },
  { valor: 'lectura', etiqueta: 'Por lectura' },
  { valor: 'no_se_incorpora', etiqueta: 'No se incorpora' },
];

export const ADMISIONES: { valor: Admision; etiqueta: string }[] = [
  { valor: 'pendiente', etiqueta: 'Pendiente' },
  { valor: 'admitida', etiqueta: 'Admitida' },
  { valor: 'rechazada', etiqueta: 'Rechazada' },
];

export const ACUERDOS = [
  { valor: 'si', etiqueta: 'Sí' },
  { valor: 'parcial', etiqueta: 'Parcial' },
  { valor: 'no', etiqueta: 'No' },
];

export const etiquetaClase = (c: string) => CLASES.find((x) => x.valor === c)?.etiqueta ?? c;
export const esDePersona = (c: string) => Boolean(CLASES.find((x) => x.valor === c)?.persona);

/** Lo mínimo de un ítem que hace falta para mostrarlo, avisar y listarlo. */
export type ItemOfrecido = {
  id: string;
  clase: Clase;
  numero: string | null;
  descripcion: string | null;
  objeto: string | null;
  entregada_defensa: boolean;
  fecha_entrega: string | null;
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
  pieza: {
    numero_orden: string | null;
    titulo: string;
    efecto_numero: string | null;
    informe_numero: string | null;
    sobre: string | null;
    fojas: string | null;
    situacion: SituacionProcesal | null;
    incidencia: string | null;
  } | null;
  persona: { nombre: string; cargo: string | null } | null;
};

export type Alerta = { tipo: 'procesal' | 'introduce' | 'entrega' | 'impugnada' | 'rechazada'; texto: string; grave: boolean };

const SITUACION: Record<SituacionProcesal, string> = {
  admisibilidad_cuestionada: 'tiene la admisibilidad cuestionada',
  pendiente_resolucion: 'está pendiente de resolución',
  excluida: 'fue excluida',
};

/** Los avisos del armado del juicio, del más grave al más leve. */
export function alertasDe(i: ItemOfrecido): Alerta[] {
  const a: Alerta[] = [];
  if (i.pieza?.situacion) {
    a.push({ tipo: 'procesal', grave: true, texto: `La pieza ${SITUACION[i.pieza.situacion]}${i.pieza.incidencia ? ` («${i.pieza.incidencia}»)` : ''}.` });
  }
  if (i.admision === 'rechazada') a.push({ tipo: 'rechazada', grave: true, texto: 'No fue admitida en el auto de apertura.' });
  if (i.impugnada) a.push({ tipo: 'impugnada', grave: false, texto: `La defensa la impugnó${i.motivo_impugnacion ? `: ${i.motivo_impugnacion}` : '.'}` });
  if (i.incorporacion === 'exhibicion' && !i.introduce_id) a.push({ tipo: 'introduce', grave: false, texto: 'Se exhibe, pero falta con qué testigo o perito se introduce.' });
  if (!esDePersona(i.clase) && !i.entregada_defensa) a.push({ tipo: 'entrega', grave: false, texto: 'No figura entregada a la defensa.' });
  return a;
}

/** Cómo se nombra la prueba: lo que se escribió a mano, o la pieza o la persona. */
export function descripcionDe(i: ItemOfrecido): string | null {
  if (i.descripcion?.trim()) return i.descripcion.trim();
  if (i.pieza) return i.pieza.titulo;
  if (i.persona) return [i.persona.nombre, i.persona.cargo].filter(Boolean).join(', ');
  return null;
}

/** Referencia al origen de una pieza para el listado: efecto, sobre, fojas, informe. */
export function referenciaDe(i: ItemOfrecido): string | null {
  if (!i.pieza) return null;
  const partes = [
    i.pieza.efecto_numero && `Efecto Nº ${i.pieza.efecto_numero}`,
    i.pieza.sobre && `Sobre Nº ${i.pieza.sobre}`,
    i.pieza.fojas && `fs. ${i.pieza.fojas}`,
    i.pieza.informe_numero && `informe ${i.pieza.informe_numero}`,
  ].filter(Boolean);
  return partes.length ? partes.join(', ') : null;
}

/** Cita estándar de la pieza, con el formato de la causa. */
export function citaDe(i: ItemOfrecido, formato: string | null): string | null {
  if (!i.pieza) return null;
  return armarCita(formato, {
    efecto: i.pieza.efecto_numero,
    titulo: i.pieza.titulo,
    sobre: i.pieza.sobre,
    fojas: i.pieza.fojas,
    informe: i.pieza.informe_numero,
    numero: i.pieza.numero_orden,
  });
}

const ORDEN_CLASE = CLASES.map((c) => c.valor);

/** Orden del escrito: por clase y, dentro de cada una, por número (1, 2, 2 bis, 3…). */
export function ordenarItems<T extends Pick<ItemOfrecido, 'clase' | 'numero'>>(items: T[]): T[] {
  return [...items].sort((a, b) => ORDEN_CLASE.indexOf(a.clase) - ORDEN_CLASE.indexOf(b.clase) || compararOrden(a.numero, b.numero));
}

export const LETRAS = 'ABCDEFGHIJ';

// ---------------------------------------------------------------------
// Listado de prueba para el requerimiento de remisión a juicio (.docx)
// ---------------------------------------------------------------------
export type OpcionesListado = {
  legajo: string;
  caratula: string;
  /** Deja afuera lo que el auto de apertura rechazó. */
  sinRechazadas: boolean;
  /** Agrega la ubicación física de cada pieza (para uso interno). */
  conUbicacion: boolean;
};

export type LineaListado = { clase: Clase; letra: string; titulo: string; items: { numero: string; texto: string; falta: string[] }[] };

/** Arma el contenido del listado. Separado del .docx para poder probarlo. */
export function contenidoListado(items: ItemOfrecido[], nombres: Map<string, string>, o: OpcionesListado): LineaListado[] {
  const incluidos = ordenarItems(items.filter((i) => !(o.sinRechazadas && i.admision === 'rechazada')));
  const bloques: LineaListado[] = [];
  for (const c of CLASES) {
    const deLaClase = incluidos.filter((i) => i.clase === c.valor);
    if (!deLaClase.length) continue;
    bloques.push({
      clase: c.valor,
      letra: LETRAS[bloques.length],
      titulo: c.titulo,
      items: deLaClase.map((i, k) => {
        const falta: string[] = [];
        const descripcion = descripcionDe(i);
        let texto = descripcion ?? '';
        if (!descripcion) falta.push('descripción');
        if (c.persona) {
          if (i.objeto?.trim()) texto += `, quien depondrá sobre ${i.objeto.trim().replace(/[.\s]+$/, '')}`;
          else falta.push('sobre qué declarará');
        } else {
          const ref = referenciaDe(i);
          if (ref) texto += ` (${ref})`;
          if (i.objeto?.trim()) texto += `. Objeto: ${i.objeto.trim().replace(/[.\s]+$/, '')}`;
          if (o.conUbicacion && i.ubicacion_fisica?.trim()) texto += `. Ubicación: ${i.ubicacion_fisica.trim()}`;
        }
        const imputados = i.todos_los_imputados ? 'todos los imputados' : i.imputados.map((id) => nombres.get(id)).filter(Boolean).join(', ');
        if (imputados && !c.persona) texto += `. Vinculada a ${imputados}`;
        return { numero: i.numero?.trim() || String(k + 1), texto: texto.replace(/[.\s]+$/, ''), falta };
      }),
    });
  }
  return bloques;
}

export async function listadoEnDocx(bloques: LineaListado[], o: OpcionesListado): Promise<Blob> {
  const { AlignmentType, Document, Packer, Paragraph, TextRun } = await import('docx');
  const parrafo = (hijos: TTextRun[], centrado = false, sangria = false) =>
    new Paragraph({
      children: hijos,
      alignment: centrado ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
      spacing: { line: 360, before: 220 },
      indent: sangria ? { left: 560 } : undefined,
    });
  const cuerpo: TParagraph[] = [
    parrafo([new TextRun({ text: `Ref.: Legajo N.º ${o.legajo}, caratulado: “${o.caratula}”`, bold: true, italics: true })]),
    parrafo([new TextRun({ text: 'OFRECIMIENTO DE PRUEBA', bold: true })], true),
  ];
  for (const b of bloques) {
    cuerpo.push(parrafo([new TextRun({ text: `${b.letra}.- ${b.titulo}:`, bold: true })]));
    for (const it of b.items) {
      const hijos: TTextRun[] = [new TextRun({ text: `${it.numero}.- ` }), new TextRun({ text: it.texto })];
      for (const f of it.falta) hijos.push(new TextRun({ text: ` [completar: ${f}]`, italics: true }));
      hijos.push(new TextRun({ text: '.-' }));
      cuerpo.push(parrafo(hijos, false, true));
    }
  }
  const doc = new Document({
    creator: 'Tablero de Prueba · UFIL Paraná',
    title: 'Ofrecimiento de prueba',
    styles: { default: { document: { run: { font: FUENTE_INFORME, size: 22 }, paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: 360 } } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: cuerpo }],
  });
  return Packer.toBlob(doc);
}
