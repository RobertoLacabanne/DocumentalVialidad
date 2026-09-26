// Lectura de las transcripciones de WhatsApp que arma el equipo (los .docx de
// "APUNTES LEG. …"). Acepta las formas que conviven en esos documentos:
//
//   16/04/21                        ← línea de fecha
//   Remitente: Gervasoni            ← quién envía
//   Mensaje: Hoy te va a llegar…    ← un mensaje (las líneas que siguen sin
//                                     rótulo lo continúan)
//
//   Forlin 28/02/25                 ← nombre y fecha en la misma línea
//   Francisco:                      ← nombre solo; cada línea es un mensaje
//   Audio francisco: Hola…          ← audio transcripto de esa persona
//
// y también el .txt que exporta WhatsApp ("11/3/25, 10:35 - Nombre: texto").
//
// El texto de cada mensaje se copia tal cual. Solo se quitan los rótulos de la
// transcripción ("Mensaje:", "Audio francisco:") y las llamadas a notas al pie,
// que pasan a la observación del mensaje. Lo que no se entiende no se adivina:
// queda en la lista de líneas que no se importan, a la vista.

import { fechaDeTexto, normalizar } from './importacion';

export type TipoMensaje = 'texto' | 'audio_transcripto' | 'imagen' | 'archivo' | 'otro';

export type MensajeLeido = {
  orden: number;
  /** Línea del documento donde empieza el mensaje (1 = primera línea). */
  linea: number;
  fecha?: string;
  fecha_texto?: string;
  emisor?: string;
  receptor?: string;
  tipo: TipoMensaje;
  contenido: string;
  /** Notas al pie de la transcripción que se refieren a este mensaje. */
  observacion?: string;
  /** Se importa salvo que una persona lo destilde en la revisión. */
  incluir: boolean;
  aviso?: string;
};

export type LineaOmitida = { linea: number; texto: string; motivo: string };

export type ConversacionLeida = {
  titulo: string;
  participantes?: string;
  nombres: string[];
  contacto_relevante?: string;
  agendado_como?: string;
  /** Notas del encabezado del documento (las escribió el analista). */
  observaciones?: string;
  periodo_desde?: string;
  periodo_hasta?: string;
  mensajes: MensajeLeido[];
  omitidas: LineaOmitida[];
  avisos: string[];
};

const SEPARADOR = /^[\s_\-=*~.·]{5,}$/;
const LLAMADA = /\s*\[\^(\d+)\]/g;
const FECHA = /^(\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2}))\b/;
const HORA = /^(\d{1,2}[:.]\d{2}(?::\d{2})?)\s*(?:hs\.?|h\.?)?$/i;
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const RESERVADAS = ['mensaje', 'remitente', 'remitentes', 'audio', 'imagen', 'archivo', 'video', 'importante', 'nota', 'fecha'];
const EXPORT_WHATSAPP =
  /^\[?(\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2})),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]\.?\s?m\.?)?)\]?\s*[-–]?\s*([^:]{1,50}):\s(.*)$/i;

/**
 * Deja el texto en líneas limpias. Si viene del texto que muestra Google Drive
 * (con escapes de Markdown y notas como "[1](#footnote1)"), lo pasa a la misma
 * forma que sale del .docx: llamadas "[^1]" y notas "[^1]: texto" al final.
 */
