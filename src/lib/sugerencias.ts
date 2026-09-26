// Sugerencias automáticas para un documento leído: a qué efecto pertenece,
// qué contratación, persona o efecto menciona y si ya es una pieza del
// índice. Todas quedan «pendientes de validar»: ninguna toca un dato hasta
// que una persona la confirma.

export type Sugerida = {
  campo: 'efecto_id' | 'pieza_id' | 'vinculo';
  valor: { id: string; tipo?: 'contratacion' | 'persona' | 'efecto' };
  fuente: 'carpeta' | 'texto' | 'otro';
  detalle: string;
};

type Entrada = {
  nombre: string;
  ruta?: string | null;
  sha256: string;
  paginas: { nro: number; texto: string }[];
  actual?: { efecto_id?: string | null; pieza_id?: string | null };
};

type Causa = {
  efectos: { id: string; numero: string }[];
  contrataciones: { id: string; identificador: string; expediente: string | null }[];
  personas: { id: string; nombre: string; identificadores: { tipo: string; valor: string }[] }[];
  enlaces: { entidad_id: string; sha256: string | null; nombre_archivo: string | null }[];
  piezas: { id: string; numero_orden: string | null; titulo: string }[];
};

const MAX_POR_DOCUMENTO = 20;

const EFECTO_EN_RUTA = /EFECTO\s*(?:N\s*[º°o.]?\s*|Nro\.?\s*)?(\d{3,6})/i;
const EFECTO_EN_TEXTO = /\befecto\s*(?:N\s*[º°o.]?\s*|Nro\.?\s*|n[uú]mero\s*)?(\d{4,6})\b/gi;
const PROCEDIMIENTO =
  /(?<![A-Za-zÁÉÍÓÚáéíóú])(licitaci[oó]n\s+p[uú]blica|licitaci[oó]n\s+privada|contrataci[oó]n\s+directa|concurso\s+de\s+precios|L\.?\s?Pr\.?|L\.?\s?P\.?|C\.?\s?D\.?|C\.?\s?P\.?)\s*(?:N\s*[º°o.]?\s*|Nro\.?\s*|n[uú]mero\s*)?(\d{1,4})\s*[/-]\s*(\d{4}|\d{2})(?!\d)/gi;
const CUIT = /(?<!\d)(20|23|24|27|30|33|34)[-\s.]?(\d{8})[-\s.]?(\d)(?!\d)/g;

function tipoProcedimiento(t: string): string {
  const s = t.toLowerCase().replace(/[\s.]/g, '');
  if (s.startsWith('licitaci') && s.includes('priv')) return 'LPR';
  if (s.startsWith('licitaci')) return 'LP';
  if (s.startsWith('contrataci')) return 'CD';
  if (s.startsWith('concurso')) return 'CP';
  if (s === 'lpr') return 'LPR';
  if (s === 'lp') return 'LP';
  if (s === 'cd') return 'CD';
  return 'CP';
}

function anio4(a: string): number {
  const n = Number(a);
  return a.length === 2 ? (n < 50 ? 2000 + n : 1900 + n) : n;
}

/** «LP 05/2020», «Licitación Pública Nº 5/20» y «L.P. 05-2020» dan la misma clave. */
export function claveProcedimiento(texto: string): string | null {
  PROCEDIMIENTO.lastIndex = 0;
  const m = PROCEDIMIENTO.exec(texto);
  return m ? `${tipoProcedimiento(m[1])}-${Number(m[2])}-${anio4(m[3])}` : null;
}

/** Un trozo del texto alrededor de lo encontrado, en una sola línea. */
export function fragmento(texto: string, desde: number, largo: number, margen = 30): string {
  const ini = Math.max(0, desde - margen);
  const fin = Math.min(texto.length, desde + largo + margen);
  return `${ini > 0 ? '…' : ''}${texto.slice(ini, fin).replace(/\s+/g, ' ').trim()}${fin < texto.length ? '…' : ''}`;
}

