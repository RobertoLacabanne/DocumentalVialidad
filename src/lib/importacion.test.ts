import { describe, expect, it } from 'vitest';
import { autoMapear, detectarEncabezado, fechaDeTexto, normalizarFila, revisar, separarProcedimiento, type Celda } from './importacion';

// Planillas de prueba con la misma estructura que las reales (títulos, filas en
// blanco, dos columnas "Observaciones", fila sin número), pero con datos inventados.
const LISTADO: Celda[][] = [
  [null, 'EFECTOS', null, 'LEG N° 000000', null],
  [null, 'N° de Efecto', 'Descripción', 'RESPONSABLE', 'ESTADO', 'APTO PARA ANALIZAR? ', 'OBSERVACIONES', 'Fecha de procedimiento y domicilio', 'Propietario (PJ/PH)', 'Tenedor', 'Patrón/Contraseña', 'Autorización para ingreso', 'Informe del gabinete', 'Observaciones', 'Ubicación actual'],
  [1, 90001, '(01) CPU de prueba', 'AGUS', 'SIN INICIAR', 'SI', 'Esperando informe', '28/10/2025 Domicilio de prueba N° 1 (Organismo)', 'Organismo de prueba', 'Tenedor de prueba', 'SI', 'Res. de prueba 23/10/2025', 'NO', null, 'Oficina Efectos'],
  [2, 90002, '(01) teléfono de prueba', 'NO REQUIERE ESCRIBIENTE', 'SIN INICIAR', 'NO', 'Esperando resolución de casación', '28/10/2025 Domicilio de prueba N° 1 (Organismo)', 'Persona de prueba', 'Persona de prueba', 'Se desconoce', 'Res. de prueba 23/10/2025', 'SI', 'Informe C9999', 'Gabinete'],
  [3, 90003, 'una unidad SSD de prueba', 'NO REQUIERE ESCRIBIENTE', 'SIN INICIAR', 'NO REQUIERE ANALISIS', 'Son imágenes', null, null, null, 'NO', 'revisar', 'NO', null, 'Fiscalía'],
  [4, 90004, '(01) teléfono de prueba 2', 'ROBER', 'FINALIZADO', 'SI', 'En apelación, todavía no', '10/08/26. Vivienda de prueba 123.', null, null, null, null, 'SI', null, 'Gabinete'],
];

const DISTRIBUCION: Celda[][] = [
  [],
  [],
  [],
  ['DISTRIBUCION DE DOC PAPEL'],
  [],
  ['NUMERO DE EFECTO', 'Nº INTERNO', 'DESCRIPCION', 'RESPONSABLE', 'LINK DEL ESCANEO', 'ORIGEN', 'ESTADO', 'OBSERVACIONES'],
  [90101, 1, 'Documentación de prueba', 'AGUS', null, null, 'SIN INICIAR', null],
  [null, null, null, 'AGUS', null, null, null, null],
  [90102, 2, 'Carpeta de prueba', 'CARLI ', 'https://drive.google.com/drive/folders/abc', 'LUGAR DE PRUEBA', 'FINALIZADO', 'Observación de prueba'],
  [90101, 3, 'Documentación repetida', 'INES', null, null, 'SIN INICIAR', null],
  [90103, 4, 'Cuadernillo de prueba', 'INES', null, null, 'A MEDIAS', null],
];

describe('encabezado y mapeo', () => {
  it('encuentra la fila de títulos aunque haya títulos y filas en blanco arriba', () => {
    expect(detectarEncabezado(LISTADO)).toBe(1);
    expect(detectarEncabezado(DISTRIBUCION)).toBe(5);
  });

  it('mapea las columnas de LISTADO EFECTOS, incluidas las dos "Observaciones"', () => {
    const m = autoMapear(LISTADO[1]);
    expect(m).toMatchObject({
      numero: 1,
      descripcion_acta: 2,
      responsable: 3,
      estado: 4,
      apto_analisis: 5,
      observaciones: 6,
      procedimiento: 7,
      propietario: 8,
      tenedor: 9,
      patron_contrasena: 10,
      resolucion_autorizante: 11,
      tiene_informe_gabinete: 12,
      observaciones_gabinete: 13,
      ubicacion_fisica: 14,
    });
  });

  it('mapea las columnas de DISTRIBUCIÓN DE TAREAS', () => {
    expect(autoMapear(DISTRIBUCION[5])).toMatchObject({
      numero: 0,
      numero_interno: 1,
      descripcion_acta: 2,
      responsable: 3,
      link_escaneo: 4,
      lugar_secuestro: 5,
      estado: 6,
      observaciones: 7,
    });
  });
});

