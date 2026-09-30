// Reportes de extracción de UFED (Cellebrite) exportados a Excel desde UFED
// Reader o Physical Analyzer. Se leen guiados por los encabezados, en inglés
// o en castellano; lo que no se reconoce se elige a mano. Cada chat del
// reporte se importa como una conversación, con el texto literal.
//
// Ojo: el formato se armó con las columnas habituales de esas exportaciones.
// Falta probarlo contra un reporte real del Gabinete; por eso las columnas se
// muestran siempre y se pueden cambiar.
import type { ConversacionLeida, LineaOmitida, MensajeLeido, TipoMensaje } from './conversaciones';
import { normalizar, type Celda } from './importacion';

export type HojaCruda = { nombre: string; filas: Celda[][] };

export type CampoUfed = 'chat' | 'nombre_chat' | 'participantes' | 'fecha' | 'hora' | 'fecha_hora' | 'emisor' | 'receptor' | 'cuerpo' | 'aplicacion' | 'adjunto';
export type Mapeo = Partial<Record<CampoUfed, number>>;

export const CAMPOS_UFED: { campo: CampoUfed; etiqueta: string; obligatorio?: boolean }[] = [
  { campo: 'cuerpo', etiqueta: 'Mensaje (texto)', obligatorio: true },
  { campo: 'emisor', etiqueta: 'De (remitente)' },
  { campo: 'receptor', etiqueta: 'Para' },
  { campo: 'fecha_hora', etiqueta: 'Fecha y hora juntas' },
  { campo: 'fecha', etiqueta: 'Fecha' },
  { campo: 'hora', etiqueta: 'Hora' },
  { campo: 'chat', etiqueta: 'Número de chat' },
  { campo: 'nombre_chat', etiqueta: 'Nombre del chat' },
  { campo: 'participantes', etiqueta: 'Participantes' },
  { campo: 'aplicacion', etiqueta: 'Aplicación' },
  { campo: 'adjunto', etiqueta: 'Adjunto' },
];

// Encabezados habituales (ya normalizados: sin tildes, en minúscula).
const SINONIMOS: Record<CampoUfed, string[]> = {
  cuerpo: ['body', 'cuerpo', 'mensaje', 'message', 'texto', 'text', 'contenido', 'contenido del mensaje'],
  emisor: ['from', 'de', 'remitente', 'sender', 'emisor', 'origen del mensaje'],
  receptor: ['to', 'para', 'destinatario', 'destinatarios', 'recipient', 'recipients', 'receptor'],
  fecha_hora: ['timestamp', 'marca de tiempo', 'fecha y hora', 'fecha/hora', 'date/time', 'date time', 'hora y fecha', 'timestamp: date/time'],
  fecha: ['timestamp: date', 'timestamp date', 'marca de tiempo: fecha', 'fecha', 'date', 'fecha del mensaje'],
  hora: ['timestamp: time', 'timestamp time', 'marca de tiempo: hora', 'hora', 'time', 'hora del mensaje'],
  chat: ['chat #', 'chat n', 'chat no', 'chat nro', 'n de chat', 'no de chat', 'nro de chat', 'numero de chat', 'chat id', 'id del chat', 'id de chat', 'chat'],
  nombre_chat: ['name', 'nombre', 'chat name', 'nombre del chat', 'asunto'],
  participantes: ['participants', 'participantes'],
  aplicacion: ['source', 'origen', 'aplicacion', 'app', 'fuente', 'application'],
  adjunto: ['attachment #1', 'attachment', 'attachments', 'adjunto #1', 'adjunto', 'adjuntos', 'archivo adjunto', 'archivos adjuntos'],
};

const HOJAS_DE_CHAT = ['chats', 'chat', 'instant messages', 'mensajes instantaneos', 'mensajes', 'sms messages', 'mensajes sms', 'whatsapp'];

