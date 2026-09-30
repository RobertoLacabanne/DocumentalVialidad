// Viñetas de 160×120 para estados vacíos, error y «Próximamente».
// Lenguaje común: un objeto del trabajo de la fiscalía pintado en acuarela, más un detalle vegetal del
// Litoral (espinillo, camalote, junco, follaje de ceibo). Nunca rojo: si hay hilo, es de tinta azul.
import { Azar, fbm, ruido } from '../azar.js';
import { cinta, curva, elipse, rect } from '../acuarela.js';

export const ANCHO = 160;
export const ALTO = 120;

const suave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Los bordes de la viñeta se disuelven como un lavado, sin marco. */
function disolverViñeta(L, semilla) {
  L.disolver((x, y) => {
    const dx = Math.abs(x - ANCHO / 2) / (ANCHO / 2);
    const dy = Math.abs(y - ALTO / 2) / (ALTO / 2);
    const d = Math.pow(dx, 3) + Math.pow(dy, 3);
    const r = 0.06 * (fbm(x / 22, y / 22, semilla, 3) - 0.5) * 2;
    return 1 - suave(0.62 + r, 1.02 + r, d);
  });
}

// ------------------------------------------------------------------ piezas sueltas
const hilo = (L, pts, ancho = 1.5) =>
  L.mancha({
    poly: cinta(pts, ancho, ancho * 0.85, (i) => ruido(i * 0.5, 3, 1)),
    pigmentos: ['ultramar', 'tinta'],
    peso: 0.7,
    capas: 12,
    rugosidad: 0.2,
    paso: 3,
    borde: 0.6,
    anchoBorde: 0.6,
    duro: 0.7,
    granulacion: 0.4,
  });

const rama = (L, pts, ancho = 1.6) =>
  L.mancha({
    poly: cinta(pts, ancho, ancho * 0.5),
    pigmentos: ['sienaTostada', 'siena'],
    peso: 0.7,
    capas: 12,
    rugosidad: 0.2,
    paso: 3,
    borde: 0.6,
    anchoBorde: 0.6,
    duro: 0.7,
    granulacion: 0.5,
  });

const hoja = (L, cx, cy, rx, ry, rot, pig = ['savia', 'oliva'], peso = 0.5) =>
  L.mancha({
    poly: elipse(cx, cy, rx, ry, 9, rot),
    pigmentos: pig,
    peso,
    capas: 12,
    rugosidad: 0.22,
    paso: 4,
    borde: 0.9,
    anchoBorde: 0.9,
    duro: 0.7,
    granulacion: 0.5,
    mezcla: { dir: [0, 1], fuerza: 0.8, ruido: 0.4 },
  });

/** Rama de espinillo: tallo fino con hojitas y las flores redondas, de oro. */
function espinillo(L, az, p0, p1) {
  const tallo = curva(p0, [p0[0] + (p1[0] - p0[0]) * 0.1, p0[1] + (p1[1] - p0[1]) * 0.5], [p1[0] - (p1[0] - p0[0]) * 0.1, p1[1] + (p0[1] - p1[1]) * 0.25], p1, 10);
  rama(L, tallo, 1.5);
  tallo.forEach(([x, y], i) => {
    if (i % 2 === 1) hoja(L, x + (i % 4 === 1 ? -4 : 4), y - 1, 3.6, 1.2, i % 4 === 1 ? -0.5 : 0.5, ['savia', 'oliva'], 0.5);
  });
  for (let k = 0; k < 6; k++) {
    const t = az.rango(0.55, 1);
    const [x, y] = tallo[Math.min(10, Math.round(t * 10))];
    L.mancha({
      poly: elipse(x + az.rango(-5, 5), y + az.rango(-5, 2), az.rango(2.2, 3.4), az.rango(2, 3), 8),
      pigmentos: ['oro', 'ocre'],
      peso: az.rango(0.55, 0.8),
      capas: 10,
      rugosidad: 0.35,
      paso: 3,
      borde: 0.9,
      anchoBorde: 0.8,
      duro: 0.6,
      granulacion: 0.3,
    });
  }
}

