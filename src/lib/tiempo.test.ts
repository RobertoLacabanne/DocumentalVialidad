import { describe, expect, it } from 'vitest';
import { fechaConPrecision, fechaCorta, haceCuanto } from './tiempo';

describe('fechas', () => {
  const ahora = new Date('2026-09-26T15:00:00');

  it('dice hace cuánto pasó algo', () => {
    expect(haceCuanto(new Date('2026-09-26T14:59:58'), ahora)).toBe('recién');
    expect(haceCuanto(new Date('2026-09-26T14:59:30'), ahora)).toBe('hace 30 s');
    expect(haceCuanto(new Date('2026-09-26T14:56:00'), ahora)).toBe('hace 4 min');
    expect(haceCuanto(new Date('2026-09-25T10:05:00'), ahora)).toBe('ayer, 10:05');
    expect(haceCuanto(new Date('2025-10-28T10:00:00'), ahora)).toBe('28 oct 2025');
  });

  it('formatea sin correrse de día por la zona horaria', () => {
    expect(fechaCorta('2025-10-28')).toBe('28/10/2025');
  });

  it('respeta la precisión de la fecha', () => {
    expect(fechaConPrecision('2021-03-01', 'mes')).toBe('marzo de 2021');
    expect(fechaConPrecision('2021-01-01', 'anio')).toBe('2021');
    expect(fechaConPrecision('2021-03-15', 'dia')).toBe('15/03/2021');
    expect(fechaConPrecision('2021-03-15', 'sin_fecha')).toBe('');
  });
});
