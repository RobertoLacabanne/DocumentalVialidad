// Documentos leídos: huella del archivo, limpieza del texto de cada página
// y el paquete de texto que trae AppUFIL. Nada de esto toca el original:
// el archivo se lee en el navegador y solo viaja su texto.

export type MetodoLectura = 'capa_texto' | 'ocr' | 'appufil';

export type PaginaLeida = {
  nro: number;
  texto: string;
  metodo: MetodoLectura;
  motor?: string | null;
  confianza?: number | null;
};

/** Archivos que el navegador sabe leer. El resto se lista como omitido, con el motivo. */
export const LEIBLES = /\.(pdf|png|jpe?g|webp|bmp)$/i;

export function motivoNoLeible(nombre: string): string | null {
  if (LEIBLES.test(nombre)) return null;
  if (/\.tiff?$/i.test(nombre)) return 'El navegador no abre TIFF: convertilo a PDF o leelo con AppUFIL.';
  if (/\.(docx?|xlsx?|odt|rtf|txt)$/i.test(nombre)) return 'Es un documento de texto, no un escaneo: se busca desde su propio programa o se importa por Mensajes.';
  return 'No es un PDF ni una imagen.';
}

/** Huella SHA-256 en hexadecimal: identifica el contenido, no el nombre. */
export async function sha256Hex(datos: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
  const hash = await crypto.subtle.digest('SHA-256', buf as BufferSource);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Deja el texto de una página listo para guardar: sin caracteres de control
 * (la base no acepta el carácter nulo que a veces trae un PDF), sin espacios
 * de más y sin tandas de líneas vacías. No cambia ninguna palabra.
 */
export function limpiarTexto(t: string): string {
  return t
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F�]/g, '')
    .replace(/[ \t ]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Arma el texto de una página a partir de los trozos que da pdf.js. */
export function textoDeItems(items: { str: string; hasEOL?: boolean }[]): string {
  let t = '';
  for (const it of items) {
    t += it.str;
    if (it.hasEOL) t += '\n';
    else if (it.str && !/\s$/.test(it.str)) t += ' ';
  }
  return limpiarTexto(t);
}

/** ¿La capa de texto del PDF sirve, o la página es una imagen y hay que hacerle OCR? */
export function textoUtil(t: string): boolean {
  const letras = (t.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) ?? []).length;
  return letras >= 25;
}

export function tamanoLegible(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export const huellaCorta = (sha: string) => `${sha.slice(0, 8)}…${sha.slice(-6)}`;

export const ETIQUETA_METODO: Record<MetodoLectura, string> = {
  capa_texto: 'Texto del PDF',
  ocr: 'OCR en el navegador',
  appufil: 'AppUFIL',
};

// ---------------------------------------------------------------------
// Paquete de texto (AppUFIL u otro sistema): un JSON con la huella de
// cada archivo y el texto de cada página. Es el único contrato entre las
// dos aplicaciones: ninguna depende de la otra para funcionar.
// ---------------------------------------------------------------------
export const FORMATO_PAQUETE = 'tablero-texto/1';

export type ArchivoPaquete = {
  sha256: string;
  nombre: string;
  ruta?: string | null;
  bytes?: number | null;
  paginas: number;
  texto: PaginaLeida[];
};

export type PaqueteTexto = {
  formato: typeof FORMATO_PAQUETE;
  generado_por?: string;
  generado_en?: string;
  legajo?: string;
  archivos: ArchivoPaquete[];
};

export function leerPaqueteTexto(json: unknown): { paquete: PaqueteTexto; avisos: string[] } {
  const p = json as Partial<PaqueteTexto> & { archivos?: unknown[] };
  if (!p || typeof p !== 'object' || p.formato !== FORMATO_PAQUETE) {
    throw new Error(`No es un paquete de texto del tablero (falta "formato": "${FORMATO_PAQUETE}"). Generalo con herramientas/appufil-a-tablero.py.`);
  }
  if (!Array.isArray(p.archivos) || !p.archivos.length) throw new Error('El paquete no trae ningún archivo.');
  const avisos: string[] = [];
  const archivos: ArchivoPaquete[] = [];
  const vistos = new Set<string>();
  p.archivos.forEach((crudo, i) => {
    const a = crudo as Partial<ArchivoPaquete>;
    const sha = String(a.sha256 ?? '').toLowerCase().trim();
    const nombre = String(a.nombre ?? '').trim();
    if (!/^[0-9a-f]{64}$/.test(sha) || !nombre) {
      avisos.push(`El archivo ${i + 1} no trae huella SHA-256 o nombre válidos: queda afuera.`);
      return;
    }
    if (vistos.has(sha)) {
      avisos.push(`«${nombre}» aparece dos veces con la misma huella: se toma una sola.`);
      return;
    }
    vistos.add(sha);
    const paginas = Number(a.paginas);
    const texto = (Array.isArray(a.texto) ? a.texto : [])
      .map((t) => ({
        nro: Number(t.nro),
        texto: limpiarTexto(String(t.texto ?? '')),
        metodo: 'appufil' as const,
        motor: t.motor ?? null,
        confianza: t.confianza == null || Number.isNaN(Number(t.confianza)) ? null : Math.max(0, Math.min(100, Number(t.confianza))),
      }))
      .filter((t) => Number.isInteger(t.nro) && t.nro >= 1 && (!paginas || t.nro <= paginas));
    if (!texto.length) avisos.push(`«${nombre}» no trae texto de ninguna página.`);
    archivos.push({
      sha256: sha,
      nombre,
      ruta: a.ruta ?? null,
      bytes: a.bytes == null ? null : Number(a.bytes),
      paginas: Number.isInteger(paginas) && paginas > 0 ? paginas : Math.max(0, ...texto.map((t) => t.nro)),
      texto,
    });
  });
  if (!archivos.length) throw new Error('Ningún archivo del paquete tiene huella y nombre válidos.');
  return { paquete: { formato: FORMATO_PAQUETE, generado_por: p.generado_por, generado_en: p.generado_en, legajo: p.legajo, archivos }, avisos };
}

/** Parte una lista en tandas (para no mandar mil páginas en un solo pedido). */
export function enTandas<T>(lista: T[], tamano: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) r.push(lista.slice(i, i + tamano));
  return r;
}
