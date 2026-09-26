// Importación de planillas de efectos (LISTADO EFECTOS, DISTRIBUCIÓN DE TAREAS
// y cualquier planilla con columnas parecidas).
//
// Regla: se transcribe lo que dice la planilla. Nada se completa por deducción.
// Un valor que no se reconoce frena esa fila y se muestra para corregirlo;
// nunca se reemplaza por otro en silencio.

export type Celda = string | number | boolean | Date | null | undefined;

export type Campo =
  | 'numero'
  | 'numero_interno'
  | 'sobre'
  | 'tipo_material'
  | 'descripcion_acta'
  | 'responsable'
  | 'estado'
  | 'apto_analisis'
  | 'observaciones'
  | 'procedimiento'
  | 'propietario'
  | 'tenedor'
  | 'patron_contrasena'
  | 'resolucion_autorizante'
  | 'tiene_informe_gabinete'
  | 'observaciones_gabinete'
  | 'ubicacion_fisica'
  | 'link_escaneo'
  | 'lugar_secuestro'
  | 'prioridad'
  | 'fojas_aprox'
  | 'fecha_inicio'
  | 'fecha_fin';

export const CAMPOS_IMPORTACION: { campo: Campo; etiqueta: string; sinonimos: string[]; obligatorio?: boolean }[] = [
  { campo: 'numero', etiqueta: 'Nº de efecto', sinonimos: ['n° de efecto', 'nº de efecto', 'numero de efecto', 'efecto nº', 'efecto n°', 'efecto', 'n de efecto'], obligatorio: true },
  { campo: 'numero_interno', etiqueta: 'Nº interno', sinonimos: ['nº interno', 'n° interno', 'numero interno'] },
  { campo: 'sobre', etiqueta: 'Sobre Nº', sinonimos: ['sobre nº', 'sobre n°', 'sobre'] },
  { campo: 'tipo_material', etiqueta: 'Tipo de material', sinonimos: ['tipo de material'] },
  { campo: 'descripcion_acta', etiqueta: 'Descripción según el acta', sinonimos: ['descripcion', 'descripción (según acta de secuestro)', 'descripcion segun acta'] },
  { campo: 'responsable', etiqueta: 'Responsable', sinonimos: ['responsable'] },
  { campo: 'estado', etiqueta: 'Estado', sinonimos: ['estado'] },
  { campo: 'apto_analisis', etiqueta: '¿Apto para analizar?', sinonimos: ['apto para analizar?', 'apto para analizar'] },
  { campo: 'observaciones', etiqueta: 'Observaciones', sinonimos: ['observaciones'] },
  { campo: 'procedimiento', etiqueta: 'Fecha y domicilio del procedimiento', sinonimos: ['fecha de procedimiento y domicilio', 'procedimiento'] },
  { campo: 'propietario', etiqueta: 'Propietario', sinonimos: ['propietario (pj/ph)', 'propietario'] },
  { campo: 'tenedor', etiqueta: 'Tenedor', sinonimos: ['tenedor'] },
  { campo: 'patron_contrasena', etiqueta: 'Patrón / contraseña', sinonimos: ['patron/contraseña', 'patrón/contraseña', 'patron', 'contraseña'] },
  { campo: 'resolucion_autorizante', etiqueta: 'Autorización (resolución)', sinonimos: ['autorizacion para ingreso', 'autorización para ingreso', 'autorizacion'] },
  { campo: 'tiene_informe_gabinete', etiqueta: '¿Tiene informe del gabinete?', sinonimos: ['informe del gabinete'] },
  { campo: 'observaciones_gabinete', etiqueta: 'Observaciones del gabinete', sinonimos: ['observaciones del gabinete'] },
  { campo: 'ubicacion_fisica', etiqueta: 'Ubicación actual', sinonimos: ['ubicacion actual', 'ubicación actual', 'ubicacion'] },
  { campo: 'link_escaneo', etiqueta: 'Link del escaneo', sinonimos: ['link del escaneo', 'link'] },
  { campo: 'lugar_secuestro', etiqueta: 'Origen / lugar de secuestro', sinonimos: ['origen', 'origen / lugar de secuestro', 'lugar de secuestro'] },
  { campo: 'prioridad', etiqueta: 'Prioridad', sinonimos: ['prioridad'] },
  { campo: 'fojas_aprox', etiqueta: 'Fojas aprox.', sinonimos: ['fojas aprox.', 'fojas aprox', 'fojas'] },
  { campo: 'fecha_inicio', etiqueta: 'Fecha de inicio', sinonimos: ['fecha inicio', 'fecha de inicio'] },
  { campo: 'fecha_fin', etiqueta: 'Fecha de fin', sinonimos: ['fecha fin', 'fecha de fin'] },
];

