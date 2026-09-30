/**
 * Catálogo de las ilustraciones de la serie «La Bajada» (acuarela del Litoral).
 * Los .webp están horneados en public/ilustraciones por `npm run ilustraciones`; el número de versión
 * del nombre cambia cada vez que se repinta una pieza, así el caché largo nunca deja una vieja pegada.
 * Para reemplazar una pieza por otra pintada a mano basta con pisar los dos archivos (1x y @2x) con el
 * mismo nombre y las mismas proporciones: acá no hay que tocar nada.
 */
export interface DatosIlustracion {
  /** Nombre del archivo, sin extensión ni «@2x». */
  archivo: string;
  ancho: number;
  alto: number;
  uso: string;
}

export const ILUSTRACIONES = {
  bajada: {
    archivo: 'bajada-v1',
    ancho: 1200,
    alto: 500,
    uso: 'Panorama de la barranca de Paraná, en el Acceso y en la portada del manual.',
  },
  'hilo-bajada': {
    archivo: 'hilo-bajada-v1',
    ancho: 1200,
    alto: 500,
    uso: 'El hilo de la bandera, en capa aparte con transparencia para tenderlo sobre el panorama.',
  },
  'entre-dos-rios': {
    archivo: 'entre-dos-rios-v1',
    ancho: 560,
    alto: 96,
    uso: 'Franja de la cabecera de Inicio: dos cintas de agua y el sol entre ambas.',
  },
  'vacio-indice': { archivo: 'vacio-indice-v1', ancho: 160, alto: 120, uso: 'Estado vacío: todavía no hay piezas en el índice.' },
  'vacio-efectos': { archivo: 'vacio-efectos-v1', ancho: 160, alto: 120, uso: 'Estado vacío: todavía no hay efectos.' },
  'vacio-documentos': { archivo: 'vacio-documentos-v1', ancho: 160, alto: 120, uso: 'Estado vacío: todavía no hay documentos leídos.' },
  'vacio-mensajes': { archivo: 'vacio-mensajes-v1', ancho: 160, alto: 120, uso: 'Estado vacío: todavía no hay conversaciones.' },
  'vacio-sugerencias': { archivo: 'vacio-sugerencias-v1', ancho: 160, alto: 120, uso: 'Estado vacío: todo al día, sin sugerencias pendientes.' },
  'vacio-busqueda': { archivo: 'vacio-busqueda-v1', ancho: 160, alto: 120, uso: 'Estado vacío: la búsqueda no encontró nada.' },
  'error-orilla': { archivo: 'error-orilla-v1', ancho: 160, alto: 120, uso: 'Pantalla de error: una orilla serena.' },
  'proximamente-orilla': { archivo: 'proximamente-orilla-v1', ancho: 160, alto: 120, uso: 'Sección que llega en una fase próxima.' },
} as const satisfies Record<string, DatosIlustracion>;

export type IdIlustracion = keyof typeof ILUSTRACIONES;
