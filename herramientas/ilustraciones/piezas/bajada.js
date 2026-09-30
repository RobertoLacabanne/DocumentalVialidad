// «La Bajada»: panorama de la barranca de Paraná vista desde el río, con luz de mañana.
// Coordenadas en px CSS sobre un lienzo de 1200×500 (se hornea a 2x).
// El hilo va en otra capa, con transparencia, para poder «tenderlo» en el Acceso.
import { Azar, fbm, ruido } from '../azar.js';
import { cinta, curva, elipse, rect } from '../acuarela.js';

export const ANCHO = 1200;
export const ALTO = 500;
const LINEA_DE_AGUA = 262;
const SOL = [850, 150];

const suave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Altura de la cresta de la barranca: alta a la izquierda, bajando hacia la derecha. */
export const cresta = (x) => 84 + (x / ANCHO) * 118 + 6 * Math.sin(x / 95) + 4 * Math.sin(x / 37 + 1);

/** Trayectoria del hilo: de arriba a la izquierda a abajo a la derecha, con una pequeña panza. */
export function trayectoriaDelHilo() {
  return curva([-12, 40], [350, 62], [760, 205], [1212, 470], 44);
}

function pintarBajada(L) {
  const az = new Azar(20260930);
  const xs = [];
  for (let x = -20; x <= 1220; x += 20) xs.push(x);
  const perfil = xs.map((x) => [x, cresta(x)]);

  // ------------------------------------------------------------ cielo
  const cieloPoly = [...perfil.map(([x, y]) => [x, y + 5]), [1222, 12], [-22, 12]];
  L.mancha({
    poly: cieloPoly,
    pigmentos: ['cerulo'],
    peso: 0.34,
    capas: 34,
    rugosidad: 0.2,
    paso: 40,
    humedo: 0.6,
    borde: 0.25,
    grad: { dir: [0, 1], desde: 1, hasta: 0.12 },
    reservas: [
      elipse(300, 72, 88, 13, 12),
      elipse(452, 96, 50, 8, 10),
      elipse(520, 44, 70, 9, 12),
      elipse(1020, 84, 100, 12, 12),
      elipse(1132, 40, 62, 8, 10),
      elipse(690, 60, 54, 7, 10),
    ],
    reservasBlandas: [elipse(SOL[0], SOL[1] + 14, 300, 150, 18)],
    reservaBlanda: 70,
  });
  // segundo lavado, más corto y más frío, arriba a la izquierda (variación dentro del cielo)
  L.mancha({
    poly: [
      [-22, 12],
      [520, 10],
      [640, 42],
      [420, 86],
      [150, 104],
      [-22, 118],
    ],
    pigmentos: ['cerulo', 'violeta'],
    peso: 0.16,
    capas: 26,
    rugosidad: 0.3,
    paso: 40,
    humedo: 0.85,
    borde: 0,
    grad: { dir: [0, 1], desde: 1, hasta: 0.2 },
    mezcla: { dir: [-1, -0.4], fuerza: 0.7, ruido: 0.5 },
  });
  // resplandor cálido: dos lavados húmedos, uno ancho en el horizonte y otro redondo alrededor del sol
  L.mancha({
    poly: elipse(SOL[0] - 30, 190, 430, 84, 16),
    pigmentos: ['oro'],
    peso: 0.15,
    capas: 26,
    rugosidad: 0.2,
    paso: 40,
    humedo: 1,
    borde: 0,
    flujo: 0.3,
  });
  L.mancha({
    poly: elipse(SOL[0], SOL[1], 92, 82, 16),
    pigmentos: ['oro'],
    peso: 0.2,
    capas: 24,
    rugosidad: 0.2,
    humedo: 1,
    borde: 0,
    flujo: 0.2,
  });
  L.mancha({
    poly: elipse(SOL[0], SOL[1], 40, 40, 14),
    pigmentos: ['oro'],
    peso: 0.3,
    capas: 22,
    rugosidad: 0.16,
    humedo: 0.6,
    borde: 0.3,
    flujo: 0.08,
  });
  L.mancha({
    poly: elipse(SOL[0], SOL[1], 27, 27, 14),
    pigmentos: ['oro', 'ocre'],
    peso: 0.6,
    capas: 26,
    rugosidad: 0.12,
    humedo: 0.15,
    borde: 1,
    anchoBorde: 1.6,
    duro: 0.7,
    flujo: 0.08,
    reservas: [elipse(SOL[0] - 3, SOL[1] - 2, 12, 12, 10)],
    reservaSuave: 3.5,
  });

  // ------------------------------------------------------------ la ciudad, apenas sugerida
  // manchas de violeta y siena claro que asoman sobre la cresta; sin ventanas ni detalle
  const bloques = [];
  for (let x = 250; x < 720; x += az.rango(13, 24)) {
    const w = az.rango(11, 25);
    const central = 1 - Math.abs(x - 480) / 260;
    const h = az.rango(11, 22) + central * az.rango(0, 14);
    bloques.push({ x, w, h, y: cresta(x + w / 2) });
  }
  bloques.forEach((b, i) => {
    L.mancha({
      poly: rect(b.x, b.y - b.h, b.x + b.w, b.y + 10),
      pigmentos: i % 3 === 0 ? ['siena', 'violeta'] : i % 3 === 1 ? ['violeta', 'ultramar'] : ['ocre', 'violeta'],
      peso: az.rango(0.2, 0.34),
      capas: 16,
      rugosidad: 0.26,
      paso: 10,
      borde: 0.8,
      anchoBorde: 1.2,
      duro: 0.7,
      granulacion: 0.6,
      mezcla: { dir: [0, 1], fuerza: 0.7, ruido: 0.3 },
    });
  });

  // ------------------------------------------------------------ la barranca
  const caraPoly = [...perfil.map(([x, y]) => [x, y + 2]), [1222, LINEA_DE_AGUA + 5], [-22, LINEA_DE_AGUA + 5]];
  L.mancha({
    poly: caraPoly,
    pigmentos: ['ocre', 'siena'],
    peso: 0.44,
    capas: 36,
    rugosidad: 0.14,
    paso: 34,
    humedo: 0.35,
    duro: 0.6,
    borde: 0.55,
    anchoBorde: 2.6,
    granulacion: 0.95,
    mezcla: { dir: [0.25, 1], fuerza: 0.9, ruido: 0.7 },
  });
  // estratos: tres bandas de tierra a distinta altura de la cara
  [0.3, 0.52, 0.72].forEach((f, i) => {
    const banda = [];
    for (let x = -22; x <= 1222; x += 30) banda.push([x, cresta(x) + f * (LINEA_DE_AGUA - cresta(x)) + 3 * Math.sin(x / 40 + i)]);
    const abajo = banda.map(([x, y]) => [x, y + 9 + 4 * Math.sin(x / 33 + i * 2)]).reverse();
    L.mancha({
      poly: [...banda, ...abajo],
      pigmentos: i === 1 ? ['ocre', 'siena'] : ['siena', 'sienaTostada'],
      peso: 0.3 + i * 0.03,
      capas: 18,
      rugosidad: 0.3,
      paso: 30,
      humedo: 0.25,
      borde: 0.75,
      duro: 0.6,
      granulacion: 0.9,
      mezcla: { dir: [1, 0], fuerza: 0.7, ruido: 0.6 },
    });
  });
  // erosión: vetas verticales de pincel seco, más marcadas donde la barranca es alta
  for (let i = 0; i < 11; i++) {
    const x = az.rango(0, 930);
    const c = cresta(x);
    const alto = (LINEA_DE_AGUA - c) * az.rango(0.5, 0.95);
    if (alto < 30) continue;
    const ancho = az.rango(3, 9);
    L.mancha({
      poly: [
        [x, c + az.rango(8, 26)],
        [x + ancho, c + az.rango(8, 26)],
        [x + ancho * 0.6 + az.rango(-5, 5), c + 8 + alto],
        [x + az.rango(-4, 4), c + 8 + alto * az.rango(0.8, 1)],
      ],
      pigmentos: ['sienaTostada', 'violeta'],
      peso: az.rango(0.3, 0.46),
      capas: 12,
      rugosidad: 0.3,
      paso: 16,
      borde: 0.2,
      duro: 0.5,
      seco: { ang: Math.PI / 2, cerdas: 1.3, umbral: 0.46, largo: 0.5 },
      mezcla: { dir: [0, 1], fuerza: 0.9, ruido: 0.2 },
    });
  }
  // sombra del pie: húmedo sobre húmedo, con la pintura de abajo corriéndose
  L.mojar({ poly: rect(-20, LINEA_DE_AGUA - 56, 1220, LINEA_DE_AGUA + 3), radio: 6, cantidad: 0.5 });
  L.mancha({
    poly: [
      ...perfil.filter((_, i) => i % 2 === 0).map(([x, y]) => [x, Math.max(y + 50, LINEA_DE_AGUA - 58 + 6 * Math.sin(x / 50))]),
      [1222, LINEA_DE_AGUA + 6],
      [-22, LINEA_DE_AGUA + 6],
    ],
    pigmentos: ['violeta', 'ultramar'],
    peso: 0.5,
    capas: 30,
    rugosidad: 0.2,
    paso: 34,
    humedo: 0.4,
    borde: 0.45,
    granulacion: 0.9,
    grad: { dir: [0, 1], desde: 0.12, hasta: 1 },
    mezcla: { dir: [0, 1], fuerza: 0.8, ruido: 0.4 },
  });
  // orilla: el pie de la barranca, con su raya de sombra y raíces en el agua
  L.mancha({
    poly: [
      ...xs.filter((_, i) => i % 2 === 0).map((x) => [x, LINEA_DE_AGUA - 9 + 2.5 * Math.sin(x / 31)]),
      [1222, LINEA_DE_AGUA + 4],
      [-22, LINEA_DE_AGUA + 4],
    ],
    pigmentos: ['sienaTostada', 'tinta'],
    peso: 0.34,
    capas: 20,
    rugosidad: 0.24,
    paso: 22,
    humedo: 0.15,
    borde: 0.7,
    duro: 0.75,
    granulacion: 0.9,
    mezcla: { dir: [1, 0], fuerza: 0.6, ruido: 0.7 },
  });
  // barranca parquizada: matas bajas de verde prendidas a los estratos
  for (let i = 0; i < 6; i++) {
    const x = az.rango(10, 720);
    const c = cresta(x);
    const y = c + (LINEA_DE_AGUA - c) * az.rango(0.2, 0.55);
    L.mancha({
      poly: elipse(x, y, az.rango(12, 26), az.rango(2.6, 5), 10, az.rango(-0.12, 0.12)),
      pigmentos: ['oliva', 'verdeHondo'],
      peso: az.rango(0.36, 0.52),
      capas: 14,
      rugosidad: 0.5,
      paso: 8,
      borde: 0.9,
      anchoBorde: 1.3,
      duro: 0.7,
      granulacion: 0.6,
      mezcla: { dir: [0, 1], fuerza: 0.8, ruido: 0.5 },
    });
  }

  // ------------------------------------------------------------ vegetación de la cresta
  const VERDES = [
    ['savia', 'oliva'],
    ['oliva', 'verdeHondo'],
    ['savia', 'verdeHondo'],
    ['oliva', 'savia'],
  ];
  for (let x = -10; x < 1220; x += az.rango(26, 40)) {
    const c = cresta(x);
    const cercaDelSol = Math.abs(x - SOL[0]) < 95;
    const lobulos = 3 + Math.floor(az.next() * 3);
    for (let k = 0; k < lobulos; k++) {
      const ox = az.rango(-16, 16);
      const alto = cercaDelSol ? az.rango(5, 8) : az.rango(7, 14);
      L.mancha({
        poly: elipse(x + ox, c + az.rango(cercaDelSol ? -2 : -7, 3), az.rango(12, 23), alto, 9, az.rango(-0.4, 0.4)),
        pigmentos: az.elegir(VERDES),
        peso: az.rango(0.42, 0.66),
        capas: 16,
        rugosidad: 0.55,
        paso: 10,
        borde: 0.9,
        anchoBorde: 1.4,
        duro: 0.7,
        granulacion: 0.6,
        mezcla: { dir: [0, 1], fuerza: 0.8, ruido: 0.5 },
      });
    }
    if (x > 40 && x < 1000 && !cercaDelSol && !(x > 240 && x < 730) && az.next() < 0.45) {
      // sauce: masa más alta y honda, con la luz arriba
      L.mancha({
        poly: elipse(x + az.rango(-6, 6), c - 14, az.rango(9, 15), az.rango(17, 27), 10),
        pigmentos: ['savia', 'verdeHondo'],
        peso: az.rango(0.5, 0.7),
        capas: 18,
        rugosidad: 0.5,
        paso: 10,
        borde: 1,
        anchoBorde: 1.4,
        duro: 0.7,
        granulacion: 0.7,
        mezcla: { dir: [0, 1], fuerza: 0.9, ruido: 0.5 },
      });
    }
  }
  // espinillo en flor: las manchitas de oro
  for (let i = 0; i < 26; i++) {
    const x = az.rango(10, 900);
    if (Math.abs(x - SOL[0]) < 70) continue;
    const c = cresta(x);
    L.mancha({
      poly: elipse(x, c - az.rango(4, 16), az.rango(2.5, 6), az.rango(2.2, 4.5), 8),
      pigmentos: ['oro', 'ocre'],
      peso: az.rango(0.55, 0.8),
      capas: 10,
      rugosidad: 0.4,
      paso: 5,
      borde: 0.9,
      anchoBorde: 0.9,
      duro: 0.6,
      granulacion: 0.3,
    });
  }

  // ------------------------------------------------------------ el agua
  const brillos = [];
  for (let i = 0; i < 46; i++) {
    const t = az.next();
    const y = LINEA_DE_AGUA + 8 + t * 168;
    const ancho = 8 + t * 46;
    const x = SOL[0] + az.gauss() * (16 + t * 26);
    brillos.push(elipse(x, y, az.rango(ancho * 0.5, ancho), az.rango(0.9, 2.2), 8));
  }
  for (let i = 0; i < 54; i++) {
    const y = az.rango(LINEA_DE_AGUA + 14, ALTO - 14);
    const x = az.rango(20, 1180);
    brillos.push(elipse(x, y, az.rango(5, 22), az.rango(0.8, 1.6), 8));
  }
  const aguaPoly = [];
  for (let x = -22; x <= 1222; x += 40) aguaPoly.push([x, LINEA_DE_AGUA + 2 + 1.6 * Math.sin(x / 70)]);
  aguaPoly.push([1222, ALTO + 12], [-22, ALTO + 12]);
  const columna = [
    [SOL[0] - 34, LINEA_DE_AGUA + 3],
    [SOL[0] + 34, LINEA_DE_AGUA + 3],
    [SOL[0] + 86, 440],
    [SOL[0] - 86, 440],
  ];
  L.mancha({
    poly: aguaPoly,
    pigmentos: ['cerulo', 'ultramar'],
    peso: 0.5,
    capas: 38,
    rugosidad: 0.12,
    paso: 40,
    humedo: 0.5,
    flujo: 0.38,
    borde: 0.2,
    granulacion: 0.9,
    grad: { dir: [0, 1], desde: 0.5, hasta: 1 },
    mezcla: { dir: [0, 1], fuerza: 1, ruido: 0.5 },
    reservas: brillos,
    reservaSuave: 0.9,
    reservasBlandas: [columna],
    reservaBlanda: 26,
  });
  // reflejo de la barranca, más bajo y más blando
  const reflejo = [
    [-22, LINEA_DE_AGUA + 2],
    ...xs
      .filter((_, i) => i % 2 === 0)
      .map((x) => [x, LINEA_DE_AGUA + (LINEA_DE_AGUA - cresta(x)) * 0.55 + 4 * Math.sin(x / 26)]),
    [1222, LINEA_DE_AGUA + 2],
  ];
  L.mancha({
    poly: reflejo,
    pigmentos: ['sienaTostada', 'verdeHondo'],
    peso: 0.36,
    capas: 26,
    rugosidad: 0.12,
    paso: 34,
    humedo: 0.7,
    borde: 0.1,
    granulacion: 0.9,
    grad: { dir: [0, 1], desde: 1, hasta: 0.15 },
    mezcla: { dir: [0, 1], fuerza: 0.9, ruido: 0.4 },
  });
  // columna del sol en el agua: oro puro sobre el agua que dejó libre el azul
  L.mancha({
    poly: columna,
    pigmentos: ['oro', 'ocre'],
    peso: 0.5,
    capas: 28,
    rugosidad: 0.22,
    paso: 40,
    humedo: 0.5,
    borde: 0,
    grad: { dir: [0, 1], desde: 1, hasta: 0.25 },
    mezcla: { dir: [0, 1], fuerza: 0.7, ruido: 0.3 },
    reservas: brillos,
    reservaSuave: 0.9,
  });
  // bandas de agua: pocas, desparejas, de largo y espesor distintos (el río tiene valores, no rayas)
  const franjas = [
    { y: 294, x0: 40, x1: 520, h: 10, p: 0.2 },
    { y: 329, x0: 500, x1: 1130, h: 15, p: 0.25 },
    { y: 388, x0: -40, x1: 700, h: 19, p: 0.3 },
    { y: 421, x0: 560, x1: 1260, h: 13, p: 0.36 },
    { y: 462, x0: 120, x1: 640, h: 21, p: 0.42 },
  ];
  franjas.forEach((f, i) => {
    L.mancha({
      poly: [
        [f.x0, f.y],
        [f.x1, f.y + az.rango(-3, 3)],
        [f.x1 - 50, f.y + f.h],
        [f.x0 + 60, f.y + f.h + az.rango(-2, 3)],
      ],
      pigmentos: i < 2 ? ['cerulo', 'violeta'] : ['cerulo', 'ultramar'],
      peso: f.p,
      capas: 16,
      rugosidad: 0.2,
      paso: 22,
      humedo: 0.35,
      borde: 0.7,
      duro: 0.7,
      granulacion: 0.9,
      mezcla: { dir: [1, 0], fuerza: 0.7, ruido: 0.6 },
    });
  });
  // pincel seco: estelas horizontales de agua en primer plano
  for (let i = 0; i < 11; i++) {
    const y = az.rango(376, 494);
    const x = az.rango(-40, 880);
    L.mancha({
      poly: rect(x, y, x + az.rango(180, 420), y + az.rango(4, 8)),
      pigmentos: ['ultramar', 'tinta'],
      peso: az.rango(0.3, 0.5),
      capas: 10,
      rugosidad: 0.25,
      paso: 30,
      borde: 0.1,
      duro: 0.4,
      seco: { ang: 0, cerdas: 1.4, umbral: az.rango(0.44, 0.56), largo: 1.4 },
      mezcla: { dir: [1, 0], fuerza: 0.6, ruido: 0.3 },
    });
  }

  // ------------------------------------------------------------ camalotes, canoa
  const camalote = (cx, cy, s) => {
    // sombra en el agua
    L.mancha({
      poly: elipse(cx + 2 * s, cy + 5 * s, 27 * s, 3.6 * s, 12),
      pigmentos: ['ultramar', 'verdeHondo'],
      peso: 0.3,
      capas: 14,
      rugosidad: 0.3,
      paso: 10,
      humedo: 0.6,
      borde: 0.2,
    });
    // rosetas de hojas redondas, bajas y anchas; la luz queda arriba
    const n = 8 + Math.floor(s * 3);
    for (let k = 0; k < n; k++) {
      const ox = az.rango(-22, 22) * s * 0.85;
      const oy = az.rango(-4, 1.5) * s * 0.85;
      const rx = az.rango(6, 12) * s;
      L.mancha({
        poly: elipse(cx + ox, cy + oy, rx, rx * az.rango(0.26, 0.4), 10, az.rango(-0.25, 0.25)),
        pigmentos: k % 4 === 0 ? ['oro', 'savia'] : ['savia', 'oliva'],
        peso: az.rango(0.34, 0.5),
        capas: 14,
        rugosidad: 0.35,
        paso: 6,
        borde: 1.1,
        anchoBorde: 1.2,
        duro: 0.8,
        granulacion: 0.5,
        mezcla: { dir: [0, 1], fuerza: 0.9, ruido: 0.4 },
      });
    }
    // un par de hojas más hondas al pie, para dar volumen
    for (let k = 0; k < 3; k++) {
      L.mancha({
        poly: elipse(cx + az.rango(-14, 14) * s, cy + az.rango(0, 2.5) * s, az.rango(5, 9) * s, 1.6 * s, 8),
        pigmentos: ['verdeHondo', 'oliva'],
        peso: az.rango(0.5, 0.66),
        capas: 12,
        rugosidad: 0.3,
        paso: 5,
        borde: 0.8,
        duro: 0.85,
        granulacion: 0.4,
      });
    }
  };
  camalote(150, 398, 1.7);
  camalote(252, 448, 2.3);
  camalote(1040, 430, 1.9);
  camalote(1132, 476, 1.45);
  camalote(336, 302, 0.75);
  camalote(985, 306, 0.68);
  camalote(575, 420, 1.05);

  // canoa vacía, chica, con su sombra en el agua
  const [cx0, cy0] = [640, 352];
  L.mancha({
    poly: elipse(cx0 + 2, cy0 + 8, 44, 3.2, 12),
    pigmentos: ['ultramar', 'violeta'],
    peso: 0.32,
    capas: 14,
    rugosidad: 0.3,
    paso: 10,
    humedo: 0.7,
    borde: 0,
  });
  L.mancha({
    poly: [
      [cx0 - 40, cy0 - 6],
      [cx0 - 30, cy0 + 2],
      [cx0 - 10, cy0 + 6],
      [cx0 + 16, cy0 + 6],
      [cx0 + 34, cy0 + 1],
      [cx0 + 46, cy0 - 9],
      [cx0 + 26, cy0 - 3],
      [cx0 + 4, cy0 - 1.8],
      [cx0 - 20, cy0 - 2.5],
    ],
    pigmentos: ['tinta', 'ultramar'],
    peso: 0.85,
    capas: 14,
    rugosidad: 0.16,
    paso: 6,
    borde: 0.8,
    anchoBorde: 0.9,
    duro: 0.85,
    granulacion: 0.4,
  });

  // un gesto: salpicaduras de ultramar en la esquina de abajo a la derecha
  L.salpicar({ centro: [1090, 452], radio: 70, cantidad: 16, pigmentos: ['ultramar'], peso: 0.5, semilla: 3 });
  L.salpicar({ centro: [70, 470], radio: 40, cantidad: 8, pigmentos: ['cerulo'], peso: 0.55, semilla: 5 });

  // ------------------------------------------------------------ el borde de arriba se disuelve como un lavado
  L.disolver((x, y) => {
    const tope = 6 + 26 * (fbm(x / 150, 3.3, 5, 3) - 0.3) * 2;
    return suave(tope, tope + 70, y);
  });
}

