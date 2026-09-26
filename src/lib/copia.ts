// Copia completa de una causa: un .zip con todo en JSON (para restaurar) y
// una planilla CSV por tabla (para abrir en Excel). Incluye lo archivado.
import { strToU8, zipSync } from 'fflate';
import { aCsv } from './exportar';
import { supabase } from './supabase';

const TABLAS_POR_CAUSA = [
  'caratula_historial', 'procedimiento', 'informe', 'efecto', 'conversacion', 'mensaje', 'marca', 'pieza',
  'enlace', 'persona', 'identificador', 'rol_en_causa', 'contratacion', 'paso_tramite', 'oferta',
  'incidencia_procesal', 'incidencia_alcance', 'ofrecimiento_item', 'acto_procesal', 'vinculo', 'tarea',
  'sugerencia', 'importacion', 'auditoria',
] as const;

async function traerTabla(tabla: string, causaId: string) {
  const filas: Record<string, unknown>[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from(tabla).select('*').eq('causa_id', causaId).range(desde, desde + 999);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    filas.push(...(data as Record<string, unknown>[]).map((f) => {
      const { busqueda: _b, ...resto } = f;
      return resto;
    }));
    if (!data || data.length < 1000) break;
  }
  return filas;
}

export async function copiaCompleta(causaId: string, alAvanzar?: (tabla: string, i: number, total: number) => void) {
  const { data: causa, error } = await supabase.from('causa').select('*').eq('id', causaId).single();
  if (error) throw new Error(error.message);
  const { data: miembros } = await supabase.from('miembro').select('email,nombre,alias,activo');
  const datos: Record<string, Record<string, unknown>[]> = { causa: [causa as Record<string, unknown>], miembro: miembros ?? [] };
  let i = 0;
  for (const tabla of TABLAS_POR_CAUSA) {
    alAvanzar?.(tabla, ++i, TABLAS_POR_CAUSA.length);
    datos[tabla] = await traerTabla(tabla, causaId);
  }

  const archivos: Record<string, Uint8Array> = {
    'LEEME.txt': strToU8(
      `Copia completa de la causa ${(causa as { legajo_fiscalia: string }).legajo_fiscalia}\n` +
        `Generada el ${new Date().toLocaleString('es-AR')} desde el Tablero de Prueba.\n\n` +
        `causa.json tiene todas las tablas juntas: sirve para restaurar (ver MANUAL_TECNICO.md).\n` +
        `La carpeta csv tiene una planilla por tabla para abrir en Excel.\n` +
        `Incluye lo archivado y el historial completo de cambios.\n`,
    ),
    'causa.json': strToU8(JSON.stringify({ generado_en: new Date().toISOString(), datos }, null, 2)),
  };
  for (const [tabla, filas] of Object.entries(datos)) {
    if (!filas.length) continue;
    const columnas = [...new Set(filas.flatMap((f) => Object.keys(f)))];
    archivos[`csv/${tabla}.csv`] = strToU8(
      aCsv(
        filas,
        columnas.map((c) => ({
          titulo: c,
          valor: (f: Record<string, unknown>) => {
            const v = f[c];
            return v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
          },
        })),
      ),
    );
  }
  const conteo = Object.fromEntries(Object.entries(datos).map(([t, f]) => [t, f.length]));
  return { zip: new Blob([zipSync(archivos, { level: 6 }) as BlobPart], { type: 'application/zip' }), conteo };
}
