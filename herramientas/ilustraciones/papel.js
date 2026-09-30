// El papel del block: el mismo para toda la serie. El grano se define en px CSS,
// así sale igual a 1x y a 2x.
import { ruido } from './azar.js';

export const COLOR_PAPEL = [250, 249, 246]; // --color-fondo
const SEMILLA_PAPEL = 4242;

/** Campo de grano de media 0, con valores en [-1, 1]. Un valor por píxel del lienzo. */
export function campoGrano(ancho, alto, escala = 2) {
  const out = new Float32Array(ancho * alto);
  let suma = 0;
  let suma2 = 0;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const X = x / escala;
      const Y = y / escala;
      const v =
        0.42 * ruido(X * 0.11, Y * 0.11, SEMILLA_PAPEL) +
        0.36 * ruido(X * 0.29 + 31, Y * 0.29 + 17, SEMILLA_PAPEL + 1) +
        0.16 * ruido(X * 0.62, Y * 0.62 + 5, SEMILLA_PAPEL + 2) +
        0.06 * ruido(X * 1.4 + 9, Y * 1.4 + 3, SEMILLA_PAPEL + 3);
      out[y * ancho + x] = v;
      suma += v;
      suma2 += v * v;
    }
  }
  const n = out.length;
  const media = suma / n;
  const desvio = Math.sqrt(Math.max(1e-9, suma2 / n - media * media));
  for (let i = 0; i < n; i++) {
    const g = ((out[i] - media) / desvio) * 0.36;
    out[i] = g < -1 ? -1 : g > 1 ? 1 : g;
  }
  return out;
}