export function prepararTexto(crudo: string): string[] {
  const lineas = crudo
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) =>
      l
        .replace(/\\([\\[\]!_\-*.()#+~`>])/g, '$1')
        .replace(/\[(\d+)\]\(#footnote\d+\)/g, '[^$1]')
        .replace(/\*\*/g, '')
        .replace(/ /g, ' ')
        .trim(),
    );
  // Notas al pie al final del texto de Drive: "1 Cuando le dice…", solo si hay una llamada [^1].
  const llamadas = new Set<string>();
  for (const l of lineas) for (const m of l.matchAll(/\[\^(\d+)\]/g)) llamadas.add(m[1]);
  for (let i = lineas.length - 1; i >= 0; i--) {
    if (!lineas[i]) continue;
    const m = /^(\d{1,2})\s+(.+)$/.exec(lineas[i]);
    if (!m || !llamadas.has(m[1])) break;
    lineas[i] = `[^${m[1]}]: ${m[2]}`;
  }
  return lineas;
}

function tipoDe(t: string): TipoMensaje {
  const n = normalizar(t);
  if (/^\[?audio\b/.test(n)) return 'audio_transcripto';
  if (/^\[?(imagen|foto)\b/.test(n)) return 'imagen';
  if (/^\[?(archivo|documento|pdf)\b/.test(n)) return 'archivo';
  if (/^\[(video|sticker|ubicacion|contacto|gif)\b/.test(n)) return 'otro';
  return 'texto';
}

const soloMarca = (t: string) => /^\[?(audio|imagen|archivo|video)\]?:?$/i.test(t.trim());

/** "Gervasoni - Meynet" → ["Gervasoni", "Meynet"]. */
export function separarNombres(t: string): string[] {
  return t
    .split(/\s+-\s+|\s*[,;/|]\s*|\s+y\s+/i)
    .map((x) => x.replace(/^["“”«»']+|["“”«»'.]+$/g, '').trim())
    .filter(Boolean);
}

/** Nombre del documento y la fecha del día de un mensaje, sin completar nada que no esté escrito. */
export function leerTranscripcion(crudo: string): ConversacionLeida {
  const lineas = prepararTexto(crudo);
  const r: ConversacionLeida = { titulo: '', nombres: [], mensajes: [], omitidas: [], avisos: [] };
  const notas = new Map<string, string>();
  const notasDelEncabezado: string[] = [];

  // Notas al pie ("[^1]: texto"), estén donde estén.
  lineas.forEach((l, i) => {
    const m = /^\[\^(\d+)\]:\s*(.*)$/.exec(l);
    if (m) {
      notas.set(m[1], m[2]);
      lineas[i] = '';
    }
  });

  const canonico = (nombre: string): string | undefined => {
    const n = normalizar(nombre.replace(/^["“”«»']+|["“”«»'.:]+$/g, ''));
    if (!n) return undefined;
    return r.nombres.find((p) => normalizar(p) === n) ?? r.nombres.find((p) => normalizar(p).split(' ')[0] === n);
  };
  const pareceNombre = (t: string) => {
    const limpio = t.replace(/^["“”«»']+|["“”«»'.]+$/g, '').trim();
    if (!limpio || limpio.length > 40 || /\d{3,}/.test(limpio)) return false;
    if (RESERVADAS.includes(normalizar(limpio))) return false;
    return limpio.split(/\s+/).length <= 4 && /^[\p{L}"“”«»'. ]+[\p{L}\d]*$/u.test(limpio);
  };

  // ---------------------------------------------------------------------
  // Encabezado: hasta el primer separador, fecha o rótulo de remitente.
  // ---------------------------------------------------------------------
  let i = 0;
  for (; i < lineas.length; i++) {
    const l = lineas[i];
    if (!l) continue;
    if (SEPARADOR.test(l)) {
      i++;
      break;
    }
    if (FECHA.test(l) || EXPORT_WHATSAPP.test(l) || /^remitente\s*:/i.test(l) || /^mensaje\s*:/i.test(l)) break;
    const cab = /^conversaci[oó]n de whats ?app\b\s*[-–:]?\s*(.*)$/i.exec(l);
    if (cab) {
      const numero = /(\+?\d[\d\s-]{6,}\d)/.exec(cab[1]);
      if (numero) r.contacto_relevante = numero[1].trim();
      else if (cab[1]) notasDelEncabezado.push(l);
      continue;
    }
    const rem = /^(?:remitentes|participantes)\s*:\s*(.+)$/i.exec(l);
    if (rem) {
      r.participantes = rem[1].trim();
      r.nombres = separarNombres(rem[1]);
      continue;
    }
    if (/^legajo\b/i.test(l)) continue;
    // Una línea con solo un nombre ya es el primer mensaje, aunque falte el separador.
    if (r.nombres.length && canonico(l.replace(/[:.]$/, ''))) break;
    notasDelEncabezado.push(l);
    const agendado = /agendad[oa]\s+como\s*[“"«']([^”"»']+)[”"»']/i.exec(l);
    if (agendado && !r.agendado_como) r.agendado_como = agendado[1].trim();
  }
  if (notasDelEncabezado.length) r.observaciones = notasDelEncabezado.join('\n');

  // ---------------------------------------------------------------------
  // Cuerpo
  // ---------------------------------------------------------------------
  let dia: { fecha?: string; texto: string } | null = null;
  let emisor: string | undefined;
  let hora: string | undefined;
  let rotulado = false; // el último mensaje vino de un rótulo: las líneas sueltas lo continúan
  let marcaPendiente: { tipo: TipoMensaje; linea: number; texto: string } | null = null;
  let notasPendientes: string[] = [];
  const ultimo = () => r.mensajes[r.mensajes.length - 1];

  const quitarLlamadas = (t: string) => {
    const ids = [...t.matchAll(/\[\^(\d+)\]/g)].map((m) => m[1]);
    return { limpio: t.replace(LLAMADA, '').trim(), ids };
  };
  const agregarNotas = (m: MensajeLeido, ids: string[]) => {
    const textos = ids.map((id) => notas.get(id)).filter((t): t is string => Boolean(t));
    if (!textos.length) return;
    const bloque = textos.map((t) => `Nota al pie de la transcripción: ${t}`).join('\n');
    m.observacion = m.observacion ? `${m.observacion}\n${bloque}` : bloque;
  };

  const nuevo = (linea: number, contenido: string, tipo?: TipoMensaje, extra?: Partial<MensajeLeido>) => {
    const { limpio, ids } = quitarLlamadas(contenido);
    const m: MensajeLeido = {
      orden: r.mensajes.length + 1,
      linea,
      fecha: dia?.fecha,
      fecha_texto: dia ? [dia.texto, hora].filter(Boolean).join(' ') : hora,
      emisor,
      tipo: tipo ?? tipoDe(limpio),
      contenido: limpio,
      incluir: true,
      ...extra,
    };
    agregarNotas(m, [...notasPendientes, ...ids]);
    notasPendientes = [];
    r.mensajes.push(m);
    return m;
  };
  const vaciarMarca = () => {
    if (!marcaPendiente) return;
    nuevo(marcaPendiente.linea, marcaPendiente.texto, marcaPendiente.tipo);
    marcaPendiente = null;
  };
  const cambiarEmisor = (nombre: string, lineaNro: number) => {
    vaciarMarca();
    const limpio = nombre.replace(/^["“”«»']+|["“”«»'.:]+$/g, '').trim();
    emisor = canonico(limpio) ?? limpio;
    hora = undefined;
    rotulado = false;
    if (r.nombres.length && !canonico(limpio)) {
      r.avisos.push(`Línea ${lineaNro}: «${limpio}» no figura entre los participantes (${r.nombres.join(', ')}). Revisá quién envía esos mensajes.`);
    }
  };

  for (; i < lineas.length; i++) {
    const nro = i + 1;
    const original = lineas[i];
    if (!original || SEPARADOR.test(original)) continue;
    const { limpio: l, ids } = quitarLlamadas(original);
    if (!l) continue;

    // Exportación de WhatsApp: fecha, hora, nombre y texto en una línea.
    const exp = EXPORT_WHATSAPP.exec(l);
    if (exp) {
      vaciarMarca();
      const f = fechaDeTexto(exp[1]);
      dia = { fecha: f ?? undefined, texto: exp[1] };
      cambiarEmisor(exp[3], nro);
      hora = exp[2];
      nuevo(nro, exp[4]);
      agregarNotas(ultimo(), ids);
      rotulado = true;
      continue;
    }

    // Línea de fecha: "16/04/21", "04/12/21 sábado", "Forlin 28/02/25".
    const conNombre = /^(.{2,40}?)\s+(\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2}))$/.exec(l);
    const fechaSola = FECHA.exec(l);
    const resto = fechaSola ? l.slice(fechaSola[0].length).trim().replace(/^[-–,(]\s*|\)$/g, '') : '';
    const restoEsDia = !resto || DIAS.includes(normalizar(resto)) || HORA.test(resto);
    const nombreDeFecha = conNombre && (canonico(conNombre[1]) || (!r.nombres.length && pareceNombre(conNombre[1])));
    if ((fechaSola && restoEsDia) || nombreDeFecha) {
      vaciarMarca();
      const textoFecha = fechaSola ? fechaSola[1] : conNombre![2];
      const f = fechaDeTexto(textoFecha);
      dia = { fecha: f ?? undefined, texto: fechaSola ? l : textoFecha };
      if (!f) r.avisos.push(`Línea ${nro}: «${textoFecha}» no es una fecha válida. Se guarda como texto, sin fecha.`);
      if (conNombre && !fechaSola) cambiarEmisor(conNombre[1], nro);
      else {
        hora = undefined;
        rotulado = false;
      }
      notasPendientes.push(...ids);
      continue;
    }

    // "Remitente: Gervasoni" o "Remitente: Meynet 19:58 hs."
    const rem = /^remitente\s*:\s*(.+)$/i.exec(l);
    if (rem) {
      const conHora = /^(.+?)\s+(\d{1,2}[:.]\d{2}(?::\d{2})?\s*(?:hs\.?|h\.?)?)$/i.exec(rem[1].trim());
      cambiarEmisor(conHora ? conHora[1] : rem[1], nro);
      if (conHora) hora = conHora[2];
      notasPendientes.push(...ids);
      continue;
    }

    // "Mensaje: texto" → un mensaje. "Mensaje reenviado: texto" queda entero.
    const men = /^mensaje\s*:\s*(.*)$/i.exec(l);
    if (men) {
      vaciarMarca();
      if (!men[1]) {
        r.omitidas.push({ linea: nro, texto: original, motivo: 'Rótulo «Mensaje:» sin texto.' });
        continue;
      }
      const m = nuevo(nro, men[1]);
      agregarNotas(m, ids);
      if (!emisor) Object.assign(m, { incluir: false, aviso: 'No se sabe quién lo envía.' });
      rotulado = true;
      continue;
    }

    // "Audio francisco: texto", "Audio Forlin", "Audio: texto".
    const audio = /^audio\s*([^:]{0,30}?)\s*(?::\s*(.*))?$/i.exec(l);
    if (audio && (audio[1] === '' ? l.includes(':') : Boolean(canonico(audio[1])) || (!r.nombres.length && l.includes(':')))) {
      if (audio[1]) cambiarEmisor(audio[1], nro);
      else vaciarMarca();
      if (audio[2]) {
        const m = nuevo(nro, audio[2], 'audio_transcripto');
        agregarNotas(m, ids);
        rotulado = false;
      } else {
        marcaPendiente = { tipo: 'audio_transcripto', linea: nro, texto: l };
      }
      continue;
    }

    // Nombre solo ("Francisco:", "Forlin", "Francisco.").
    const nombreSolo = /^(.{2,40}?)\s*[:.]?$/.exec(l);
    if (nombreSolo && (canonico(nombreSolo[1]) || (!r.nombres.length && /:$/.test(l) && pareceNombre(nombreSolo[1])))) {
      cambiarEmisor(nombreSolo[1], nro);
      notasPendientes.push(...ids);
      continue;
    }

    // Marca sola ("AUDIO", "[IMAGEN]", "Imagen reenviada:"): el texto viene en la línea siguiente.
    if (soloMarca(l) || /^(imagen|audio|archivo|video) reenviad[oa]:?$/i.test(l)) {
      vaciarMarca();
      marcaPendiente = { tipo: tipoDe(l), linea: nro, texto: l };
      continue;
    }

    // Notas del analista entre paréntesis ("(...)", "(al otro día)").
    if (/^\(.*\)$/.test(l)) {
      vaciarMarca();
      r.omitidas.push({ linea: nro, texto: original, motivo: 'Nota entre paréntesis del analista.' });
      continue;
    }

    // Texto suelto: continúa el mensaje rotulado o es un mensaje nuevo.
    if (marcaPendiente) {
      const m = nuevo(marcaPendiente.linea, l, marcaPendiente.tipo);
      agregarNotas(m, ids);
      marcaPendiente = null;
      rotulado = false;
      continue;
    }
    const previo = ultimo();
    if (previo && (rotulado || /^[-•–]\s/.test(l)) && previo.emisor === emisor) {
      previo.contenido += `\n${l}`;
      agregarNotas(previo, ids);
      continue;
    }
    if (!emisor) {
      r.omitidas.push({ linea: nro, texto: original, motivo: 'No se sabe quién lo envía.' });
      continue;
    }
    const m = nuevo(nro, l);
    agregarNotas(m, ids);
    if (l.length > 60 && /:$/.test(l)) Object.assign(m, { incluir: false, aviso: 'Parece una nota del analista, no un mensaje.' });
  }
  vaciarMarca();

  // Mensajes repetidos (pasa cuando el analista resume un tramo y después lo transcribe completo).
  const vistos = new Map<string, number>();
  for (const m of r.mensajes) {
    if (m.contenido.length < 25) continue;
    const clave = `${m.emisor ?? ''}|${normalizar(m.contenido)}`;
    const antes = vistos.get(clave);
    if (antes !== undefined) m.aviso ??= `Mismo texto que el mensaje de la línea ${antes}. Fijate si está repetido.`;
    else vistos.set(clave, m.linea);
  }

  // Receptor: en una conversación de dos, el que no envía.
  if (r.nombres.length === 2) {
    for (const m of r.mensajes) {
      const otro = r.nombres.find((n) => n !== m.emisor);
      if (m.emisor && r.nombres.includes(m.emisor) && otro) m.receptor = otro;
    }
  }

  const fechas = r.mensajes.filter((m) => m.incluir && m.fecha).map((m) => m.fecha!).sort();
  r.periodo_desde = fechas[0];
  r.periodo_hasta = fechas[fechas.length - 1];
  r.titulo = r.nombres.length >= 2
    ? `Conversación entre ${r.nombres.slice(0, -1).join(', ')} y ${r.nombres[r.nombres.length - 1]}`
    : r.participantes
      ? `Conversación ${r.participantes}`
      : '';
  for (const [id] of notas) {
    if (!r.mensajes.some((m) => m.observacion?.includes(notas.get(id)!))) {
      r.avisos.push(`La nota al pie ${id} no quedó asociada a ningún mensaje: pasa a las observaciones de la conversación.`);
      r.observaciones = [r.observaciones, `Nota al pie ${id}: ${notas.get(id)}`].filter(Boolean).join('\n');
    }
  }
  return r;
}

// ---------------------------------------------------------------------
// Texto de un .docx (sin librerías: el .docx es un .zip con XML adentro)
// ---------------------------------------------------------------------
const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodificar = (t: string) =>
  t.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (e, c: string) =>
    c[0] === '#' ? String.fromCodePoint(c[1].toLowerCase() === 'x' ? parseInt(c.slice(2), 16) : Number(c.slice(1))) : (ENTIDADES[c] ?? e),
  );

function parrafos(xml: string): string[] {
  const salida: string[] = [];
  for (const p of xml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>|<w:p\/>/g)) {
    let t = '';
    for (const m of p[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br(?:\s[^>]*)?\/>|<w:cr\/>|<w:footnoteReference[^>]*w:id="(-?\d+)"[^>]*\/>/g)) {
      if (m[1] !== undefined) t += decodificar(m[1]);
      else if (m[2] !== undefined) t += `[^${m[2]}]`;
      else if (m[0].startsWith('<w:tab')) t += '\t';
      else t += '\n';
    }
    salida.push(...t.split('\n'));
  }
  return salida;
}

/** Devuelve el texto del documento, con las notas al pie al final como "[^n]: texto". */
export async function textoDeDocx(datos: ArrayBuffer | Uint8Array): Promise<string> {
  const { unzipSync, strFromU8 } = await import('fflate');
  const bytes = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
  let archivos: Record<string, Uint8Array>;
  try {
    archivos = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' || f.name === 'word/footnotes.xml' });
  } catch {
    throw new Error('El archivo no es un .docx válido. Si es un documento de Google, descargalo como Microsoft Word (.docx).');
  }
  if (!archivos['word/document.xml']) throw new Error('El archivo no tiene el texto de un documento de Word.');
  const lineas = parrafos(strFromU8(archivos['word/document.xml']));
  if (archivos['word/footnotes.xml']) {
    for (const n of strFromU8(archivos['word/footnotes.xml']).matchAll(/<w:footnote\b([^>]*)>([\s\S]*?)<\/w:footnote>/g)) {
      const id = /w:id="(-?\d+)"/.exec(n[1])?.[1];
      if (!id || /w:type="/.test(n[1])) continue;
      const texto = parrafos(n[2]).join(' ').replace(/\s+/g, ' ').trim();
      if (texto) lineas.push(`[^${id}]: ${texto}`);
    }
  }
  return lineas.join('\n');
}