export type Mapeo = Partial<Record<Campo, number>>;

export type FilaEfecto = {
  fila: number;
  numero: string;
  numero_interno?: string;
  sobre?: string;
  soporte: 'papel' | 'digital';
  tipo_material?: string;
  descripcion_acta?: string;
  responsable_alias?: string;
  requiere_escribiente?: boolean;
  estado?: string;
  apto_analisis?: string;
  observaciones?: string;
  procedimiento_fecha?: string;
  procedimiento_domicilio?: string;
  propietario?: string;
  tenedor?: string;
  patron_contrasena?: string;
  resolucion_autorizante?: string;
  tiene_informe_gabinete?: boolean;
  observaciones_gabinete?: string;
  informe_numero?: string;
  ubicacion_fisica?: string;
  link_escaneo?: string;
  lugar_secuestro?: string;
  prioridad?: string;
  fojas_aprox?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
};

export type ResultadoFila =
  | { tipo: 'vacia'; fila: number }
  | { tipo: 'sin_numero'; fila: number; contenido: string }
  | { tipo: 'error'; fila: number; numero: string; errores: string[] }
  | { tipo: 'ok'; fila: number; datos: FilaEfecto; avisos: string[] };

// ---------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------
export const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function texto(c: Celda): string {
  if (c === null || c === undefined) return '';
  if (c instanceof Date) return fechaISO(c) ?? '';
  if (typeof c === 'number') return Number.isInteger(c) ? String(c) : String(c).replace('.', ',');
  if (typeof c === 'boolean') return c ? 'SI' : 'NO';
  return String(c).replace(/\r/g, '').trim();
}

function fechaISO(d: Date): string | null {
  if (Number.isNaN(d.getTime())) return null;
  // Las fechas de Excel llegan a medianoche UTC: se toman en UTC para no correrse de día.
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** "28/10/2025" o "10/08/26" → "2025-10-28" / "2026-08-10". Devuelve null si no es una fecha válida. */
export function fechaDeTexto(t: string): string | null {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t.trim());
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return fechaISO(d);
}

/**
 * "28/10/2025 Avenida Francisco Ramírez N° 2197 (DPV)" → fecha + domicilio.
 * "10/08/26. Vivienda ubicada en calle …" → también. Sin fecha al principio, todo es domicilio.
 */
export function separarProcedimiento(t: string): { fecha: string | null; domicilio: string | null; fechaInvalida: boolean } {
  const limpio = t.trim();
  if (!limpio) return { fecha: null, domicilio: null, fechaInvalida: false };
  const m = /^(\d{1,2}[/.-]\d{1,2}[/.-](?:\d{4}|\d{2}))\.?\s*[-–,]?\s*(.*)$/s.exec(limpio);
  if (!m) return { fecha: null, domicilio: limpio, fechaInvalida: false };
  const fecha = fechaDeTexto(m[1]);
  const resto = m[2].trim().replace(/\.$/, '').trim();
  if (!fecha) return { fecha: null, domicilio: limpio, fechaInvalida: true };
  return { fecha, domicilio: resto || null, fechaInvalida: false };
}

// ---------------------------------------------------------------------
// Encabezado y mapeo automático
// ---------------------------------------------------------------------
function coincide(celda: string, sinonimos: string[]) {
  const n = normalizar(celda);
  return sinonimos.some((s) => normalizar(s) === n);
}