/** Junco: varillas altas, algo curvas, con la espiga. */
function juncos(L, az, x, y, n, alto) {
  for (let k = 0; k < n; k++) {
    const bx = x + (k - n / 2) * az.rango(3, 6);
    const h = alto * az.rango(0.6, 1);
    const flecha = az.rango(-9, 9);
    const tallo = curva([bx, y], [bx + flecha * 0.2, y - h * 0.4], [bx + flecha * 0.8, y - h * 0.8], [bx + flecha, y - h], 9);
    L.mancha({
      poly: cinta(tallo, 1.8, 0.7),
      pigmentos: k % 2 ? ['oliva', 'verdeHondo'] : ['savia', 'oliva'],
      peso: 0.6,
      capas: 12,
      rugosidad: 0.18,
      paso: 3,
      borde: 0.6,
      anchoBorde: 0.6,
      duro: 0.7,
      granulacion: 0.4,
    });
    if (k % 2 === 0) hoja(L, bx + flecha, y - h - 2.5, 1.5, 4, 0.1 * flecha, ['sienaTostada', 'siena'], 0.6);
  }
}

/** Camalote flotando: rosetas bajas de hojas claras y su sombra en el agua. */
function camalote(L, az, cx, cy, s) {
  L.mancha({ poly: elipse(cx + 1, cy + 4 * s, 24 * s, 3 * s, 10), pigmentos: ['ultramar', 'verdeHondo'], peso: 0.26, capas: 12, rugosidad: 0.3, paso: 8, humedo: 0.6, borde: 0.1 });
  for (let k = 0; k < 7; k++) {
    const rx = az.rango(6, 11) * s;
    L.mancha({
      poly: elipse(cx + az.rango(-16, 16) * s, cy + az.rango(-3.5, 1) * s, rx, rx * az.rango(0.28, 0.42), 9, az.rango(-0.25, 0.25)),
      pigmentos: k % 4 === 0 ? ['oro', 'savia'] : ['savia', 'oliva'],
      peso: az.rango(0.36, 0.52),
      capas: 12,
      rugosidad: 0.35,
      paso: 5,
      borde: 1.1,
      anchoBorde: 1,
      duro: 0.8,
      granulacion: 0.5,
      mezcla: { dir: [0, 1], fuerza: 0.9, ruido: 0.4 },
    });
  }
}

/** Follaje del ceibo: hoja compuesta de tres folíolos. Solo follaje, nunca la flor. */
function hojaDeCeibo(L, cx, cy, rot = 0) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const p = (x, y) => [cx + x * c - y * s, cy + x * s + y * c];
  L.mancha({ poly: cinta([p(0, 14), p(0, 2)], 1.4, 1), pigmentos: ['oliva'], peso: 0.6, capas: 8, rugosidad: 0.15, paso: 3, borde: 0.5, duro: 0.7 });
  for (const [x, y, r] of [
    [0, -8, 0],
    [-9, 1, -0.9],
    [9, 1, 0.9],
  ]) {
    const [hx, hy] = p(x, y);
    hoja(L, hx, hy, 6.2, 10, rot + r, ['savia', 'verdeHondo'], 0.55);
  }
}

const carpeta = (L, x, y, w, h, pig = ['ocre', 'siena'], peso = 0.42) => {
  L.mancha({ poly: [[x, y + 6], [x + 20, y + 6], [x + 25, y], [x + w, y], [x + w, y + h], [x, y + h]], pigmentos: pig, peso, capas: 18, rugosidad: 0.14, paso: 10, humedo: 0.2, borde: 0.8, anchoBorde: 1.4, duro: 0.7, granulacion: 0.9, mezcla: { dir: [0.4, 1], fuerza: 0.9, ruido: 0.5 } });
  // sombra del pie
  L.mancha({ poly: rect(x, y + h - 9, x + w, y + h), pigmentos: ['sienaTostada', 'violeta'], peso: 0.26, capas: 12, rugosidad: 0.2, paso: 8, humedo: 0.4, borde: 0.4 });
};

const lupa = (L, cx, cy, r) => {
  L.mancha({ poly: elipse(cx, cy, r, r, 14), pigmentos: ['cerulo'], peso: 0.14, capas: 12, rugosidad: 0.1, paso: 10, humedo: 0.6, borde: 0 });
  L.mancha({
    poly: elipse(cx, cy, r, r, 26),
    pigmentos: ['ultramar', 'tinta'],
    peso: 0.62,
    capas: 16,
    rugosidad: 0.04,
    paso: 8,
    borde: 0.7,
    anchoBorde: 0.9,
    duro: 0.8,
    granulacion: 0.5,
    reservas: [elipse(cx, cy, r - 3, r - 3, 26)],
    reservaSuave: 0.6,
    reservaRug: 0.03,
  });
  L.mancha({ poly: cinta([[cx + r * 0.7, cy + r * 0.7], [cx + r * 1.55, cy + r * 1.55]], 5.2, 4.4), pigmentos: ['sienaTostada', 'siena'], peso: 0.7, capas: 14, rugosidad: 0.16, paso: 5, borde: 0.7, anchoBorde: 0.8, duro: 0.8, granulacion: 0.6 });
};