function pintarHilo(L) {
  // La hebra ondula apenas y cambia de grosor: nunca es una línea perfecta.
  const camino = trayectoriaDelHilo().map(([x, y], i) => [x + 0.8 * Math.sin(i * 1.3), y + 1.6 * Math.sin(i * 0.9 + 1) + 1.2 * (ruido(i * 0.5, 4.4, 2) - 0.5)]);
  const variar = (i) => ruido(i * 0.38, 7.7, 3);
  // cuerpo del hilo
  L.mancha({
    poly: cinta(camino, 4.8, 3, variar),
    pigmentos: ['punzo', 'punzoSombra'],
    peso: 0.66,
    capas: 22,
    rugosidad: 0.22,
    paso: 4,
    borde: 0.85,
    anchoBorde: 1.3,
    duro: 0.45,
    suavidad: 1.4,
    granulacion: 0.6,
    flujo: 0.3,
    mezcla: { dir: [1, 0.4], fuerza: 0.7, ruido: 1 },
  });
  // segunda pasada corrida un pelo, con pincel seco: deja la hebra entrecortada y algo más clara
  L.mancha({
    poly: cinta(
      camino.map(([x, y]) => [x + 0.6, y - 0.9]),
      3.2,
      2.4,
      (i) => ruido(i * 0.5, 2.2, 8),
    ),
    pigmentos: ['punzo'],
    peso: 0.5,
    capas: 12,
    rugosidad: 0.25,
    paso: 4,
    borde: 0.3,
    duro: 0.4,
    granulacion: 0.6,
    seco: { ang: -0.38, cerdas: 2, umbral: 0.42, largo: 0.6 },
  });
  // donde la tinta se carga: un tramo más hondo
  L.mancha({
    poly: cinta(camino.slice(10, 34), 2.2, 1.6, (i) => ruido(i * 0.6, 5.1, 9)),
    pigmentos: ['punzoSombra'],
    peso: 0.4,
    capas: 10,
    rugosidad: 0.22,
    paso: 4,
    borde: 0.3,
    granulacion: 0.5,
    duro: 0.4,
  });
}

export const salidas = [
  { id: 'bajada', version: 1, ancho: ANCHO, alto: ALTO, modo: 'papel', semilla: 11, presupuesto: 300_000, uso: 'Panorama del Acceso y portada del manual', pintar: pintarBajada },
  { id: 'hilo-bajada', version: 1, ancho: ANCHO, alto: ALTO, modo: 'capa', semilla: 12, presupuesto: 60_000, uso: 'El hilo de la bandera, en capa aparte para tenderlo', pintar: pintarHilo },
];