/** Busca la fila de encabezados: la primera con al menos 3 títulos conocidos. */
export function detectarEncabezado(filas: Celda[][]): number {
  const todos = CAMPOS_IMPORTACION.flatMap((c) => c.sinonimos);
  for (let i = 0; i < Math.min(filas.length, 30); i++) {
    const conocidos = filas[i].filter((c) => texto(c) && coincide(texto(c), todos)).length;
    if (conocidos >= 3) return i;
  }
  return 0;
}

export function autoMapear(encabezados: Celda[]): Mapeo {
  const mapeo: Mapeo = {};
  const titulos = encabezados.map((c) => texto(c));
  const usados = new Set<number>();
  // "OBSERVACIONES" puede aparecer dos veces: la que va después de "Informe del gabinete" es la del gabinete.
  const iInforme = titulos.findIndex((t) => coincide(t, ['informe del gabinete']));
  const observaciones = titulos.map((t, i) => (coincide(t, ['observaciones']) ? i : -1)).filter((i) => i >= 0);
  if (observaciones.length > 1 && iInforme >= 0) {
    const delGabinete = observaciones.find((i) => i > iInforme);
    const generales = observaciones.find((i) => i !== delGabinete);
    if (delGabinete !== undefined) {
      mapeo.observaciones_gabinete = delGabinete;
      usados.add(delGabinete);
    }
    if (generales !== undefined) {
      mapeo.observaciones = generales;
      usados.add(generales);
    }
  }
  for (const def of CAMPOS_IMPORTACION) {
    if (mapeo[def.campo] !== undefined) continue;
    const i = titulos.findIndex((t, idx) => !usados.has(idx) && t && coincide(t, def.sinonimos));
    if (i >= 0) {
      mapeo[def.campo] = i;
      usados.add(i);
    }
  }
  return mapeo;
}

// ---------------------------------------------------------------------
// Conversión de valores
// ---------------------------------------------------------------------
const ESTADOS: Record<string, string> = {
  'sin iniciar': 'sin_iniciar',
  'en proceso': 'en_proceso',
  escaneado: 'escaneado',
  finalizado: 'finalizado',
  observado: 'observado',
};
const APTO: Record<string, string> = {
  si: 'si',
  no: 'no',
  'no requiere analisis': 'no_requiere_analisis',
  'no requiere': 'no_requiere_analisis',
};
const SI_NO: Record<string, boolean> = { si: true, no: false };
const PRIORIDADES: Record<string, string> = { alta: 'alta', media: 'media', baja: 'baja' };
export const MATERIALES: Record<string, string> = {
  'anotaciones manuscritas': 'manuscritos',
  manuscritos: 'manuscritos',
  bancario: 'bancario',
  'facturacion / remitos': 'facturacion_remitos',
  'facturacion/remitos': 'facturacion_remitos',
  'licitaciones / expedientes': 'licitaciones_expedientes',
  'licitaciones/expedientes': 'licitaciones_expedientes',
  'documentacion varia': 'documentacion_varia',
  dispositivo: 'dispositivo',
  otro: 'otro',
};
const SIN_ESCRIBIENTE = ['no requiere escribiente', 'no requiere'];
const SIN_ASIGNAR = ['sin asignar', '-', '—'];

export const MENCION_PROCESAL = /casaci[oó]n|apelaci[oó]n|nulidad|exclusi[oó]n|recurso/i;

