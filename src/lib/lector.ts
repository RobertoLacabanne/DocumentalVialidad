// Lector de escaneos en el navegador. pdf.js saca la capa de texto del PDF;
// si la página es una imagen, se dibuja y se le hace OCR en castellano con
// tesseract.js. El archivo no sale de la computadora: se lee en memoria y
// solo viaja su texto. Las dos librerías se bajan recién la primera vez que
// alguien lee un documento (el OCR, unos 6 MB con los datos del castellano,
// servidos desde la misma app).
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { limpiarTexto, textoDeItems, textoUtil, type PaginaLeida } from './documentos';

type Pdfjs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let cargaPdfjs: Promise<Pdfjs> | null = null;

async function pdfjs(): Promise<Pdfjs> {
  cargaPdfjs ??= (async () => {
    // La versión «legacy» trae lo que les falta a los navegadores que no son de este año.
    const [lib, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]);
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  })();
  return cargaPdfjs;
}

export const esPdf = (f: { name: string; type?: string }) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf';

/** Abre un PDF ya leído en memoria. pdf.js se queda con el búfer, por eso recibe una copia. */
export async function abrirPdf(datos: ArrayBuffer): Promise<PDFDocumentProxy> {
  const lib = await pdfjs();
  return lib.getDocument({ data: new Uint8Array(datos.slice(0)) }).promise;
}

// ---------------------------------------------------------------------
// OCR: un grupo de trabajadores de tesseract.js que reparten las páginas.
// ---------------------------------------------------------------------
export type Ocr = {
  motor: string;
  leer: (imagen: HTMLCanvasElement | Blob) => Promise<{ texto: string; confianza: number }>;
  cerrar: () => Promise<void>;
};

export function trabajadoresSugeridos(): number {
  const nucleos = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(4, Math.floor(nucleos / 2)));
}

export async function crearOcr(trabajadores = trabajadoresSugeridos()): Promise<Ocr> {
  const { createScheduler, createWorker, OEM } = await import('tesseract.js');
  const planificador = createScheduler();
  // Todo se sirve desde la propia app (ver scripts/copiar-ocr.mjs): nada depende de un CDN.
  const base = new URL('/ocr/', window.location.href).href;
  const opciones = { workerPath: `${base}worker.min.js`, corePath: `${base}core`, langPath: `${base}lang` };
  const lista = await Promise.all(Array.from({ length: trabajadores }, () => createWorker('spa', OEM.LSTM_ONLY, opciones)));
  for (const w of lista) planificador.addWorker(w);
  return {
    motor: 'tesseract.js 7 · castellano',
    async leer(imagen) {
      const r = await planificador.addJob('recognize', imagen);
      return { texto: limpiarTexto(r.data.text ?? ''), confianza: Math.round((r.data.confidence ?? 0) * 100) / 100 };
    },
    async cerrar() {
      await planificador.terminate();
    },
  };
}

/** Lee una página: la capa de texto si sirve; si no, OCR sobre la página dibujada a unos 2.200 px de ancho. */
export async function leerPaginaPdf(pdf: PDFDocumentProxy, nro: number, ocr: () => Promise<Ocr>): Promise<PaginaLeida> {
  const pagina = await pdf.getPage(nro);
  try {
    const contenido = await pagina.getTextContent();
    const texto = textoDeItems(contenido.items.filter((i): i is { str: string; hasEOL: boolean } & typeof i => 'str' in i));
    if (textoUtil(texto)) return { nro, texto, metodo: 'capa_texto', motor: 'pdf.js' };

    const base = pagina.getViewport({ scale: 1 });
    const escala = Math.min(4, Math.max(1.5, 2200 / Math.max(base.width, 1)));
    const vista = pagina.getViewport({ scale: escala });
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.ceil(vista.width);
    lienzo.height = Math.ceil(vista.height);
    await pagina.render({ canvas: lienzo, viewport: vista }).promise;
    const motor = await ocr();
    const r = await motor.leer(lienzo);
    lienzo.width = 0;
    lienzo.height = 0;
    return { nro, texto: r.texto, metodo: 'ocr', motor: motor.motor, confianza: r.confianza };
  } finally {
    pagina.cleanup();
  }
}

export async function leerImagen(archivo: Blob, ocr: () => Promise<Ocr>): Promise<PaginaLeida> {
  const motor = await ocr();
  const r = await motor.leer(archivo);
  return { nro: 1, texto: r.texto, metodo: 'ocr', motor: motor.motor, confianza: r.confianza };
}

// ---------------------------------------------------------------------
// Carpetas: al arrastrar una carpeta del Drive, se recorre entera y cada
// archivo recuerda su ruta ("EFECTO 48435/PARTE 1.pdf").
// ---------------------------------------------------------------------
export type ArchivoConRuta = { archivo: File; ruta: string };

type Entrada = FileSystemEntry & { isFile: boolean; isDirectory: boolean };

async function recorrer(entrada: Entrada, prefijo: string, salida: ArchivoConRuta[]): Promise<void> {
  if (entrada.isFile) {
    const archivo = await new Promise<File>((ok, mal) => (entrada as FileSystemFileEntry).file(ok, mal));
    salida.push({ archivo, ruta: `${prefijo}${archivo.name}` });
  } else if (entrada.isDirectory) {
    const lector = (entrada as FileSystemDirectoryEntry).createReader();
    // readEntries devuelve de a tandas: se llama hasta que venga vacío.
    for (;;) {
      const tanda = await new Promise<FileSystemEntry[]>((ok, mal) => lector.readEntries(ok, mal));
      if (!tanda.length) break;
      for (const hija of tanda) await recorrer(hija as Entrada, `${prefijo}${entrada.name}/`, salida);
    }
  }
}

export async function archivosSoltados(dt: DataTransfer): Promise<ArchivoConRuta[]> {
  const entradas = [...dt.items].map((i) => (i.kind === 'file' ? (i.webkitGetAsEntry?.() as Entrada | null) : null)).filter((e): e is Entrada => !!e);
  if (!entradas.length) return [...dt.files].map((archivo) => ({ archivo, ruta: archivo.name }));
  const salida: ArchivoConRuta[] = [];
  for (const e of entradas) await recorrer(e, '', salida);
  return salida;
}

export function archivosElegidos(lista: FileList | null): ArchivoConRuta[] {
  return [...(lista ?? [])].map((archivo) => ({ archivo, ruta: (archivo as File & { webkitRelativePath?: string }).webkitRelativePath || archivo.name }));
}