// ------------------------------------------------------------------ las viñetas
function indiceVacio(L) {
  const az = new Azar(301);
  carpeta(L, 26, 42, 78, 58);
  // hoja que asoma
  L.mancha({ poly: rect(36, 33, 94, 46), pigmentos: ['violeta', 'cerulo'], peso: 0.14, capas: 12, rugosidad: 0.15, paso: 8, borde: 0.9, anchoBorde: 0.9, duro: 0.7 });
  // hilo de tinta azul atado, con moño
  hilo(L, [[66, 34], [66, 101]], 1.7);
  for (const s of [-1, 1]) L.mancha({ poly: elipse(66 + s * 6, 32, 6, 3, 9, s * 0.5), pigmentos: ['ultramar', 'tinta'], peso: 0.6, capas: 12, rugosidad: 0.3, paso: 4, borde: 0.9, anchoBorde: 0.8, duro: 0.8, reservas: [elipse(66 + s * 6, 32, 2.6, 1.2, 8, s * 0.5)], reservaSuave: 0.5 });
  espinillo(L, az, [118, 104], [134, 46]);
  disolverViñeta(L, 11);
}

function efectosVacio(L) {
  const az = new Azar(302);
  // caja de secuestro: frente, tapa y lado
  L.mancha({ poly: rect(30, 56, 104, 100), pigmentos: ['ocre', 'siena'], peso: 0.44, capas: 18, rugosidad: 0.12, paso: 10, humedo: 0.2, borde: 0.8, anchoBorde: 1.4, duro: 0.7, granulacion: 0.9, mezcla: { dir: [0.3, 1], fuerza: 0.8, ruido: 0.5 }, reservas: [rect(44, 70, 78, 89)], reservaSuave: 0.6, reservaRug: 0.025 });
  L.mancha({ poly: [[30, 56], [104, 56], [120, 42], [46, 42]], pigmentos: ['ocre', 'oro'], peso: 0.3, capas: 16, rugosidad: 0.12, paso: 10, humedo: 0.2, borde: 0.7, duro: 0.7, granulacion: 0.8 });
  L.mancha({ poly: [[104, 56], [120, 42], [120, 86], [104, 100]], pigmentos: ['sienaTostada', 'siena'], peso: 0.42, capas: 16, rugosidad: 0.12, paso: 10, humedo: 0.2, borde: 0.7, duro: 0.7, granulacion: 0.9 });
  // rótulo: un renglón de tinta, sin texto legible
  for (const [y, l] of [[76, 22], [82, 16]]) L.mancha({ poly: rect(49, y, 49 + l, y + 1.6), pigmentos: ['tinta'], peso: 0.34, capas: 8, rugosidad: 0.25, paso: 4, borde: 0.3, duro: 0.6 });
  hilo(L, [[67, 43], [66, 100]], 1.6);
  hilo(L, [[46, 42], [60, 56]], 1.2);
  // hojas de junco al costado
  juncos(L, az, 128, 102, 3, 52);
  disolverViñeta(L, 12);
}

function documentosVacio(L) {
  const az = new Azar(303);
  // hoja escaneada, con renglones de tinta
  L.mancha({ poly: rect(34, 20, 98, 94), pigmentos: ['violeta', 'cerulo'], peso: 0.13, capas: 14, rugosidad: 0.1, paso: 10, borde: 1, anchoBorde: 1.2, duro: 0.8, granulacion: 0.6 });
  for (let i = 0; i < 7; i++) L.mancha({ poly: rect(42, 32 + i * 8.5, 42 + az.rango(28, 48), 33.6 + i * 8.5), pigmentos: ['tinta', 'ultramar'], peso: 0.3, capas: 8, rugosidad: 0.25, paso: 4, borde: 0.3, duro: 0.6 });
  lupa(L, 100, 76, 19);
  hoja(L, 26, 98, 10, 3.2, -0.5, ['savia', 'oliva'], 0.5);
  hoja(L, 36, 104, 8, 2.6, 0.2, ['oliva', 'verdeHondo'], 0.5);
  disolverViñeta(L, 13);
}

