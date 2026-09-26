// "Informe de relevamiento de mensajes": reproduce la plantilla del equipo
// (PLANTILLA PARA REALIZAR INFORMES CELULARES). Palatino Linotype 11,
// justificado, interlineado 1,5, hoja A4 con márgenes de 2,54 cm.
//
// Lo que falta se escribe como [completar: …] en cursiva, igual que los
// "INSERTAR …" de la plantilla. La transcripción va tal cual está guardada.

import type { Paragraph as TParagraph, TextRun as TTextRun } from 'docx';

export type MensajeInforme = {
  fecha?: string | null;
  fecha_texto?: string | null;
  emisor?: string | null;
  receptor?: string | null;
  contenido: string | null;
  observacion?: string | null;
  /** Contrataciones o piezas vinculadas, ya escritas ("LP 05/2020, Expte. 154782"). */
  vinculos?: string[];
};

export type ConversacionInforme = { titulo: string; mensajes: MensajeInforme[] };

/** Qué va en el rótulo «Emisor» de cada mensaje. «Remitente» es siempre quien lo envía. */
export type CampoEmisor = 'completar' | 'envia' | 'recibe';

export type DatosInforme = {
  legajo: string;
  caratula: string;
  dispositivo?: string | null;
  efecto?: string | null;
  informe?: string | null;
  titular?: string | null;
  contacto?: string | null;
  agendado?: string | null;
  desde?: string | null;
  hasta?: string | null;
  campoEmisor: CampoEmisor;
  conversaciones: ConversacionInforme[];
};

export const FUENTE_INFORME = 'Palatino Linotype';
const CUERPO = 22; // medios puntos: 11 pt
const INTERLINEADO = 360; // 1,5 líneas
const ANTES = 220; // 11 pt antes de cada párrafo, como en la plantilla
const SANGRIA = 560; // ≈ 1 cm para los datos de cada mensaje
const SEPARADOR = '-'.repeat(88);

/** "2021-04-16" → "16/04/2021". */
export function fechaCorta(iso: string | null | undefined): string | undefined {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : undefined;
}

/** Fecha del mensaje: la fecha guardada (y la hora si la transcripción la trae) o el texto tal cual. */
export function fechaDelMensaje(m: MensajeInforme): string | undefined {
  const f = fechaCorta(m.fecha);
  if (!f) return m.fecha_texto?.trim() || undefined;
  const hora = m.fecha_texto ? /(\d{1,2}[:.]\d{2}(?::\d{2})?)(\s*hs\.?)?/i.exec(m.fecha_texto) : null;
  return hora ? `${f}, ${hora[1]}${hora[2] ? ' hs.' : ''}` : f;
}

export function observacionDelMensaje(m: MensajeInforme): string | undefined {
  const partes = [m.observacion?.trim()];
  if (m.vinculos?.length) partes.push(`Se vincula con: ${m.vinculos.join('; ')}.`);
  return partes.filter(Boolean).join('\n') || undefined;
}

export function emisorDelMensaje(m: MensajeInforme, campo: CampoEmisor): string | undefined {
  if (campo === 'envia') return m.emisor ?? undefined;
  if (campo === 'recibe') return m.receptor ?? undefined;
  return undefined;
}

