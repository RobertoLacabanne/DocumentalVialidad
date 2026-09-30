// Azar determinista: el mismo número de semilla pinta siempre lo mismo.
export function hashInt(x) {
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

/** Ruido de celda (0..1) en una retícula entera. */
export function hash2(ix, iy, s = 0) {
  return hashInt((ix * 374761393 + iy * 668265263 + s * 1274126177) | 0) / 4294967296;
}

/** Ruido de valor suave, 0..1. */
export function ruido(x, y, s = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, s);
  const b = hash2(x0 + 1, y0, s);
  const c = hash2(x0, y0 + 1, s);
  const d = hash2(x0 + 1, y0 + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Ruido de varias octavas, 0..1. */
export function fbm(x, y, s = 0, octavas = 4) {
  let total = 0;
  let amp = 0.5;
  let f = 1;
  let norma = 0;
  for (let i = 0; i < octavas; i++) {
    total += amp * ruido(x * f, y * f, s + i * 17);
    norma += amp;
    amp *= 0.5;
    f *= 2;
  }
  return total / norma;
}

/** Generador pseudoaleatorio (mulberry32) con gaussiana incluida. */
export class Azar {
  constructor(semilla = 1) {
    this.a = (hashInt(semilla | 0) ^ 0x9e3779b9) | 0;
  }
  next() {
    let t = (this.a = (this.a + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  rango(a, b) {
    return a + (b - a) * this.next();
  }
  gauss() {
    let u = 0;
    while (u === 0) u = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  }
  entero() {
    return Math.floor(this.next() * 4294967296) >>> 0;
  }
  elegir(lista) {
    return lista[Math.floor(this.next() * lista.length)];
  }
}