function mensajesVacio(L) {
  const az = new Azar(304);
  // celular con globos de conversación vacíos
  L.mancha({ poly: rect(57, 17, 107, 101), pigmentos: ['tinta', 'ultramar'], peso: 0.5, capas: 18, rugosidad: 0.04, paso: 10, borde: 0.7, anchoBorde: 1, duro: 0.85, granulacion: 0.6, reservas: [rect(60.5, 23, 103.5, 92)], reservaSuave: 0.5, reservaRug: 0.02 });
  L.mancha({ poly: rect(60.5, 23, 103.5, 92), pigmentos: ['cerulo'], peso: 0.12, capas: 12, rugosidad: 0.1, paso: 10, humedo: 0.5, borde: 0 });
  L.mancha({ poly: elipse(79, 42, 11, 5, 10), pigmentos: ['violeta', 'cerulo'], peso: 0.36, capas: 12, rugosidad: 0.22, paso: 5, borde: 0.9, anchoBorde: 0.8, duro: 0.7 });
  L.mancha({ poly: elipse(86, 58, 12, 5, 10), pigmentos: ['cerulo', 'ultramar'], peso: 0.3, capas: 12, rugosidad: 0.22, paso: 5, borde: 0.9, anchoBorde: 0.8, duro: 0.7 });
  L.mancha({ poly: elipse(78, 73, 9, 4.5, 10), pigmentos: ['violeta', 'cerulo'], peso: 0.3, capas: 12, rugosidad: 0.22, paso: 5, borde: 0.9, anchoBorde: 0.8, duro: 0.7 });
  // rama de sauce: hojas largas colgando
  const tallo = curva([26, 30], [38, 22], [50, 26], [56, 40], 10);
  rama(L, tallo, 1.4);
  tallo.forEach(([x, y], i) => {
    if (i % 2 === 0 && i > 0) hoja(L, x - 1, y + 10, 1.8, 10, az.rango(-0.15, 0.15), ['savia', 'verdeHondo'], 0.5);
  });
  disolverViñeta(L, 14);
}

function sugerenciasVacio(L) {
  const az = new Azar(305);
  // carpetas al día: dos pilas prolijas con su hilo
  carpeta(L, 26, 66, 84, 32, ['siena', 'ocre'], 0.4);
  carpeta(L, 32, 44, 76, 28, ['ocre', 'oro'], 0.34);
  hilo(L, [[68, 44], [68, 98]], 1.6);
  for (const s of [-1, 1]) L.mancha({ poly: elipse(68 + s * 6, 42, 6, 3, 9, s * 0.5), pigmentos: ['ultramar', 'tinta'], peso: 0.6, capas: 12, rugosidad: 0.3, paso: 4, borde: 0.9, anchoBorde: 0.8, duro: 0.8, reservas: [elipse(68 + s * 6, 42, 2.6, 1.2, 8, s * 0.5)], reservaSuave: 0.5 });
  hojaDeCeibo(L, 130, 76, 0.25);
  disolverViñeta(L, 15);
}

function busquedaVacia(L) {
  const az = new Azar(306);
  // agua quieta con su lupa, sin nada bajo el vidrio
  for (const [y, x0, l, p] of [[88, 24, 96, 0.22], [100, 38, 84, 0.3]]) {
    L.mancha({ poly: cinta(curva([x0, y], [x0 + l * 0.3, y - 2.5], [x0 + l * 0.7, y + 2.5], [x0 + l, y], 8), 6.5, 4), pigmentos: ['cerulo', 'ultramar'], peso: p, capas: 14, rugosidad: 0.3, paso: 8, humedo: 0.3, borde: 0.6, duro: 0.6, granulacion: 0.9 });
  }
  lupa(L, 72, 46, 24);
  camalote(L, az, 36, 104, 0.55);
  disolverViñeta(L, 16);
}

/** La otra costa, lejos: una loma baja con matas de verde apagado, sin detalle. */
function costaLejana(L, az, y) {
  L.mancha({ poly: [[10, y], [50, y - 4], [100, y - 2], [150, y - 5], [150, y + 8], [10, y + 8]], pigmentos: ['violeta', 'oliva'], peso: 0.26, capas: 16, rugosidad: 0.3, paso: 12, humedo: 0.3, borde: 0.6, duro: 0.6 });
  for (let x = 16; x < 146; x += az.rango(10, 18)) {
    L.mancha({ poly: elipse(x, y - az.rango(1, 4), az.rango(6, 11), az.rango(2.4, 4.2), 9), pigmentos: az.next() < 0.5 ? ['oliva', 'verdeHondo'] : ['violeta', 'oliva'], peso: az.rango(0.26, 0.4), capas: 10, rugosidad: 0.45, paso: 4, borde: 0.8, anchoBorde: 0.8, duro: 0.7 });
  }
}