/** Arma el documento. Se separa de la descarga para poder probarlo. */
export async function armarInforme(d: DatosInforme) {
  const { AlignmentType, Document, Paragraph, TextRun } = await import('docx');

  const texto = (t: string, extra: { bold?: boolean; italics?: boolean } = {}): TTextRun[] =>
    t.split('\n').map((linea, i) => new TextRun({ text: linea, break: i > 0 ? 1 : undefined, ...extra }));
  const dato = (valor: string | null | undefined, falta: string): TTextRun[] =>
    valor && valor.trim() ? texto(valor.trim()) : [new TextRun({ text: `[completar: ${falta}]`, italics: true })];

  const parrafo = (hijos: TTextRun[], opciones: { centrado?: boolean; sangria?: boolean; despues?: number } = {}) =>
    new Paragraph({
      children: hijos,
      alignment: opciones.centrado ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
      spacing: { line: INTERLINEADO, before: ANTES, after: opciones.despues ?? 0 },
      indent: opciones.sangria ? { left: SANGRIA } : undefined,
    });
  const rotulo = (etiqueta: string, valor: TTextRun[], despues = 0) =>
    parrafo([new TextRun({ text: `${etiqueta}: `, bold: true }), ...valor], { sangria: true, despues });

  const cuerpo: TParagraph[] = [
    parrafo([new TextRun({ text: `Ref.: Legajo N.º ${d.legajo}, caratulado: “${d.caratula}”`, bold: true, italics: true })], { despues: 240 }),
    parrafo([new TextRun({ text: 'INFORME DE RELEVAMIENTO DE MENSAJES', bold: true })], { centrado: true }),
    parrafo([
      ...texto('El presente informe se confeccionó a partir del relevamiento y selección de los mensajes relevantes al hecho investigado del '),
      ...dato(d.dispositivo, 'descripción del celular, CPU o dispositivo'),
      ...texto(', registrado bajo el número de efecto '),
      ...dato(d.efecto, 'número de efecto'),
      ...texto(', cuya información se extrajo mediante el informe de extracción forense '),
      ...dato(d.informe, 'número de informe'),
      ...texto(
        ' del Gabinete de Informática Forense. La transcripción es literal y se ordena por conversación y, dentro de cada una, en forma cronológica, indicando en cada caso fecha, remitente, contenido del mensaje y se realiza una observación en la que se justifica su vinculación con alguna contratación, expediente u otro tipo de documental que obra como evidencia en el legajo.',
      ),
    ]),
    parrafo([
      ...texto('El teléfono analizado pertenece a '),
      ...dato(d.titular, 'datos del titular'),
      ...texto(', y posee como relevante las conversaciones con el número telefónico '),
      ...dato(d.contacto, 'número'),
      ...texto(', el cual se encontraba agendado como '),
      ...dato(d.agendado, 'cómo estaba agendado'),
      ...texto(' en el periodo comprendido entre '),
      ...dato(fechaCorta(d.desde) ?? d.desde, 'fecha'),
      ...texto(' y '),
      ...dato(fechaCorta(d.hasta) ?? d.hasta, 'fecha'),
      ...texto('.'),
    ]),
    parrafo([new TextRun({ text: 'TRANSCRIPCIÓN DE LOS MENSAJES', bold: true })]),
  ];

  d.conversaciones.forEach((c, i) => {
    cuerpo.push(parrafo([new TextRun({ text: `${i + 1}. ${c.titulo}`, bold: true })]));
    for (const m of c.mensajes) {
      cuerpo.push(
        rotulo('Fecha', dato(fechaDelMensaje(m), 'fecha')),
        rotulo('Emisor', dato(emisorDelMensaje(m, d.campoEmisor), 'emisor')),
        rotulo('Remitente', dato(m.emisor, 'remitente')),
        rotulo('Mensaje', dato(m.contenido, 'mensaje'), 140),
        rotulo('OBSERVACIONES', dato(observacionDelMensaje(m), 'vinculación con una contratación, expediente u otra documental'), 140),
        parrafo([new TextRun({ text: SEPARADOR, bold: true })], { sangria: true }),
      );
    }
  });

  return new Document({
    creator: 'Tablero de Prueba · UFIL Paraná',
    title: 'Informe de relevamiento de mensajes',
    styles: {
      default: {
        document: {
          run: { font: FUENTE_INFORME, size: CUERPO },
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: INTERLINEADO } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: cuerpo,
      },
    ],
  });
}

export async function informeEnDocx(d: DatosInforme): Promise<Blob> {
  const { Packer } = await import('docx');
  return Packer.toBlob(await armarInforme(d));
}

export function nombreDelInforme(d: Pick<DatosInforme, 'efecto' | 'conversaciones'>): string {
  const base = d.efecto ? `Efecto ${d.efecto}` : d.conversaciones[0]?.titulo ?? 'mensajes';
  return `Informe de relevamiento de mensajes - ${base}.docx`.replace(/[\\/:*?"<>|]/g, '-');
}
