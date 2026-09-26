// Nombres que ve la gente para cada valor interno. Un solo lugar.

import type { EstadoTrabajo, Relevancia, SituacionProcesal, TipoPieza } from './tipos';

export type Familia = 'documental' | 'pericial' | 'mensaje' | 'contratacion' | 'persona' | 'otros';

export const TIPOS_PIEZA: { valor: TipoPieza; etiqueta: string; familia: Familia }[] = [
  { valor: 'documental_secuestrada', etiqueta: 'Documental secuestrada', familia: 'documental' },
  { valor: 'expediente_administrativo', etiqueta: 'Expediente administrativo', familia: 'documental' },
  { valor: 'informe_organismo', etiqueta: 'Informe de organismo', familia: 'documental' },
  { valor: 'informe_pericial', etiqueta: 'Informe pericial', familia: 'pericial' },
  { valor: 'extraccion_forense', etiqueta: 'Extracción forense', familia: 'pericial' },
  { valor: 'mensaje_conversacion', etiqueta: 'Mensaje o conversación', familia: 'mensaje' },
  { valor: 'correo_electronico', etiqueta: 'Correo electrónico', familia: 'mensaje' },
  { valor: 'testimonial', etiqueta: 'Testimonial', familia: 'otros' },
  { valor: 'audiovisual', etiqueta: 'Audiovisual', familia: 'otros' },
  { valor: 'otro', etiqueta: 'Otro', familia: 'otros' },
];

export function tipoPieza(valor: TipoPieza) {
  return TIPOS_PIEZA.find((t) => t.valor === valor) ?? TIPOS_PIEZA[TIPOS_PIEZA.length - 1];
}

export const RELEVANCIAS: { valor: Relevancia; etiqueta: string; barras: number }[] = [
  { valor: 'alta', etiqueta: 'Alta', barras: 3 },
  { valor: 'media', etiqueta: 'Media', barras: 2 },
  { valor: 'baja', etiqueta: 'Baja', barras: 1 },
  { valor: 'descartada', etiqueta: 'Descartada', barras: 0 },
];

export const ESTADOS_TRABAJO: { valor: EstadoTrabajo; etiqueta: string }[] = [
  { valor: 'pendiente', etiqueta: 'Pendiente' },
  { valor: 'en_proceso', etiqueta: 'En proceso' },
  { valor: 'revisada', etiqueta: 'Revisada' },
];

export const SITUACIONES: Record<SituacionProcesal, string> = {
  admisibilidad_cuestionada: 'Admisibilidad cuestionada',
  pendiente_resolucion: 'Pendiente de resolución',
  excluida: 'Excluida',
};

export const PRECISIONES = [
  { valor: 'dia', etiqueta: 'Día exacto' },
  { valor: 'mes', etiqueta: 'Mes' },
  { valor: 'anio', etiqueta: 'Año' },
  { valor: 'aproximada', etiqueta: 'Aproximada' },
  { valor: 'sin_fecha', etiqueta: 'Sin fecha' },
] as const;

export const ESTADOS_EFECTO: Record<string, string> = {
  sin_iniciar: 'Sin iniciar',
  en_proceso: 'En proceso',
  escaneado: 'Escaneado',
  finalizado: 'Finalizado',
  observado: 'Observado',
};

/** Nombre legible de cada campo, para el historial y los avisos de cambios. */
export const CAMPOS: Record<string, string> = {
  numero_orden: 'Nº de orden',
  tipo: 'Tipo',
  titulo: 'Título',
  fecha_desde: 'Fecha',
  fecha_hasta: 'Fecha hasta',
  fecha_precision: 'Precisión de la fecha',
  autor: 'Autor o remitente',
  destinatarios: 'Destinatarios',
  resumen: 'Resumen',
  observaciones_analista: 'Observaciones del analista',
  efecto_id: 'Efecto',
  sobre: 'Sobre',
  lugar_secuestro: 'Lugar de secuestro',
  fecha_secuestro: 'Fecha de secuestro',
  informe_id: 'Informe',
  fojas: 'Fojas',
  relevancia: 'Relevancia',
  estado_trabajo: 'Estado de trabajo',
  responsable: 'Responsable',
  etiquetas: 'Etiquetas',
  archivado_en: 'Archivo',
  caratula: 'Carátula',
  numero_oga: 'Nº OGA',
  fiscales: 'Fiscales',
  delitos: 'Delitos',
  objeto: 'Objeto',
  alias: 'Alias',
  nombre: 'Nombre',
  activo: 'Habilitado',
};

export function valorLegible(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return 'vacío';
  if (campo === 'tipo') return tipoPieza(valor as TipoPieza).etiqueta;
  if (campo === 'relevancia') return RELEVANCIAS.find((r) => r.valor === valor)?.etiqueta ?? String(valor);
  if (campo === 'estado_trabajo') return ESTADOS_TRABAJO.find((e) => e.valor === valor)?.etiqueta ?? String(valor);
  if (campo === 'fecha_precision') return PRECISIONES.find((p) => p.valor === valor)?.etiqueta ?? String(valor);
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no';
  if (Array.isArray(valor)) return valor.length ? valor.join(', ') : 'vacío';
  const texto = String(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [a, m, d] = texto.split('-');
    return `${d}/${m}/${a}`;
  }
  return texto.length > 80 ? `${texto.slice(0, 77)}…` : texto;
}

/** Alias corto para mostrar a una persona del equipo: "INES", o el nombre, o el correo. */
export function aliasDe(miembro: { alias: string | null; nombre: string | null; email: string } | undefined, email?: string | null) {
  if (miembro?.alias) return miembro.alias;
  if (miembro?.nombre) return miembro.nombre.split(' ')[0];
  const correo = miembro?.email ?? email ?? '';
  return correo ? correo.split('@')[0] : 'Sistema';
}

export function inicialesDe(texto: string): string {
  const limpio = texto.trim();
  if (!limpio) return '·';
  const partes = limpio.split(/\s+/);
  if (partes.length === 1) return limpio.slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

/** Color estable por persona, a partir del correo. */
export function tonoDe(email: string | null | undefined): number {
  if (!email) return 5;
  let h = 0;
  for (const c of email) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % 6) + 1;
}
