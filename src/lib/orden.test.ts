import { describe, expect, it } from 'vitest';
import { claveOrden, compararOrden, nivelOrden } from './orden';

describe('orden jerárquico', () => {
  it('ordena como el cuadro Urribarri', () => {
    const numeros = ['3', '2 ter', '10', '2.1', '2 bis', '2', '2.2', '1', '2.10'];
    expect([...numeros].sort(compararOrden)).toEqual([
      '1', '2', '2.1', '2.2', '2.10', '2 bis', '2 ter', '3', '10',
    ]);
  });

  it('deja al final las piezas sin número', () => {
    expect(['2', null, '1'].sort(compararOrden)).toEqual(['1', '2', null]);
  });

  it('genera la misma clave que la base de datos', () => {
    // Valores calculados con public.clave_orden() en Postgres.
    expect(claveOrden('2')).toBe('00000200');
    expect(claveOrden('2.1')).toBe('0000020000000100');
    expect(claveOrden('2 bis')).toBe('00000202');
    expect(claveOrden(' 19 ')).toBe('00001900');
    expect(claveOrden('')).toBeNull();
  });

  it('calcula la sangría de la sub-numeración', () => {
    expect(nivelOrden('2')).toBe(0);
    expect(nivelOrden('2.1')).toBe(1);
    expect(nivelOrden('2 bis')).toBe(0);
  });
});
