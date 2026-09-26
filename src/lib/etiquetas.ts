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
  estado: 'Estado',
  numero: 'Nº de efecto',
  numero_interno: 'Nº interno',
  soporte: 'Soporte',
  tipo_material: 'Tipo de material',
  descripcion_acta: 'Descripción según el acta',
  propietario: 'Propietario',
  tenedor: 'Tenedor',
  resolucion_autorizante: 'Autorización',
  apto_analisis: '¿Apto para analizar?',
  tiene_informe_gabinete: 'Informe del gabinete',
  observaciones_gabinete: 'Observaciones del gabinete',
  ubicacion_fisica: 'Ubicación',
  responsable_alias: 'Responsable (alias)',
  requiere_escribiente: 'Requiere escribiente',
  prioridad: 'Prioridad',
  fojas_aprox: 'Fojas aprox.',
  fecha_inicio: 'Fecha de inicio',
  fecha_fin: 'Fecha de fin',
  link_escaneo: 'Link del escaneo',
  patron_contrasena: 'Patrón / contraseña',
  observaciones: 'Observaciones',
  procedimiento_id: 'Procedimiento',
  tipo_persona: 'Tipo',
  cargo: 'Cargo',
};

export function valorLegible(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return 'vacío';
  if (campo === 'tipo') return tipoPieza(valor as TipoPieza).etiqueta;
  if (campo === 'relevancia') return RELEVANCIAS.find((r) => r.valor === valor)?.etiqueta ?? String(valor);
  if (campo === 'estado_trabajo') return ESTADOS_TRABAJO.find((e) => e.valor === valor)?.etiqueta ?? String(valor);
  if (campo === 'fecha_precision') return PRECISIONES.find((p) => p.valor === valor)?.etiqueta ?? String(valor);
  if (campo === 'estado' && typeof valor === 'string' && ESTADOS_EFECTO[valor]) return ESTADOS_EFECTO[valor];
  if (campo === 'apto_analisis' && typeof valor === 'string') return APTO_ETIQUETA[valor] ?? valor;
  if (campo === 'tipo_material' && typeof valor === 'string') return MATERIALES_ETIQUETA[valor] ?? valor;
  if (campo === 'prioridad' && typeof valor === 'string') return PRIORIDAD_ETIQUETA[valor] ?? valor;
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

// ---------------------------------------------------------------------
// Efectos
// ---------------------------------------------------------------------
export const COLUMNAS_TABLERO: { valor: 'sin_iniciar' | 'en_proceso' | 'escaneado' | 'finalizado' | 'observado'; etiqueta: string }[] = [
  { valor: 'sin_iniciar', etiqueta: 'Sin iniciar' },
  { valor: 'en_proceso', etiqueta: 'En proceso' },
  { valor: 'escaneado', etiqueta: 'Escaneado' },
  { valor: 'finalizado', etiqueta: 'Finalizado' },
  { valor: 'observado', etiqueta: 'Observado' },
];

export const MATERIALES_ETIQUETA: Record<string, string> = {
  manuscritos: 'Manuscritos',
  bancario: 'Bancario',
  facturacion_remitos: 'Facturación / remitos',
  licitaciones_expedientes: 'Licitaciones / expedientes',
  dispositivo: 'Dispositivo',
  documentacion_varia: 'Documentación varia',
  otro: 'Otro',
};

export const APTO_ETIQUETA: Record<string, string> = {
  si: 'Apto para analizar',
  no: 'No apto por ahora',
  no_requiere_analisis: 'No requiere análisis',
};

export const SOPORTE_ETIQUETA: Record<string, string> = { papel: 'Papel', digital: 'Dispositivo' };

export const PRIORIDAD_ETIQUETA: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };

export const TIPOS_INCIDENCIA: { valor: 'planteo_exclusion' | 'nulidad' | 'apelacion' | 'casacion' | 'otro'; etiqueta: string }[] = [
  { valor: 'planteo_exclusion', etiqueta: 'Planteo de exclusión' },
  { valor: 'nulidad', etiqueta: 'Nulidad' },
  { valor: 'apelacion', etiqueta: 'Apelación' },
  { valor: 'casacion', etiqueta: 'Casación' },
  { valor: 'otro', etiqueta: 'Otro' },
];

// ---------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------
export const ROLES: { valor: 'imputado' | 'testigo' | 'denunciante' | 'funcionario_dpv' | 'proveedor' | 'perito' | 'otro'; etiqueta: string }[] = [
  { valor: 'imputado', etiqueta: 'Imputado' },
  { valor: 'testigo', etiqueta: 'Testigo' },
  { valor: 'denunciante', etiqueta: 'Denunciante' },
  { valor: 'funcionario_dpv', etiqueta: 'Funcionario DPV' },
  { valor: 'proveedor', etiqueta: 'Proveedor' },
  { valor: 'perito', etiqueta: 'Perito' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export const TIPOS_IDENTIFICADOR: { valor: 'telefono' | 'alias_agendado' | 'cuit' | 'dni' | 'email' | 'otro'; etiqueta: string }[] = [
  { valor: 'telefono', etiqueta: 'Teléfono' },
  { valor: 'alias_agendado', etiqueta: 'Agendado como' },
  { valor: 'cuit', etiqueta: 'CUIT' },
  { valor: 'dni', etiqueta: 'DNI' },
  { valor: 'email', etiqueta: 'Correo' },
  { valor: 'otro', etiqueta: 'Otro' },
];

/** Sugerencia (no dato): una razón social suele traer SRL, SA, Coop., Dirección… La persona confirma. */
export function pareceEmpresa(nombre: string): boolean {
  return /\b(s\.?r\.?l|s\.?a|s\.?a\.?s|coop|cooperativa|direcci[oó]n|ministerio|municipalidad|sociedad|ltda|premoldeados|repuestos)\b/i.test(nombre);
}