describe('fechas y procedimientos', () => {
  it('lee fechas con año de 4 o de 2 cifras y rechaza fechas imposibles', () => {
    expect(fechaDeTexto('28/10/2025')).toBe('2025-10-28');
    expect(fechaDeTexto('10/08/26')).toBe('2026-08-10');
    expect(fechaDeTexto('31/02/2025')).toBeNull();
  });

  it('separa la fecha del domicilio del procedimiento', () => {
    expect(separarProcedimiento('28/10/2025 Avenida de prueba N° 2197 (Organismo)')).toEqual({
      fecha: '2025-10-28',
      domicilio: 'Avenida de prueba N° 2197 (Organismo)',
      fechaInvalida: false,
    });
    expect(separarProcedimiento('10/08/26. Vivienda ubicada en calle de prueba No 1.')).toEqual({
      fecha: '2026-08-10',
      domicilio: 'Vivienda ubicada en calle de prueba No 1',
      fechaInvalida: false,
    });
    expect(separarProcedimiento('Domicilio sin fecha')).toEqual({ fecha: null, domicilio: 'Domicilio sin fecha', fechaInvalida: false });
    expect(separarProcedimiento('32/13/2025 algo').fechaInvalida).toBe(true);
  });
});

describe('conversión de cada fila', () => {
  const mapeo = autoMapear(LISTADO[1]);

  it('transcribe los valores y traduce los estados de la planilla', () => {
    const r = normalizarFila(LISTADO[2], 3, mapeo, 'digital');
    expect(r.tipo).toBe('ok');
    if (r.tipo !== 'ok') return;
    expect(r.datos).toMatchObject({
      numero: '90001',
      soporte: 'digital',
      tipo_material: 'dispositivo',
      descripcion_acta: '(01) CPU de prueba',
      responsable_alias: 'AGUS',
      estado: 'sin_iniciar',
      apto_analisis: 'si',
      procedimiento_fecha: '2025-10-28',
      procedimiento_domicilio: 'Domicilio de prueba N° 1 (Organismo)',
      patron_contrasena: 'SI',
      tiene_informe_gabinete: false,
      ubicacion_fisica: 'Oficina Efectos',
    });
  });

  it('respeta "no requiere escribiente", "no requiere análisis" y detecta el informe del gabinete', () => {
    const r = normalizarFila(LISTADO[3], 4, mapeo, 'digital');
    if (r.tipo !== 'ok') throw new Error('esperaba ok');
    expect(r.datos.requiere_escribiente).toBe(false);
    expect(r.datos.responsable_alias).toBeUndefined();
    expect(r.datos.informe_numero).toBe('C9999');
    expect(r.datos.patron_contrasena).toBe('Se desconoce');
    const r2 = normalizarFila(LISTADO[4], 5, mapeo, 'digital');
    if (r2.tipo !== 'ok') throw new Error('esperaba ok');
    expect(r2.datos.apto_analisis).toBe('no_requiere_analisis');
  });

  it('frena la fila si un valor no se reconoce, en lugar de reemplazarlo', () => {
    const m = autoMapear(DISTRIBUCION[5]);
    const r = normalizarFila(DISTRIBUCION[10], 11, m, 'papel');
    expect(r.tipo).toBe('error');
    if (r.tipo === 'error') expect(r.errores[0]).toContain('A MEDIAS');
  });
});

describe('revisión antes de confirmar', () => {
  it('cuenta todo lo que va a pasar con DISTRIBUCIÓN DE TAREAS', () => {
    const r = revisar(DISTRIBUCION, 6, autoMapear(DISTRIBUCION[5]), 'papel', new Set(), new Set(['AGUS']));
    expect(r.filasOrigen).toBe(5);
    expect(r.sinNumero).toHaveLength(1);
    expect(r.sinNumero[0].contenido).toBe('AGUS');
    expect(r.repetidasEnArchivo).toEqual([{ numero: '90101', filas: [7, 10] }]);
    expect(r.conErrores).toHaveLength(1);
    expect(r.aImportar.map((f) => f.numero)).toEqual(['90101', '90102']);
    expect(r.aImportar[1]).toMatchObject({ responsable_alias: 'CARLI', lugar_secuestro: 'LUGAR DE PRUEBA', soporte: 'papel' });
    expect(r.aliasSinMiembro).toEqual(['CARLI']);
  });

  it('marca los efectos que ya existen y las menciones procesales en LISTADO EFECTOS', () => {
    const r = revisar(LISTADO, 2, autoMapear(LISTADO[1]), 'digital', new Set(['90003']), new Set(['AGUS', 'ROBER']));
    expect(r.filasOrigen).toBe(4);
    expect(r.yaExistentes.map((f) => f.numero)).toEqual(['90003']);
    expect(r.aImportar).toHaveLength(3);
    expect(r.procedimientos).toBe(2);
    expect(r.informes).toEqual(['C9999']);
    expect(r.mencionesProcesales.map((f) => f.numero)).toEqual(['90002', '90004']);
    expect(r.aliasSinMiembro).toEqual([]);
  });
});
