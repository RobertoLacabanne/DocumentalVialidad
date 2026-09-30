// «Entre dos ríos»: dos cintas de agua celeste de distinto valor y el sol de oro entre ambas.
// Emblema discreto de la cabecera de Inicio. Baja intensidad; los cuatro bordes se disuelven.
import { Azar, fbm } from '../azar.js';
import { cinta, curva, elipse } from '../acuarela.js';

export const ANCHO = 560;
export const ALTO = 96;
const SOL = [286, 44];

const suave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function pintar(L) {
  const az = new Azar(77);
  // cinta de la izquierda: el Paraná, de más valor; baja hacia el sol
  const izq = curva([-14, 30], [90, 28], [170, 52], [246, 56], 20);
  L.mancha({
    poly: cinta(izq, 30, 12, (i) => fbm(i * 0.3, 1.4, 6, 2)),
    pigmentos: ['cerulo', 'ultramar'],
    peso: 0.3,
    capas: 26,
    rugosidad: 0.2,
    paso: 14,
    humedo: 0.4,
    borde: 0.7,
    duro: 0.6,
    flujo: 0.3,
    mezcla: { dir: [-1, 0], fuerza: 0.6, ruido: 0.6 },
    reservas: [elipse(60, 28, 14, 1.3, 8), elipse(120, 38, 18, 1.2, 8), elipse(178, 50, 12, 1.1, 8)],
    reservaSuave: 0.8,
  });
  // cinta de la derecha: el Uruguay, más clara; sube desde el sol
  const der = curva([330, 56], [400, 52], [480, 30], [574, 30], 20);
  L.mancha({
    poly: cinta(der, 12, 30, (i) => fbm(i * 0.3, 4.4, 7, 2)),
    pigmentos: ['cerulo', 'violeta'],
    peso: 0.2,
    capas: 24,
    rugosidad: 0.2,
    paso: 14,
    humedo: 0.5,
    borde: 0.6,
    duro: 0.5,
    flujo: 0.3,
    mezcla: { dir: [1, 0], fuerza: 0.6, ruido: 0.6 },
    reservas: [elipse(400, 50, 16, 1.2, 8), elipse(470, 36, 18, 1.2, 8), elipse(520, 32, 12, 1.1, 8)],
    reservaSuave: 0.8,
  });
  // un trazo de pincel seco bajo cada cinta: el agua se mueve
  for (const [x, y, l] of [
    [20, 62, 120],
    [330, 70, 150],
  ]) {
    L.mancha({
      poly: cinta(curva([x, y], [x + l * 0.3, y + 1], [x + l * 0.7, y - 1], [x + l, y], 8), 3.2, 2),
      pigmentos: ['cerulo', 'ultramar'],
      peso: 0.3,
      capas: 10,
      rugosidad: 0.25,
      paso: 10,
      borde: 0.1,
      seco: { ang: 0, cerdas: 1.4, umbral: 0.5, largo: 1.2 },
    });
  }
  // el sol, entre las dos: halo húmedo y disco de oro con el centro reservado
  L.mancha({ poly: elipse(SOL[0], SOL[1], 40, 32, 14), pigmentos: ['oro'], peso: 0.18, capas: 22, rugosidad: 0.2, humedo: 1, borde: 0, flujo: 0.15 });
  L.mancha({
    poly: elipse(SOL[0], SOL[1], 12.5, 12.5, 12),
    pigmentos: ['oro', 'ocre'],
    peso: 0.5,
    capas: 22,
    rugosidad: 0.14,
    humedo: 0.2,
    borde: 0.9,
    anchoBorde: 1.2,
    duro: 0.7,
    flujo: 0.08,
    reservas: [elipse(SOL[0] - 1.5, SOL[1] - 1, 5, 5, 8)],
    reservaSuave: 2,
  });
  L.disolver((x, y) => {
    const r = 0.8 + 0.4 * (fbm(x / 60, y / 25, 9, 3) - 0.5);
    return suave(0, 70 * r, Math.min(x, ANCHO - x)) * suave(0, 30 * r, Math.min(y, ALTO - y) + 4);
  });
}

export const salidas = [{ id: 'entre-dos-rios', version: 1, ancho: ANCHO, alto: ALTO, modo: 'papel', semilla: 21, presupuesto: 60_000, uso: 'Franja de la cabecera de Inicio: dos ríos y el sol entre ambos', pintar }];
