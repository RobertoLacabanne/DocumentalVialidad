import { describe, expect, it } from 'vitest';
import { claveNombre, esNombreVacio, mencionaA, nombrePropuesto, tipoSugerido } from './nombres';

describe('nombres', () => {
  it('compara sin tildes, mayúsculas ni la marca PJ/PH', () => {
    expect(claveNombre('Pérez, Juan Ramón (PH)')).toBe('perez juan ramon');
    expect(claveNombre('VIALIDAD S.R.L. (P.J.)')).toBe('vialidad s r l');
  });

  it('propone el nombre sin la marca y respeta el resto', () => {
    expect(nombrePropuesto('  Premoldeados del Litoral SRL (PJ) ')).toBe('Premoldeados del Litoral SRL');
  });

  it('sugiere el tipo por la marca y, si no hay, por la razón social', () => {
    expect(tipoSugerido('Gómez Ana (PJ)')).toBe('juridica');
    expect(tipoSugerido('Constructora SA (PH)')).toBe('fisica');
    expect(tipoSugerido('Repuestos Norte SRL')).toBe('juridica');
    expect(tipoSugerido('Ana Gómez')).toBe('fisica');
  });

  it('detecta la mención por palabras completas, no por pedazos', () => {
    const clave = claveNombre('Ana Gómez');
    expect(mencionaA('ANA GOMEZ (PH)', clave)).toBe(true);
    expect(mencionaA('Tenedora: Ana Gómez y otro', clave)).toBe(true);
    expect(mencionaA('Susana Gómez', clave)).toBe(false);
  });

  it('descarta valores que no son nombres', () => {
    expect(esNombreVacio('-')).toBe(true);
    expect(esNombreVacio('S/D')).toBe(true);
    expect(esNombreVacio('No consta')).toBe(true);
    expect(esNombreVacio('Ana Gómez')).toBe(false);
  });
});