const limpiarEncabezado = (t: string) => normalizar(t).replace(/[:.]+$/, '').replace(/[º°]/g, '').replace(/\s+/g, ' ').trim();

function celdaTexto(c: Celda): string {
  if (c === null || c === undefined) return '';
  if (c instanceof Date) return fechaCeldaTexto(c);
  if (typeof c === 'number') return String(c);
  if (typeof c === 'boolean') return c ? 'Sí' : 'No';
  return String(c).replace(/\r/g, '').trim();
}

const dos = (n: number) => String(n).padStart(2, '0');

/** Una celda de fecha de Excel llega como Date a medianoche UTC; una de hora, como Date del 30/12/1899. */
function fechaCeldaTexto(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  if (d.getUTCFullYear() <= 1900) return `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}:${dos(d.getUTCSeconds())}`;
  const hora = d.getUTCHours() || d.getUTCMinutes() || d.getUTCSeconds() ? ` ${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}:${dos(d.getUTCSeconds())}` : '';
  return `${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}${hora}`;
}

/** Busca la columna de cada campo en una fila de encabezados. Primero la coincidencia exacta; después, la que empieza igual. */
export function mapeoDeEncabezado(encabezado: string[]): Mapeo {
  const cols = encabezado.map(limpiarEncabezado);
  const m: Mapeo = {};
  const usadas = new Set<number>();
  // El orden importa: «timestamp: date» es fecha antes que fecha_hora; «chat #» antes que «chat».
  const orden: CampoUfed[] = ['cuerpo', 'fecha', 'hora', 'fecha_hora', 'emisor', 'receptor', 'participantes', 'chat', 'nombre_chat', 'aplicacion', 'adjunto'];
  for (const exacta of [true, false]) {
    for (const campo of orden) {
      if (m[campo] !== undefined) continue;
      const i = cols.findIndex((c, k) => !usadas.has(k) && c && SINONIMOS[campo].some((s) => (exacta ? c === s : c.startsWith(`${s} `) || c.startsWith(`${s}:`))));
      if (i >= 0) {
        m[campo] = i;
        usadas.add(i);
      }
    }
  }
  // Con fecha y hora separadas, la columna «fecha y hora» sobra (y al revés).
  if (m.fecha !== undefined && m.hora !== undefined) delete m.fecha_hora;
  return m;
}

const puntaje = (m: Mapeo) => (m.cuerpo !== undefined ? 3 : 0) + (m.emisor !== undefined ? 2 : 0) + (m.fecha !== undefined || m.fecha_hora !== undefined ? 2 : 0) + Object.keys(m).length * 0.1;

/** Encuentra la hoja de chats y la fila de encabezados (UFED suele poner un título arriba). */
export function detectarReporte(hojas: HojaCruda[]): { hoja: string; encabezado: number; columnas: string[]; mapeo: Mapeo } | null {
  let mejor: { hoja: string; encabezado: number; columnas: string[]; mapeo: Mapeo; p: number } | null = null;
  for (const h of hojas) {
    const bonus = HOJAS_DE_CHAT.includes(limpiarEncabezado(h.nombre)) ? 1 : 0;
    for (let i = 0; i < Math.min(20, h.filas.length); i++) {
      const columnas = (h.filas[i] ?? []).map(celdaTexto);
      const mapeo = mapeoDeEncabezado(columnas);
      // Un encabezado de verdad trae el mensaje y, además, el remitente o la fecha: así una fila de datos no se confunde con títulos.
      if (mapeo.cuerpo === undefined || (mapeo.emisor === undefined && mapeo.fecha === undefined && mapeo.fecha_hora === undefined)) continue;
      const p = puntaje(mapeo) + bonus;
      if (!mejor || p > mejor.p) mejor = { hoja: h.nombre, encabezado: i, columnas, mapeo, p };
    }
  }
  if (!mejor) return null;
  const { p: _p, ...r } = mejor;
  return r;
}

