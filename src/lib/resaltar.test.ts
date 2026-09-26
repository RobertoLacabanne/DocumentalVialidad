import { describe, expect, it } from 'vitest';
import { contiene, tramosResaltados } from './resaltar';

describe('resaltar', () => {
  it('marca el término sin distinguir tildes y respeta el texto original', () => {
    expect(tramosResaltados('La LICITACIÓN y la licitacion', 'licitación')).toEqual([
      { texto: 'La ', marcado: false },
      { texto: 'LICITACIÓN', marcado: true },
      { texto: ' y la ', marcado: false },
      { texto: 'licitacion', marcado: true },
    ]);
    expect(tramosResaltados('sin coincidencias', 'xyz')).toEqual([{ texto: 'sin coincidencias', marcado: false }]);
    expect(contiene('Cotización de módulos', 'cotizacion')).toBe(true);
  });
});
