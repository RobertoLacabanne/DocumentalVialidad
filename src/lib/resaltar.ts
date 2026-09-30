// Resaltado de un término dentro de un texto, sin distinguir tildes ni mayúsculas.
// Devuelve tramos para pintar con <mark> sin tocar el texto original.

const plano = (c: string) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export type Tramo = { texto: string; marcado: boolean };

export function tramosResaltados(texto: string, termino: string): Tramo[] {
  const t = plano(termino.trim());
  if (!t) return [{ texto, marcado: false }];
  // Texto plano con un mapa de cada carácter plano a su posición en el original.
  let normal = '';
  const posicion: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const p = plano(texto[i]);
    for (let k = 0; k < p.length; k++) {
      normal += p[k];
      posicion.push(i);
    }
  }
  const tramos: Tramo[] = [];
  let desde = 0;
  for (let i = normal.indexOf(t); i >= 0; i = normal.indexOf(t, i + t.length)) {
    const ini = posicion[i];
    const fin = posicion[i + t.length - 1] + 1;
    if (ini > desde) tramos.push({ texto: texto.slice(desde, ini), marcado: false });
    tramos.push({ texto: texto.slice(ini, fin), marcado: true });
    desde = fin;
  }
  if (desde < texto.length) tramos.push({ texto: texto.slice(desde), marcado: false });
  return tramos.length ? tramos : [{ texto, marcado: false }];
}

export const contiene = (texto: string | null | undefined, termino: string) => Boolean(texto) && plano(texto!).includes(plano(termino.trim()));