// ---------------------------------------------------------------------
// Fechas: se guarda siempre el texto tal cual; la fecha solo si es clara.
// ---------------------------------------------------------------------
type Orden = 'dm' | 'md';
const FECHA_NUM = /(\d{1,4})[/.-](\d{1,2})[/.-](\d{2,4})/;

function ordenDeFechas(textos: string[]): { orden: Orden; ambiguo: boolean } {
  let dm = false;
  let md = false;
  for (const t of textos) {
    const m = FECHA_NUM.exec(t);
    if (!m || m[1].length === 4) continue;
    if (Number(m[1]) > 12) dm = true;
    if (Number(m[2]) > 12) md = true;
  }
  if (md && !dm) return { orden: 'md', ambiguo: false };
  return { orden: 'dm', ambiguo: !dm && !md };
}

export function fechaISODe(texto: string, orden: Orden): string | undefined {
  const m = FECHA_NUM.exec(texto);
  if (!m) return undefined;
  let [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let dia: number, mes: number, anio: number;
  if (m[1].length === 4) [anio, mes, dia] = [a, b, c];
  else {
    if (m[3].length === 2) c = 2000 + c;
    [dia, mes, anio] = orden === 'dm' ? [a, b, c] : [b, a, c];
  }
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return undefined;
  return `${anio}-${dos(mes)}-${dos(dia)}`;
}

function tipoDeAdjunto(nombre: string): TipoMensaje {
  if (/\.(jpe?g|png|gif|webp|heic|bmp)\b/i.test(nombre)) return 'imagen';
  return 'archivo';
}

export type ChatUfed = {
  clave: string;
  titulo: string;
  participantes: string | null;
  aplicacion: string | null;
  mensajes: MensajeLeido[];
  desde?: string;
  hasta?: string;
};

export type ReporteUfed = {
  hoja: string;
  encabezado: number;
  columnas: string[];
  mapeo: Mapeo;
  chats: ChatUfed[];
  omitidas: LineaOmitida[];
  avisos: string[];
};

/** Lee el reporte con el mapeo detectado o con el que eligió la persona. */
export function leerReporteUfed(hojas: HojaCruda[], forzado?: { hoja: string; encabezado: number; mapeo: Mapeo }): ReporteUfed {
  const det = forzado ? { ...forzado, columnas: (hojas.find((h) => h.nombre === forzado.hoja)?.filas[forzado.encabezado] ?? []).map(celdaTexto) } : detectarReporte(hojas);
  if (!det) throw new Error('No encontramos una hoja con mensajes: tiene que haber una columna como «Body», «Mensaje» o «Cuerpo». Exportá el reporte desde UFED Reader a Excel.');
  const hoja = hojas.find((h) => h.nombre === det.hoja)!;
  const { mapeo } = det;
  const val = (fila: Celda[], campo: CampoUfed) => (mapeo[campo] === undefined ? '' : celdaTexto(fila[mapeo[campo]!]));

  const filas = hoja.filas.slice(det.encabezado + 1);
  const fechas = filas.map((f) => val(f, 'fecha') || val(f, 'fecha_hora')).filter(Boolean);
  const { orden, ambiguo } = ordenDeFechas(fechas);
  const avisos: string[] = [];
  if (ambiguo && fechas.length) avisos.push('Las fechas del reporte pueden leerse como día/mes o mes/día: se tomaron como día/mes. El texto de la fecha se guarda tal cual; revisalo antes de importar.');
  if (mapeo.emisor === undefined) avisos.push('No se reconoció la columna del remitente: elegila abajo, o los mensajes quedan sin «De».');

  const chats = new Map<string, ChatUfed>();
  const omitidas: LineaOmitida[] = [];
  // Las columnas del chat vienen solo en su primera fila (celdas combinadas): se arrastran hacia abajo.
  let arrastre = { chat: '', nombre: '', participantes: '', aplicacion: '' };
  filas.forEach((fila, i) => {
    const nroFila = det.encabezado + i + 2;
    const chat = val(fila, 'chat');
    if (chat && chat !== arrastre.chat) arrastre = { chat, nombre: '', participantes: '', aplicacion: '' };
    arrastre = {
      chat: chat || arrastre.chat,
      nombre: val(fila, 'nombre_chat') || arrastre.nombre,
      participantes: val(fila, 'participantes') || arrastre.participantes,
      aplicacion: val(fila, 'aplicacion') || arrastre.aplicacion,
    };
    const cuerpo = mapeo.cuerpo === undefined ? '' : (() => {
      const c = fila[mapeo.cuerpo!];
      return c === null || c === undefined ? '' : String(c).replace(/\r\n?/g, '\n');
    })();
    const adjunto = val(fila, 'adjunto');
    if (!cuerpo.trim() && !adjunto) {
      const resto = fila.map(celdaTexto).filter(Boolean).join(' · ');
      if (resto) omitidas.push({ linea: nroFila, texto: resto.slice(0, 140), motivo: 'Fila sin mensaje ni adjunto (datos del chat o una fila vacía).' });
      return;
    }
    const clave = arrastre.chat || arrastre.nombre || arrastre.participantes || 'unico';
    let c = chats.get(clave);
    if (!c) {
      const titulo = arrastre.nombre || arrastre.participantes || (arrastre.chat ? `Chat Nº ${arrastre.chat}` : 'Conversación del reporte');
      c = { clave, titulo: [arrastre.aplicacion, titulo].filter(Boolean).join(' · '), participantes: arrastre.participantes || null, aplicacion: arrastre.aplicacion || null, mensajes: [] };
      chats.set(clave, c);
    }
    const fechaTexto = [val(fila, 'fecha') || val(fila, 'fecha_hora'), val(fila, 'hora')].filter(Boolean).join(' ');
    const fecha = fechaTexto ? fechaISODe(fechaTexto, orden) : undefined;
    const tipo: TipoMensaje = adjunto ? tipoDeAdjunto(adjunto) : 'texto';
    c.mensajes.push({
      orden: c.mensajes.length + 1,
      linea: nroFila,
      fecha,
      fecha_texto: fechaTexto || undefined,
      emisor: val(fila, 'emisor') || undefined,
      receptor: val(fila, 'receptor') || undefined,
      tipo,
      contenido: cuerpo.trim() ? cuerpo : `[adjunto: ${adjunto}]`,
      incluir: true,
      aviso: fechaTexto && !fecha ? 'La fecha no se pudo leer: queda solo el texto.' : undefined,
    });
  });
  for (const c of chats.values()) {
    const f = c.mensajes.map((m) => m.fecha).filter((x): x is string => !!x).sort();
    c.desde = f[0];
    c.hasta = f[f.length - 1];
  }
  return { hoja: det.hoja, encabezado: det.encabezado, columnas: det.columnas, mapeo, chats: [...chats.values()], omitidas, avisos };
}

/** Un chat del reporte, con la forma que usa el asistente de conversaciones. */
export function chatAConversacion(chat: ChatUfed, reporte: ReporteUfed): ConversacionLeida {
  const emisores = [...new Set(chat.mensajes.map((m) => m.emisor).filter((x): x is string => !!x))];
  const nombres = chat.participantes ? chat.participantes.split(/\s*[,;\n]\s*/).filter(Boolean) : emisores;
  return {
    titulo: chat.titulo,
    participantes: chat.participantes ?? (emisores.length ? emisores.join(', ') : undefined),
    nombres,
    periodo_desde: chat.desde,
    periodo_hasta: chat.hasta,
    mensajes: chat.mensajes.map((m, i) => ({ ...m, orden: i + 1 })),
    omitidas: reporte.omitidas,
    avisos: reporte.avisos,
  };
}
