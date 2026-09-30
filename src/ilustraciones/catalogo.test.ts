import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ILUSTRACIONES } from './catalogo';

const CARPETA = join(process.cwd(), 'public', 'ilustraciones');
const peso = (archivo: string) => statSync(join(CARPETA, archivo)).size;

describe('catálogo de ilustraciones', () => {
  const entradas = Object.entries(ILUSTRACIONES);

  it('cada pieza tiene su archivo a 1x y a 2x, con la versión en el nombre', () => {
    for (const [id, d] of entradas) {
      expect(d.archivo, id).toMatch(/-v\d+$/);
      expect(existsSync(join(CARPETA, `${d.archivo}.webp`)), `${id} a 1x`).toBe(true);
      expect(existsSync(join(CARPETA, `${d.archivo}@2x.webp`)), `${id} a 2x`).toBe(true);
    }
  });

  it('no quedan archivos horneados sin catalogar (versiones viejas o piezas sueltas)', () => {
    const esperados = new Set(entradas.flatMap(([, d]) => [`${d.archivo}.webp`, `${d.archivo}@2x.webp`]));
    const sobrantes = readdirSync(CARPETA).filter((f) => f.endsWith('.webp') && !esperados.has(f));
    expect(sobrantes).toEqual([]);
  });

  it('respeta el presupuesto de peso: panorama hasta 300 KB, el resto hasta 60 KB y la serie bajo 1 MB a 1x', () => {
    let total = 0;
    for (const [id, d] of entradas) {
      const bytes = peso(`${d.archivo}.webp`);
      total += bytes;
      expect(bytes, id).toBeLessThanOrEqual(id === 'bajada' ? 300_000 : 60_000);
    }
    expect(total).toBeLessThan(1_000_000);
  });

  it('las dos capas del panorama tienen las mismas proporciones, para que encimen exacto', () => {
    expect(ILUSTRACIONES['hilo-bajada'].ancho).toBe(ILUSTRACIONES.bajada.ancho);
    expect(ILUSTRACIONES['hilo-bajada'].alto).toBe(ILUSTRACIONES.bajada.alto);
  });
});
