// Ubica los nodos del grafo con d3-force. Se calcula de una vez (sin
// animación) para que el dibujo quede quieto y sea el mismo cada vez que se
// abre. En grafos chicos se prueban varios arranques y se queda el que menos
// líneas cruza.

import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import type { Arista, Nodo } from './relaciones';

export type Punto = { x: number; y: number };

type NodoSim = SimulationNodeDatum & { id: string };

const AUREO = Math.PI * (3 - Math.sqrt(5));

/** Números pseudoaleatorios con semilla (mulberry32): el mismo grafo da siempre el mismo dibujo. */
function sembrado(semilla: number) {
  let t = semilla >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function simular(nodos: Nodo[], aristas: Arista[], inicio: (i: number) => Punto, fijas: Map<string, Punto>, vueltas: number): Map<string, Punto> {
  const sim: NodoSim[] = nodos.map((n, i) => {
    const fija = fijas.get(n.id);
    return fija ? { id: n.id, x: fija.x, y: fija.y, fx: fija.x, fy: fija.y } : { id: n.id, ...inicio(i) };
  });
  const enlaces: SimulationLinkDatum<NodoSim>[] = aristas.map((a) => ({ source: a.a, target: a.b }));
  const grado = new Map<string, number>();
  for (const a of aristas) {
    grado.set(a.a, (grado.get(a.a) ?? 0) + 1);
    grado.set(a.b, (grado.get(a.b) ?? 0) + 1);
  }
  const simulacion = forceSimulation(sim)
    .force(
      'enlaces',
      forceLink<NodoSim, SimulationLinkDatum<NodoSim>>(enlaces)
        .id((n) => n.id)
        .distance(220)
        .strength(0.45),
    )
    .force('carga', forceManyBody<NodoSim>().strength((n) => -700 - 90 * (grado.get(n.id) ?? 0)))
    .force('choque', forceCollide<NodoSim>(84))
    .force('x', forceX<NodoSim>(0).strength(0.05))
    .force('y', forceY<NodoSim>(0).strength(0.07))
    .stop();
  for (let i = 0; i < vueltas; i++) simulacion.tick();
  return new Map(sim.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));
}

function seCortan(p1: Punto, p2: Punto, p3: Punto, p4: Punto): boolean {
  const d = (a: Punto, b: Punto, c: Punto) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Cuántos pares de líneas se cruzan (las que comparten un extremo no cuentan). */
export function cruces(aristas: Arista[], pos: Map<string, Punto>): number {
  let n = 0;
  for (let i = 0; i < aristas.length; i++) {
    const a = aristas[i];
    for (let j = i + 1; j < aristas.length; j++) {
      const b = aristas[j];
      if (a.a === b.a || a.a === b.b || a.b === b.a || a.b === b.b) continue;
      if (seCortan(pos.get(a.a)!, pos.get(a.b)!, pos.get(b.a)!, pos.get(b.b)!)) n++;
    }
  }
  return n;
}

/** Siempre el mismo dibujo para el mismo grafo; lo que alguien acomodó a mano (fijas) queda donde lo dejó. */
export function disponer(nodos: Nodo[], aristas: Arista[], fijas: Map<string, Punto> = new Map()): Map<string, Punto> {
  const intentos = nodos.length <= 15 ? 24 : nodos.length <= 40 ? 10 : nodos.length <= 80 ? 4 : 1;
  let mejor: Map<string, Punto> | null = null;
  let menos = Infinity;
  for (let s = 0; s < intentos; s++) {
    // Primero la espiral áurea; después, arranques sembrados (siempre los mismos) repartidos en un círculo.
    const azar = sembrado(s + 1);
    const inicio =
      s === 0
        ? (i: number) => ({ x: 30 * Math.sqrt(i + 0.5) * Math.cos(i * AUREO), y: 30 * Math.sqrt(i + 0.5) * Math.sin(i * AUREO) })
        : () => {
            const r = 260 * Math.sqrt(azar());
            const a = 2 * Math.PI * azar();
            return { x: r * Math.cos(a), y: r * Math.sin(a) };
          };
    const pos = simular(nodos, aristas, inicio, fijas, 320);
    const c = cruces(aristas, pos);
    if (c < menos) {
      menos = c;
      mejor = pos;
      if (c === 0) break;
    }
  }
  return mejor ?? new Map();
}

/** Escala y desplazamiento para que todo el grafo entre en el recuadro (abajo queda lugar para los nombres y la leyenda). */
export function encuadrar(puntos: Punto[], ancho: number, alto: number): { x: number; y: number; k: number } {
  if (!puntos.length || !ancho || !alto) return { x: ancho / 2, y: alto / 2, k: 1 };
  const [lados, arriba, abajo] = ancho < 600 ? [56, 48, 96] : [100, 60, 110];
  const xs = puntos.map((p) => p.x);
  const ys = puntos.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min(1.4, Math.max(0.3, Math.min((ancho - lados * 2) / Math.max(x1 - x0, 1), (alto - arriba - abajo) / Math.max(y1 - y0, 1))));
  return { x: ancho / 2 - ((x0 + x1) / 2) * k, y: arriba + (alto - arriba - abajo) / 2 - ((y0 + y1) / 2) * k, k };
}
