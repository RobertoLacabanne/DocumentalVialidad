// Tipos de las fichas tal como vienen de la base.

import type { Precision } from './tiempo';

export type Comunes = {
  id: string;
  creado_en: string;
  creado_por: string | null;
  actualizado_en: string;
  actualizado_por: string | null;
  version: number;
  archivado_en: string | null;
  archivado_por: string | null;
};

export type Miembro = Comunes & {
  email: string;
  nombre: string | null;
  alias: string | null;
  activo: boolean;
  user_id: string | null;
  invitado_por: string | null;
  ultimo_ingreso: string | null;
};

export type Causa = Comunes & {
  legajo_fiscalia: string;
  numero_oga: string | null;
  caratula: string;
  fiscales: string | null;
  delitos: string | null;
  objeto: string | null;
  estado: 'en_tramite' | 'elevada_a_juicio' | 'en_juicio' | 'archivada' | 'concluida';
  fecha_alta: string;
  formato_cita: string;
  observaciones: string | null;
};

export type TipoPieza =
  | 'documental_secuestrada'
  | 'expediente_administrativo'
  | 'informe_pericial'
  | 'extraccion_forense'
  | 'mensaje_conversacion'
  | 'correo_electronico'
  | 'informe_organismo'
  | 'testimonial'
  | 'audiovisual'
  | 'otro';

export type Relevancia = 'alta' | 'media' | 'baja' | 'descartada';
export type SituacionProcesal = 'admisibilidad_cuestionada' | 'pendiente_resolucion' | 'excluida';
export type EstadoTrabajo = 'pendiente' | 'en_proceso' | 'revisada';

export type Pieza = Comunes & {
  causa_id: string;
  numero_orden: string | null;
  orden_clave: string | null;
  tipo: TipoPieza;
  titulo: string;
  fecha_desde: string | null;
  fecha_hasta: string | null;
  fecha_precision: Precision;
  autor: string | null;
  destinatarios: string | null;
  resumen: string | null;
  observaciones_analista: string | null;
  efecto_id: string | null;
  sobre: string | null;
  lugar_secuestro: string | null;
  fecha_secuestro: string | null;
  informe_id: string | null;
  fojas: string | null;
  conversacion_id: string | null;
  mensaje_id: string | null;
  relevancia: Relevancia | null;
  estado_trabajo: EstadoTrabajo;
  responsable: string | null;
  etiquetas: string[];
  origen: unknown;
};

export type EstadoEfecto = 'sin_iniciar' | 'en_proceso' | 'escaneado' | 'finalizado' | 'observado';

export type Efecto = Comunes & {
  causa_id: string;
  procedimiento_id: string | null;
  numero: string;
  numero_clave: string | null;
  sobre: string | null;
  numero_interno: string | null;
  soporte: 'papel' | 'digital' | null;
  tipo_material: string | null;
  descripcion_acta: string | null;
  propietario: string | null;
  tenedor: string | null;
  resolucion_autorizante: string | null;
  apto_analisis: 'si' | 'no' | 'no_requiere_analisis' | null;
  informe_id: string | null;
  tiene_informe_gabinete: boolean | null;
  observaciones_gabinete: string | null;
  ubicacion_fisica: string | null;
  responsable: string | null;
  responsable_alias: string | null;
  requiere_escribiente: boolean;
  estado: EstadoEfecto;
  prioridad: 'alta' | 'media' | 'baja' | null;
  fojas_aprox: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  link_escaneo: string | null;
  lugar_secuestro: string | null;
  patron_contrasena: string | null;
  observaciones: string | null;
  origen: { archivo?: string; hoja?: string; fila?: string } | null;
};

export type Procedimiento = Comunes & {
  causa_id: string;
  fecha: string | null;
  domicilio: string | null;
  localidad: string | null;
  lugar: string | null;
  resolucion_autorizante: string | null;
  observaciones: string | null;
};

export type EstadoProcesalEfecto = {
  efecto_id: string;
  causa_id: string;
  situacion: SituacionProcesal;
  gravedad: number;
  titulo: string;
  incidencia_id: string;
  via: 'efecto' | 'procedimiento';
};

export type IncidenciaProcesal = Comunes & {
  causa_id: string;
  titulo: string;
  tipo: 'planteo_exclusion' | 'nulidad' | 'apelacion' | 'casacion' | 'otro';
  situacion: SituacionProcesal | 'sin_efecto';
  tribunal: string | null;
  fecha_planteo: string | null;
  fecha_resolucion: string | null;
  resolucion: string | null;
  observaciones: string | null;
};

export type TipoPersona = 'fisica' | 'juridica';
export type Rol = 'imputado' | 'testigo' | 'denunciante' | 'funcionario_dpv' | 'proveedor' | 'perito' | 'otro';

export type Persona = Comunes & {
  causa_id: string;
  tipo_persona: TipoPersona;
  nombre: string;
  cargo: string | null;
  observaciones: string | null;
  origen: unknown;
};

export type Identificador = Comunes & {
  causa_id: string;
  persona_id: string | null;
  tipo: 'telefono' | 'alias_agendado' | 'cuit' | 'dni' | 'email' | 'otro';
  valor: string;
  efecto_id: string | null;
  observaciones: string | null;
};

export type RolEnCausa = Comunes & {
  causa_id: string;
  persona_id: string;
  rol: Rol;
  desde: string | null;
  hasta: string | null;
  observaciones: string | null;
};

export type Informe = Comunes & {
  causa_id: string;
  numero: string;
  tipo: string;
};

export type EstadoProcesalPieza = {
  pieza_id: string;
  situacion: SituacionProcesal;
  gravedad: number;
  titulo: string;
  incidencia_id: string;
  via: 'pieza' | 'efecto' | 'procedimiento' | 'informe';
};

export type EventoHistorial = {
  id: number;
  ocurrido_en: string;
  causa_id: string | null;
  tabla: string;
  registro_id: string;
  accion: 'alta' | 'edicion' | 'archivo' | 'restauracion';
  usuario_id: string | null;
  usuario_email: string | null;
  cambios: Record<string, { antes: unknown; despues: unknown }>;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
};

export type ResultadoGuardado<T> = { ok: boolean; fila: T };
