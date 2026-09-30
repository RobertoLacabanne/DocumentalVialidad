import { describe, expect, it } from 'vitest';
import { diferenciaPorcentual, fechaDelTramite, leerHojaContratacion, montoDeTexto, montoEditable, montosEnTexto } from './contrataciones';
import type { Celda } from './importacion';

// Hoja sintética con la misma forma que EXPEDIENTES DE CONTRATACIÓN (datos inventados).
const hoja: Celda[][] = [
  ['LICITACIÓN 99/2020', null, null, null, null],
  ['Nro de expediente', null, 999999, null, null],
  ['fecha de inicio ', null, '26/2/2020', null, null],
  ['PROCEDIMIENTO', 'Fs.', 'FECHA ', 'FIRMANTE', 'OBSERVACIONES'],
  ['Pedido de compra de prueba', 1, '21/2/2020', 'Firmante Uno (Director)', null],
  ['Informe de prueba', 20, 'febrero 2020', 'Firmante Dos', 'Informa que hay partida'],
  ['Pase de prueba', '21 vta', 'entre el 11 y 17/3/2020', 'Tec. Prueba', null],
  ['Presupuesto de la contratación', '34-37', '11/05/2020', 'Ing. Prueba', '$16.163.917,90 (adjunta listado)'],
  [null, null, null, null, 'https://drive.google.com/file/d/presupuesto'],
  ['Informe de viabilidad', 68, '22/5/2020', 'Cr. Prueba', 'reserva preventiva del gasto por la suma de $16.163.917,90.'],
  ['Oferta Oferente Uno', '94-134', null, null, 'Oferta economica  $18.415.263'],
  [null, null, null, null, 'https://drive.google.com/file/d/oferta1'],
  ['Oferta Empresa Dos (Persona Dos)', '136-194', null, null, 'oferta econ $17.951.672,50.'],
  [null, null, null, null, 'https://drive.google.com/file/d/oferta2'],
  [null, null, null, null, null],
];

describe('contrataciones', () => {
  it('lee expediente, fecha de inicio y tipo desde el encabezado de la hoja', () => {
    const c = leerHojaContratacion('LP 99/2020', hoja)!;
    expect(c.identificador).toBe('LP 99/2020');
    expect(c.expediente).toBe('999999');
    expect(c.fecha_inicio).toBe('2020-02-26');
    expect(c.tipo_procedimiento).toBe('Licitación');
  });

  it('une las filas combinadas al paso de arriba y no pierde el link', () => {
    const c = leerHojaContratacion('LP 99/2020', hoja)!;
    expect(c.pasos).toHaveLength(7);
    const presupuesto = c.pasos.find((p) => p.descripcion.startsWith('Presupuesto'))!;
    expect(presupuesto.link).toBe('https://drive.google.com/file/d/presupuesto');
    expect(presupuesto.observaciones).toBe('$16.163.917,90 (adjunta listado)');
    expect(c.filasOrigen).toBe(10);
  });

  it('guarda las fechas ambiguas tal cual y solo completa las inequívocas', () => {
    const c = leerHojaContratacion('LP 99/2020', hoja)!;
    expect(c.pasos[1]).toMatchObject({ fecha: '2020-02-01', fecha_precision: 'mes', fecha_texto: 'febrero 2020' });
    expect(c.pasos[2]).toMatchObject({ fecha: undefined, fecha_precision: 'aproximada', fecha_texto: 'entre el 11 y 17/3/2020' });
    expect(fechaDelTramite('30/2/2020').precision).toBe('aproximada');
  });

  it('arma el cuadro de ofertas y propone los montos como sugerencia', () => {
    const c = leerHojaContratacion('LP 99/2020', hoja)!;
    expect(c.ofertas.map((o) => [o.oferente_texto, o.monto_sugerido, o.fojas])).toEqual([
      ['Oferente Uno', 18415263, '94-134'],
      ['Empresa Dos (Persona Dos)', 17951672.5, '136-194'],
    ]);
    expect(c.sugerencias).toEqual([
      { campo: 'presupuesto_oficial', monto: 16163917.9, fuente: 'Presupuesto de la contratación', fila: 8 },
      { campo: 'reserva_presupuestaria', monto: 16163917.9, fuente: 'Informe de viabilidad', fila: 10 },
    ]);
  });

  it('interpreta montos con puntos de miles y coma decimal', () => {
    expect(montosEnTexto('por $ 350.000 y $1.100,5')).toEqual([350000, 1100.5]);
  });

  it('repone la barra que Excel no deja poner en el nombre de la hoja, y lo avisa', () => {
    const c = leerHojaContratacion('LP 99_2020', hoja)!;
    expect(c.identificador).toBe('LP 99/2020');
    expect(c.avisos[0]).toMatch(/Excel no admite/);
  });

  it('descarta hojas que no tienen la tabla del trámite', () => {
    expect(leerHojaContratacion('Otra', [['Nada'], ['que ver']])).toBeNull();
  });
});

describe('montos', () => {
  it('lee montos escritos como en los expedientes y rechaza lo ambiguo', () => {
    expect(montoDeTexto('18.415.263,50')).toBe(18415263.5);
    expect(montoDeTexto('$ 1.100')).toBe(1100);
    expect(montoDeTexto('350000')).toBe(350000);
    expect(montoDeTexto('')).toBeNull();
    expect(montoDeTexto('1.100.5')).toBeUndefined();
    expect(montoDeTexto('diez mil')).toBeUndefined();
    expect(montoEditable(16163917.9)).toBe('16.163.917,90');
    expect(diferenciaPorcentual(110, 100)).toBeCloseTo(10);
    expect(diferenciaPorcentual(110, null)).toBeNull();
  });
});
