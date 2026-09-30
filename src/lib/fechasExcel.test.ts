import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import readXlsxFile from 'read-excel-file/node';
import writeXlsxFile from 'write-excel-file/node';
import { describe, expect, it } from 'vitest';
import { leerHojaContratacion } from './contrataciones';
import { conFechasSinDia, fechasSinDia, precisionDelFormato } from './fechasExcel';
import type { Celda } from './importacion';

describe('fechas de Excel sin día', () => {
  it('reconoce los formatos que no muestran el día', () => {
    expect(precisionDelFormato('mmmm yyyy')).toBe('mes');
    expect(precisionDelFormato('mmm-yy')).toBe('mes');
    expect(precisionDelFormato('[$-es-AR]mmmm" de "yyyy')).toBe('mes');
    expect(precisionDelFormato('"día" mmmm yyyy')).toBe('mes');
    expect(precisionDelFormato('yyyy')).toBe('anio');
    expect(precisionDelFormato('d/m/yyyy')).toBeNull();
    expect(precisionDelFormato('dd/mm/yyyy hh:mm')).toBeNull();
    expect(precisionDelFormato('0.00')).toBeNull();
    expect(precisionDelFormato('mm:ss')).toBeNull();
  });

  it('con la planilla bajada de Google Sheets: «febrero 2020» sigue siendo un mes y la «/» vuelve al nombre', async () => {
    // Planilla sintética con la forma de EXPEDIENTES DE CONTRATACIÓN (datos inventados).
    const fecha = (a: number, m: number, d: number, format: string) => ({ type: Date, value: new Date(Date.UTC(a, m - 1, d)), format });
    const t = (value: string) => ({ type: String, value });
    const filas = [
      [t('LICITACIÓN 99/2020'), null, null, null],
      [t('Nro de expediente'), null, t('999999'), null],
      [t('fecha de inicio'), null, fecha(2020, 2, 26, 'd/m/yyyy'), null],
      [t('PROCEDIMIENTO'), t('Fs.'), t('FECHA'), t('FIRMANTE')],
      [t('Pedido de prueba'), t('1'), fecha(2020, 2, 21, 'd/m/yyyy'), t('Firmante Uno')],
      [t('Informe de prueba'), t('20'), fecha(2020, 2, 1, 'mmmm yyyy'), t('Firmante Dos')],
      [t('Dictamen de prueba'), t('75'), fecha(2020, 1, 1, 'yyyy'), t('Firmante Tres')],
    ];
    const ruta = join(mkdtempSync(join(tmpdir(), 'fechas-')), 'prueba.xlsx');
    await writeXlsxFile(filas as never, { sheet: 'LP 992020' }).toFile(ruta);
    const bytes = new Uint8Array(readFileSync(ruta));

    const sinDia = fechasSinDia(bytes);
    expect([...(sinDia.get('LP 992020') ?? new Map()).entries()]).toEqual([
      ['5,2', 'mes'],
      ['6,2', 'anio'],
    ]);

    const [hoja] = await readXlsxFile(Buffer.from(bytes));
    const c = leerHojaContratacion(hoja.sheet, conFechasSinDia(hoja.data as unknown as Celda[][], sinDia.get(hoja.sheet)))!;
    expect(c.identificador).toBe('LP 99/2020');
    expect(c.avisos[0]).toMatch(/se pierde la «\/»/);
    expect(c.fecha_inicio).toBe('2020-02-26');
    expect(c.pasos.map((p) => [p.fecha, p.fecha_precision, p.fecha_texto])).toEqual([
      ['2020-02-21', 'dia', '21/2/2020'],
      ['2020-02-01', 'mes', 'febrero 2020'],
      ['2020-01-01', 'anio', '2020'],
    ]);
  });

  it('no toca nada si el archivo no es un Excel o no tiene fechas así', () => {
    expect(fechasSinDia(new Uint8Array([1, 2, 3])).size).toBe(0);
    const filas: Celda[][] = [[new Date(Date.UTC(2020, 1, 1)), 'texto']];
    expect(conFechasSinDia(filas, undefined)).toBe(filas);
  });
});
