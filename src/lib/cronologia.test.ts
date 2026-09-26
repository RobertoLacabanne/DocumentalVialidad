import { describe, expect, it } from 'vitest';
import { agruparPorMes, clavesDePersona, fechaHito, mencionaPersona } from './cronologia';

const h = (fecha: string, fecha_precision = 'dia', titulo = 'x') => ({ tipo: 'pieza', fecha, fecha_precision, fecha_texto: null, titulo, detalle: null });

describe('cronología', () => {
  it('agrupa por año y mes, en orden, y deja aparte lo que solo tiene año', () => {
    const g = agruparPorMes([h('2021-05-04'), h('2020-02-21'), h('2021-01-01', 'anio'), h('2021-05-01', 'mes'), h('2021-04-16')]);
    expect(g.map((x) => [x.titulo, x.hitos.length])).toEqual([
      ['febrero 2020', 1],
      ['2021 (sin mes)', 1],
      ['abril 2021', 1],
      ['mayo 2021', 2],
    ]);
  });

  it('muestra la fecha con la precisión que tiene, sin inventar el día', () => {
    expect(fechaHito(h('2021-04-16'))).toEqual({ dia: '16 abr', aproximada: false });
    expect(fechaHito(h('2020-02-01', 'mes'))).toEqual({ dia: 'febrero', aproximada: false });
    expect(fechaHito(h('2020-03-11', 'aproximada'))).toEqual({ dia: '11 mar', aproximada: true });
  });

  it('encuentra a una persona por su nombre, su apellido o cómo figura agendada', () => {
    const claves = clavesDePersona({ nombre: 'Julián Pérez Prueba', tipo_persona: 'fisica', alias: ['Juli DPV'] });
    expect(claves).toEqual(['julian perez prueba', 'prueba', 'juli dpv']);
    expect(mencionaPersona('Prueba → Otro', claves)).toBe(true);
    expect(mencionaPersona('Mensaje de Juli DPV', claves)).toBe(true);
    expect(mencionaPersona('Pruebas de otra cosa', claves)).toBe(false);
    expect(clavesDePersona({ nombre: 'Proveedora Ejemplo SRL', tipo_persona: 'juridica' })).toEqual(['proveedora ejemplo', 'proveedora']);
  });
});