export function normalizarFila(
  fila: Celda[],
  numeroFila: number,
  mapeo: Mapeo,
  soporte: 'papel' | 'digital',
): ResultadoFila {
  const valor = (campo: Campo) => (mapeo[campo] === undefined ? '' : texto(fila[mapeo[campo]!]));
  const celdasMapeadas = Object.values(mapeo).map((i) => texto(fila[i!]));
  if (celdasMapeadas.every((c) => c === '')) return { tipo: 'vacia', fila: numeroFila };

  const numero = valor('numero').replace(/\.0$/, '');
  if (!numero) {
    return { tipo: 'sin_numero', fila: numeroFila, contenido: celdasMapeadas.filter(Boolean).join(' · ') };
  }

  const errores: string[] = [];
  const avisos: string[] = [];
  const datos: FilaEfecto = { fila: numeroFila, numero, soporte };
  if (soporte === 'digital') datos.tipo_material = 'dispositivo';

  const copiar = (campo: Campo, destino: keyof FilaEfecto = campo as keyof FilaEfecto) => {
    const v = valor(campo);
    if (v) (datos as Record<string, unknown>)[destino] = v;
  };
  copiar('numero_interno');
  copiar('sobre');
  copiar('descripcion_acta');
  copiar('observaciones');
  copiar('propietario');
  copiar('tenedor');
  copiar('patron_contrasena');
  copiar('resolucion_autorizante');
  copiar('observaciones_gabinete');
  copiar('ubicacion_fisica');
  copiar('link_escaneo');
  copiar('lugar_secuestro');

  const responsable = valor('responsable');
  if (responsable) {
    const n = normalizar(responsable);
    if (SIN_ESCRIBIENTE.includes(n)) datos.requiere_escribiente = false;
    else if (!SIN_ASIGNAR.includes(n)) datos.responsable_alias = responsable.toUpperCase();
  }

  const estado = valor('estado');
  if (estado) {
    const e = ESTADOS[normalizar(estado)];
    if (e) datos.estado = e;
    else errores.push(`Estado «${estado}» no reconocido (se esperaba Sin iniciar, En proceso, Escaneado, Finalizado u Observado).`);
  } else if (mapeo.estado !== undefined) {
    avisos.push('Sin estado en la planilla: queda como «Sin iniciar».');
  }

  const apto = valor('apto_analisis');
  if (apto) {
    const a = APTO[normalizar(apto)];
    if (a) datos.apto_analisis = a;
    else errores.push(`«¿Apto para analizar?» dice «${apto}»: se esperaba SI, NO o NO REQUIERE ANÁLISIS.`);
  }

  const informe = valor('tiene_informe_gabinete');
  if (informe) {
    const b = SI_NO[normalizar(informe)];
    if (b !== undefined) datos.tiene_informe_gabinete = b;
    else errores.push(`«Informe del gabinete» dice «${informe}»: se esperaba SI o NO.`);
  }

  if (datos.observaciones_gabinete) {
    const m = /\binforme\s+(c\s?\d{3,6})\b/i.exec(datos.observaciones_gabinete);
    if (m) datos.informe_numero = m[1].replace(/\s/g, '').toUpperCase();
  }

  const procedimiento = valor('procedimiento');
  if (procedimiento) {
    const p = separarProcedimiento(procedimiento);
    if (p.fechaInvalida) errores.push(`La fecha del procedimiento no es válida: «${procedimiento.slice(0, 40)}».`);
    if (p.fecha) datos.procedimiento_fecha = p.fecha;
    if (p.domicilio) datos.procedimiento_domicilio = p.domicilio;
  }

  const material = valor('tipo_material');
  if (material) {
    const m = MATERIALES[normalizar(material)];
    if (m) datos.tipo_material = m;
    else errores.push(`Tipo de material «${material}» no reconocido.`);
  }

  const prioridad = valor('prioridad');
  if (prioridad) {
    const p = PRIORIDADES[normalizar(prioridad)];
    if (p) datos.prioridad = p;
    else errores.push(`Prioridad «${prioridad}» no reconocida (Alta, Media o Baja).`);
  }

  const fojas = valor('fojas_aprox');
  if (fojas) {
    const n = Number(fojas.replace(/\./g, '').replace(',', '.'));
    if (Number.isInteger(n) && n >= 0) datos.fojas_aprox = n;
    else errores.push(`Fojas «${fojas}» no es un número entero.`);
  }

  for (const campo of ['fecha_inicio', 'fecha_fin'] as const) {
    const celda = mapeo[campo] === undefined ? null : fila[mapeo[campo]!];
    if (celda instanceof Date) {
      const f = fechaISO(celda);
      if (f) datos[campo] = f;
    } else if (texto(celda)) {
      const f = fechaDeTexto(texto(celda));
      if (f) datos[campo] = f;
      else errores.push(`${campo === 'fecha_inicio' ? 'Fecha de inicio' : 'Fecha de fin'} «${texto(celda)}» no es una fecha válida.`);
    }
  }

  if (datos.link_escaneo && !/^https?:\/\//i.test(datos.link_escaneo)) {
    avisos.push('El link del escaneo no empieza con http: se guarda tal cual.');
  }

  if (errores.length) return { tipo: 'error', fila: numeroFila, numero, errores };
  return { tipo: 'ok', fila: numeroFila, datos, avisos };
}