function errorOrilla(L) {
  const az = new Azar(307);
  // orilla serena: agua en calma, juncos a la izquierda y la otra costa lejana
  costaLejana(L, az, 58);
  L.mancha({ poly: [[8, 62], [152, 62], [152, 108], [8, 108]], pigmentos: ['cerulo', 'ultramar'], peso: 0.32, capas: 22, rugosidad: 0.12, paso: 20, humedo: 0.5, borde: 0.3, grad: { dir: [0, 1], desde: 0.5, hasta: 1 }, mezcla: { dir: [0, 1], fuerza: 1, ruido: 0.4 }, reservas: [elipse(100, 76, 14, 1.1, 8), elipse(126, 88, 10, 1, 8), elipse(72, 94, 12, 1, 8)], reservaSuave: 0.8 });
  for (const [y, x0, l] of [[80, 48, 80], [92, 60, 70]]) {
    L.mancha({ poly: cinta(curva([x0, y], [x0 + l * 0.3, y], [x0 + l * 0.7, y], [x0 + l, y], 6), 3.4, 2.4), pigmentos: ['ultramar', 'tinta'], peso: 0.32, capas: 10, rugosidad: 0.2, paso: 8, borde: 0.1, seco: { ang: 0, cerdas: 1.4, umbral: 0.5, largo: 1.2 } });
  }
  juncos(L, az, 30, 92, 6, 56);
  hoja(L, 18, 100, 9, 2.4, -0.3, ['savia', 'oliva'], 0.5);
  disolverViñeta(L, 17);
}

function proximamenteOrilla(L) {
  const az = new Azar(308);
  // la orilla de enfrente, bien lejos; un camalote cerca y una canoa vacía a lo lejos
  costaLejana(L, az, 52);
  L.mancha({ poly: [[8, 57], [152, 57], [152, 108], [8, 108]], pigmentos: ['cerulo', 'ultramar'], peso: 0.3, capas: 22, rugosidad: 0.12, paso: 20, humedo: 0.5, borde: 0.3, grad: { dir: [0, 1], desde: 0.5, hasta: 1 }, mezcla: { dir: [0, 1], fuerza: 1, ruido: 0.4 }, reservas: [elipse(40, 70, 12, 1, 8), elipse(118, 82, 14, 1.1, 8)], reservaSuave: 0.8 });
  L.mancha({ poly: elipse(104, 77, 22, 1.8, 10), pigmentos: ['ultramar', 'violeta'], peso: 0.24, capas: 10, rugosidad: 0.3, paso: 6, humedo: 0.6, borde: 0 });
  L.mancha({ poly: [[78, 68], [86, 72.5], [108, 72.5], [126, 64.5], [108, 68.5], [88, 67.5]], pigmentos: ['ultramar', 'tinta'], peso: 0.6, capas: 14, rugosidad: 0.1, paso: 4, borde: 0.7, anchoBorde: 0.8, duro: 0.85 });
  camalote(L, az, 56, 92, 1.15);
  disolverViñeta(L, 18);
}

const v = (id, pintar, semilla, uso) => ({ id, version: 1, ancho: ANCHO, alto: ALTO, modo: 'papel', semilla, presupuesto: 60_000, uso, pintar });

export const salidas = [
  v('vacio-indice', indiceVacio, 31, 'Estado vacío: todavía no hay piezas en el índice'),
  v('vacio-efectos', efectosVacio, 32, 'Estado vacío: todavía no hay efectos'),
  v('vacio-documentos', documentosVacio, 33, 'Estado vacío: todavía no hay documentos leídos'),
  v('vacio-mensajes', mensajesVacio, 34, 'Estado vacío: todavía no hay mensajes'),
  v('vacio-sugerencias', sugerenciasVacio, 35, 'Estado vacío: todo al día, sin sugerencias pendientes'),
  v('vacio-busqueda', busquedaVacia, 36, 'Estado vacío: la búsqueda no encontró nada'),
  v('error-orilla', errorOrilla, 37, 'Pantalla de error: una orilla serena'),
  v('proximamente-orilla', proximamenteOrilla, 38, 'Sección que llega en una fase próxima'),
];
