// Exportar cualquier vista filtrada a Excel (.xlsx) o CSV.
// El CSV usa punto y coma y BOM para que Excel en castellano lo abra bien.

export type Columna<T> = { titulo: string; valor: (fila: T) => string | number | null | undefined; ancho?: number };

function celdaCsv(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const t = String(v);
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function aCsv<T>(filas: T[], columnas: Columna<T>[]): string {
  const lineas = [columnas.map((c) => celdaCsv(c.titulo)).join(';')];
  for (const f of filas) lineas.push(columnas.map((c) => celdaCsv(c.valor(f))).join(';'));
  return '﻿' + lineas.join('\r\n');
}

export function descargar(contenido: Blob, nombre: string) {
  const url = URL.createObjectURL(contenido);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function descargarCsv<T>(filas: T[], columnas: Columna<T>[], nombre: string) {
  descargar(new Blob([aCsv(filas, columnas)], { type: 'text/csv;charset=utf-8' }), `${nombre}.csv`);
}

export async function descargarXlsx<T>(filas: T[], columnas: Columna<T>[], nombre: string, hoja: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const datos = [
    columnas.map((c) => ({ value: c.titulo, fontWeight: 'bold' as const, backgroundColor: '#F2F1EC' })),
    ...filas.map((f) =>
      columnas.map((c) => {
        const v = c.valor(f);
        return v === null || v === undefined || v === '' ? null : { value: v, wrap: true };
      }),
    ),
  ];
  const blob = await writeXlsxFile(datos, {
    sheet: hoja.slice(0, 31),
    columns: columnas.map((c) => ({ width: c.ancho ?? 18 })),
    stickyRowsCount: 1,
  }).toBlob();
  descargar(blob, `${nombre}.xlsx`);
}

/** Nombre de archivo con legajo y fecha: "Indice-299113-2026-09-26". */
export function nombreArchivo(base: string, legajo: string) {
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  return `${base}-${legajo}-${fecha}`;
}