// ---------------------------------------------------------------------
// Revisión antes de confirmar
// ---------------------------------------------------------------------
export type Revision = {
  filasOrigen: number;
  validas: FilaEfecto[];
  conErrores: Extract<ResultadoFila, { tipo: 'error' }>[];
  sinNumero: Extract<ResultadoFila, { tipo: 'sin_numero' }>[];
  repetidasEnArchivo: { numero: string; filas: number[] }[];
  yaExistentes: FilaEfecto[];
  aImportar: FilaEfecto[];
  procedimientos: number;
  informes: string[];
  aliasSinMiembro: string[];
  mencionesProcesales: FilaEfecto[];
  avisos: { fila: number; numero: string; texto: string }[];
};

export function revisar(
  filas: Celda[][],
  inicioDatos: number,
  mapeo: Mapeo,
  soporte: 'papel' | 'digital',
  numerosExistentes: Set<string>,
  aliasMiembros: Set<string>,
): Revision {
  const resultados = filas
    .slice(inicioDatos)
    .map((f, i) => normalizarFila(f, inicioDatos + i + 1, mapeo, soporte))
    .filter((r) => r.tipo !== 'vacia');

  const validas = resultados.filter((r): r is Extract<ResultadoFila, { tipo: 'ok' }> => r.tipo === 'ok').map((r) => r.datos);
  const porNumero = new Map<string, number[]>();
  for (const r of resultados) {
    const numero = r.tipo === 'ok' ? r.datos.numero : r.tipo === 'error' ? r.numero : null;
    if (numero) porNumero.set(numero, [...(porNumero.get(numero) ?? []), r.fila]);
  }
  const repetidasEnArchivo = [...porNumero.entries()].filter(([, f]) => f.length > 1).map(([numero, f]) => ({ numero, filas: f }));
  const vistos = new Set<string>();
  const aImportar: FilaEfecto[] = [];
  const yaExistentes: FilaEfecto[] = [];
  for (const v of validas) {
    if (numerosExistentes.has(v.numero)) yaExistentes.push(v);
    else if (!vistos.has(v.numero)) {
      vistos.add(v.numero);
      aImportar.push(v);
    }
  }
  const procedimientos = new Set(
    aImportar.filter((v) => v.procedimiento_fecha || v.procedimiento_domicilio).map((v) => `${v.procedimiento_fecha ?? ''}|${v.procedimiento_domicilio ?? ''}`),
  ).size;
  const informes = [...new Set(aImportar.map((v) => v.informe_numero).filter((x): x is string => Boolean(x)))];
  const aliasSinMiembro = [
    ...new Set(aImportar.map((v) => v.responsable_alias).filter((a): a is string => Boolean(a) && !aliasMiembros.has(a!.toUpperCase()))),
  ];

  return {
    filasOrigen: resultados.length,
    validas,
    conErrores: resultados.filter((r): r is Extract<ResultadoFila, { tipo: 'error' }> => r.tipo === 'error'),
    sinNumero: resultados.filter((r): r is Extract<ResultadoFila, { tipo: 'sin_numero' }> => r.tipo === 'sin_numero'),
    repetidasEnArchivo,
    yaExistentes,
    aImportar,
    procedimientos,
    informes,
    aliasSinMiembro,
    mencionesProcesales: aImportar.filter((v) => MENCION_PROCESAL.test(`${v.observaciones ?? ''} ${v.observaciones_gabinete ?? ''}`)),
    avisos: resultados.flatMap((r) => (r.tipo === 'ok' ? r.avisos.map((t) => ({ fila: r.fila, numero: r.datos.numero, texto: t })) : [])),
  };
}