export function sugerirParaDocumento(d: Entrada, c: Causa): Sugerida[] {
  const r: Sugerida[] = [];
  const ya = new Set<string>();
  const sumar = (s: Sugerida) => {
    const k = `${s.campo}:${s.valor.id}`;
    if (ya.has(k) || r.length >= MAX_POR_DOCUMENTO) return;
    ya.add(k);
    r.push(s);
  };
  const efectoPorNumero = new Map(c.efectos.map((e) => [e.numero.replace(/\D/g, ''), e]));

  // 1. La carpeta o el nombre del archivo dicen de qué efecto es.
  for (const [texto, donde] of [
    [d.ruta ?? '', 'La carpeta'],
    [d.nombre, 'El nombre del archivo'],
  ] as const) {
    const m = EFECTO_EN_RUTA.exec(texto);
    const e = m && efectoPorNumero.get(m[1]);
    if (e && d.actual?.efecto_id !== e.id) {
      sumar({ campo: 'efecto_id', valor: { id: e.id }, fuente: 'carpeta', detalle: `${donde} dice «${m[0]}»` });
    }
  }

  // 2. Ya es una pieza del índice: un enlace suyo tiene la misma huella o el mismo nombre de archivo.
  const piezaPorId = new Map(c.piezas.map((p) => [p.id, p]));
  for (const en of c.enlaces) {
    const p = piezaPorId.get(en.entidad_id);
    if (!p || d.actual?.pieza_id === p.id) continue;
    const cual = `la pieza ${p.numero_orden ? `Nº ${p.numero_orden}` : `«${p.titulo}»`}`;
    if (en.sha256 && en.sha256 === d.sha256) {
      sumar({ campo: 'pieza_id', valor: { id: p.id }, fuente: 'otro', detalle: `Un enlace de ${cual} tiene la misma huella SHA-256` });
    } else if (en.nombre_archivo && en.nombre_archivo.trim().toLowerCase() === d.nombre.trim().toLowerCase()) {
      sumar({ campo: 'pieza_id', valor: { id: p.id }, fuente: 'otro', detalle: `Un enlace de ${cual} se llama igual («${en.nombre_archivo}»)` });
    }
  }

  // 3. Lo que menciona el texto.
  const porClave = new Map<string, { id: string; identificador: string }>();
  for (const co of c.contrataciones) {
    const k = claveProcedimiento(co.identificador);
    if (k) porClave.set(k, co);
  }
  const expedientes = c.contrataciones
    .map((co) => ({ co, digitos: (co.expediente ?? '').replace(/\D/g, '') }))
    .filter((x) => x.digitos.length >= 5)
    .map((x) => ({ ...x, re: new RegExp(`(?<!\\d)${x.digitos.split('').join('[.\\s]?')}(?!\\d)`) }));
  const cuits = new Map<string, { id: string; nombre: string }>();
  for (const p of c.personas) {
    for (const i of p.identificadores) {
      const dig = i.valor.replace(/\D/g, '');
      if (i.tipo === 'cuit' && dig.length === 11) cuits.set(dig, p);
    }
  }

  for (const pag of d.paginas) {
    const t = pag.texto;
    if (!t) continue;
    const pagina = `Pág. ${pag.nro}`;

    PROCEDIMIENTO.lastIndex = 0;
    for (let m = PROCEDIMIENTO.exec(t); m; m = PROCEDIMIENTO.exec(t)) {
      const co = porClave.get(`${tipoProcedimiento(m[1])}-${Number(m[2])}-${anio4(m[3])}`);
      if (co) sumar({ campo: 'vinculo', valor: { tipo: 'contratacion', id: co.id }, fuente: 'texto', detalle: `${pagina}: «${fragmento(t, m.index, m[0].length)}»` });
    }
    for (const x of expedientes) {
      const m = x.re.exec(t);
      if (m) sumar({ campo: 'vinculo', valor: { tipo: 'contratacion', id: x.co.id }, fuente: 'texto', detalle: `${pagina}: «${fragmento(t, m.index, m[0].length)}»` });
    }
    CUIT.lastIndex = 0;
    for (let m = CUIT.exec(t); m; m = CUIT.exec(t)) {
      const p = cuits.get(`${m[1]}${m[2]}${m[3]}`);
      if (p) sumar({ campo: 'vinculo', valor: { tipo: 'persona', id: p.id }, fuente: 'texto', detalle: `${pagina}: CUIT ${m[0].trim()} (${p.nombre})` });
    }
    EFECTO_EN_TEXTO.lastIndex = 0;
    for (let m = EFECTO_EN_TEXTO.exec(t); m; m = EFECTO_EN_TEXTO.exec(t)) {
      const e = efectoPorNumero.get(m[1]);
      if (e && d.actual?.efecto_id !== e.id) {
        sumar({ campo: 'vinculo', valor: { tipo: 'efecto', id: e.id }, fuente: 'texto', detalle: `${pagina}: «${fragmento(t, m.index, m[0].length)}»` });
      }
    }
  }
  return r;
}

/** Cómo se lee una sugerencia en la bandeja. */
export function textoSugerencia(
  s: { campo: string; valor_sugerido: { id: string; tipo?: string } | null },
  nombres: { efecto: (id: string) => string | undefined; contratacion: (id: string) => string | undefined; persona: (id: string) => string | undefined; pieza: (id: string) => string | undefined },
): string {
  const id = s.valor_sugerido?.id ?? '';
  if (s.campo === 'efecto_id') return `Es del efecto Nº ${nombres.efecto(id) ?? '[efecto archivado]'}`;
  if (s.campo === 'pieza_id') return `Es la pieza ${nombres.pieza(id) ?? '[pieza archivada]'}`;
  const tipo = s.valor_sugerido?.tipo;
  if (tipo === 'contratacion') return `Menciona la contratación ${nombres.contratacion(id) ?? '[archivada]'}`;
  if (tipo === 'persona') return `Menciona a ${nombres.persona(id) ?? '[persona archivada]'}`;
  if (tipo === 'efecto') return `Menciona el efecto Nº ${nombres.efecto(id) ?? '[archivado]'}`;
  return 'Sugerencia';
}
