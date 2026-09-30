// Acuarela procedural en Canvas 2D.
//
// La base es la técnica de Tyler Hobbs: cada mancha es una pila de decenas de capas casi
// transparentes de un polígono que se deforma de manera recursiva. Encima se le suman los
// rasgos que hacen que parezca pintado y no digital: borde oscuro de pigmento, granulación
// en el papel, bordes que alternan duros y suaves, blancos reservados, sangrado sobre húmedo,
// variación de valor y de temperatura, y pincel seco.
//
// Todas las medidas que recibe la API están en px CSS; el lienzo las multiplica por `escala`.
import { Azar, fbm, hashInt, ruido } from './azar.js';
import { campoGrano, COLOR_PAPEL } from './papel.js';
import { rgbDe } from './pigmentos.js';

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const suave = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- geometría
export function elipse(cx, cy, rx, ry, n = 10, rot = 0) {
  const pts = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    pts.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return pts;
}

export const rect = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** Curva de Bézier cúbica muestreada en n+1 puntos. */
export function curva(p0, c1, c2, p3, n = 28) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push([
      u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1],
    ]);
  }
  return pts;
}

/** Polígono alrededor de una línea quebrada, con ancho variable. `var` opcional: i -> 0..1. */
export function cinta(pts, ancho0, ancho1 = ancho0, variar = null) {
  const izq = [];
  const der = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const m = Math.hypot(tx, ty) || 1;
    tx /= m;
    ty /= m;
    const t = i / (pts.length - 1);
    const w = ((ancho0 + (ancho1 - ancho0) * t) / 2) * (variar ? 0.6 + 0.8 * variar(i) : 1);
    izq.push([pts[i][0] - ty * w, pts[i][1] + tx * w]);
    der.push([pts[i][0] + ty * w, pts[i][1] - tx * w]);
  }
  return [...izq, ...der.reverse()];
}

/** Parte las aristas largas en tramos de a lo sumo `paso`, para que la deformación sea pareja. */
function resamplear(pts, paso) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / paso));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/** Hobbs: cada arista se parte por el medio y el punto nuevo se corre con una gaussiana. */
function deformar(pts, az, profundidad, sigma) {
  let out = pts;
  for (let d = 0; d < profundidad; d++) {
    const nuevo = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      const b = out[(i + 1) % out.length];
      nuevo.push(a);
      const largo = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const sd = sigma * largo;
      nuevo.push([(a[0] + b[0]) / 2 + az.gauss() * sd, (a[1] + b[1]) / 2 + az.gauss() * sd]);
    }
    out = nuevo;
  }
  return out;
}

function trazar(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

// ---------------------------------------------------------------- desenfoque (cajas repetidas)
function cajaH(src, dst, w, h, r) {
  const d = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[o + (x < 0 ? 0 : x >= w ? w - 1 : x)];
    for (let x = 0; x < w; x++) {
      dst[o + x] = acc / d;
      const xa = x + r + 1 >= w ? w - 1 : x + r + 1;
      const xb = x - r < 0 ? 0 : x - r;
      acc += src[o + xa] - src[o + xb];
    }
  }
}

function cajaV(src, dst, w, h, r) {
  const d = 2 * r + 1;
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += src[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc / d;
      const ya = y + r + 1 >= h ? h - 1 : y + r + 1;
      const yb = y - r < 0 ? 0 : y - r;
      acc += src[ya * w + x] - src[yb * w + x];
    }
  }
}

/** Desenfoque gaussiano aproximado con tres pasadas de caja. Devuelve una copia. */
function desenfocar(F, w, h, sigma) {
  let a = F.slice();
  if (sigma < 0.6) return a;
  const r = Math.max(1, Math.round(sigma - 0.5));
  let b = new Float32Array(F.length);
  for (let k = 0; k < 3; k++) {
    cajaH(a, b, w, h, r);
    cajaV(b, a, w, h, r);
  }
  return a;
}

// ---------------------------------------------------------------- el lienzo
export class Lienzo {
  /**
   * @param ancho,alto  tamaño en px CSS
   * @param modo  'papel' (pinta por sustracción sobre el papel) o 'capa' (pigmento con transparencia)
   */
  constructor(ancho, alto, { escala = 2, modo = 'papel', semilla = 1 } = {}) {
    this.E = escala;
    this.W = Math.round(ancho * escala);
    this.H = Math.round(alto * escala);
    this.modo = modo;
    this.semilla = semilla;
    this.contador = 0;
    this.rgb = new Float32Array(this.W * this.H * 3);
    this.a = new Float32Array(this.W * this.H);
    if (modo === 'papel') {
      for (let i = 0; i < this.W * this.H; i++) {
        this.rgb[i * 3] = COLOR_PAPEL[0] / 255;
        this.rgb[i * 3 + 1] = COLOR_PAPEL[1] / 255;
        this.rgb[i * 3 + 2] = COLOR_PAPEL[2] / 255;
        this.a[i] = 1;
      }
    }
    this.grano = campoGrano(this.W, this.H, escala);
  }

  /**
   * Una mancha de acuarela.
   * @param s.poly          polígono en px CSS
   * @param s.pigmentos     [nombre] o [nombreA, nombreB]: A hacia la luz, B hacia la sombra
   * @param s.peso          densidad máxima (0..1). Lavados: 0.1–0.3. Oscuros: 0.6–0.9
   * @param s.capas         cantidad de veladuras (por defecto 30)
   * @param s.rugosidad     cuánto se deforma el contorno
   * @param s.borde         oscurecimiento donde el agua se seca (0..1.5)
   * @param s.duro          0 mayormente bordes suaves, 1 mayormente duros
   * @param s.humedo        0 seco, 1 húmedo sobre húmedo (bordes blandos)
   * @param s.sangrado      px CSS: cuánto se corre la pintura de abajo adentro de esta mancha
   * @param s.reservas      polígonos que quedan sin pintar (papel)
   * @param s.grad          {dir:[dx,dy], desde, hasta}: la densidad cambia a lo largo de una dirección
   * @param s.mezcla        {dir:[dx,dy], fuerza, ruido}: paso del pigmento A al B
   * @param s.flujo         variación orgánica de densidad a baja frecuencia (por defecto 0.22)
   * @param s.seco          {ang, cerdas, umbral}: pincel seco
   */
  mancha(s) {
    const { E, W, H } = this;
    const az = new Azar(hashInt(this.semilla * 7919 + ++this.contador * 104729));
    const semilla = az.entero() & 0xffff;
    const pol = resamplear(
      s.poly.map(([x, y]) => [x * E, y * E]),
      (s.paso ?? 30) * E,
    );
    const rug = s.rugosidad ?? 0.45;
    let mnx = 1e9;
    let mny = 1e9;
    let mxx = -1e9;
    let mxy = -1e9;
    for (const [x, y] of pol) {
      mnx = Math.min(mnx, x);
      mny = Math.min(mny, y);
      mxx = Math.max(mxx, x);
      mxy = Math.max(mxy, y);
    }
    const tam = Math.max(mxx - mnx, mxy - mny);
    const sigE = (s.anchoBorde ?? 2.2) * E;
    const sigS = (s.suavidad ?? 1.6) * E * (1 + 3 * (s.humedo ?? 0));
    const margen = Math.ceil(rug * tam * 0.2 + (sigE + sigS + (s.sangrado ?? 0) * E) * 3 + 6 * E);
    const x0 = Math.max(0, Math.floor(mnx - margen));
    const y0 = Math.max(0, Math.floor(mny - margen));
    const x1 = Math.min(W, Math.ceil(mxx + margen));
    const y1 = Math.min(H, Math.ceil(mxy + margen));
    const bw = x1 - x0;
    const bh = y1 - y0;
    if (bw < 2 || bh < 2) return;
    const N = bw * bh;

    // 1) Veladuras: de a tres capas por lectura (una por canal, sumadas con 'lighter').
    const cv = document.createElement('canvas');
    cv.width = bw;
    cv.height = bh;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const peso = s.peso ?? 0.5;
    const capas = s.capas ?? 30;
    const aBase = 1 - Math.pow(1 - Math.min(peso, 0.98), 1 / capas);
    const base = deformar(pol, az, s.profBase ?? 2, rug * 0.5);
    const D = new Float32Array(N);
    const canales = ['#f00', '#0f0', '#00f'];
    for (let k = 0; k < capas; k += 3) {
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.globalCompositeOperation = 'source-over';
      cx.fillStyle = '#000';
      cx.fillRect(0, 0, bw, bh);
      cx.globalCompositeOperation = 'lighter';
      cx.setTransform(1, 0, 0, 1, -x0, -y0);
      const aa = [];
      for (let j = 0; j < 3 && k + j < capas; j++) {
        trazar(cx, deformar(base, az, s.prof ?? 3, rug * 0.26));
        cx.fillStyle = canales[j];
        cx.fill();
        aa.push(aBase * az.rango(0.6, 1.4));
      }
      const dat = cx.getImageData(0, 0, bw, bh).data;
      const n = aa.length;
      for (let i = 0, q = 0; i < N; i++, q += 4) {
        let d = D[i];
        const r = dat[q];
        if (r) d = 1 - (1 - d) * (1 - (aa[0] * r) / 255);
        if (n > 1) {
          const g = dat[q + 1];
          if (g) d = 1 - (1 - d) * (1 - (aa[1] * g) / 255);
        }
        if (n > 2) {
          const b = dat[q + 2];
          if (b) d = 1 - (1 - d) * (1 - (aa[2] * b) / 255);
        }
        D[i] = d;
      }
    }

    // 2) Borde oscuro de pigmento donde el agua se seca.
    const borde = s.borde ?? 0.6;
    if (borde > 0) {
      const M = new Float32Array(N);
      const corte = Math.max(0.004, peso * 0.22);
      for (let i = 0; i < N; i++) M[i] = clamp(D[i] / corte);
      const Bm = desenfocar(M, bw, bh, sigE);
      for (let i = 0; i < N; i++) {
        const w = M[i] * clamp((1 - Bm[i]) * 2);
        D[i] *= 1 + borde * w * w;
      }
    }

    // 3) Bordes que alternan duros (húmedo sobre seco) y suaves (húmedo sobre húmedo).
    const humedo = s.humedo ?? 0;
    const dur = s.duro ?? 0.5;
    const Ds = desenfocar(D, bw, bh, sigS);
    const sesgo = (dur - 0.5) * 0.7;
    const escalaRuido = 110 * E;
    for (let iy = 0; iy < bh; iy++) {
      for (let ix = 0; ix < bw; ix++) {
        const i = iy * bw + ix;
        const n = fbm((x0 + ix) / escalaRuido, (y0 + iy) / escalaRuido, semilla, 2);
        let t = suave(0.4 - sesgo, 0.6 - sesgo, n) * (1 - humedo);
        if (humedo > 0.99) t = 0;
        D[i] = Ds[i] + (D[i] - Ds[i]) * t;
      }
    }

    // 4) Blancos reservados: el papel queda limpio. `reservas` tiene borde nítido (nubes, brillos);
    //    `reservasBlandas`, borde difuso (el resplandor alrededor del sol).
    const aplicarReservas = (lista, sigma) => {
      if (!lista?.length) return;
      const cr = document.createElement('canvas');
      cr.width = bw;
      cr.height = bh;
      const cc = cr.getContext('2d', { willReadFrequently: true });
      cc.fillStyle = '#000';
      cc.fillRect(0, 0, bw, bh);
      cc.setTransform(1, 0, 0, 1, -x0, -y0);
      cc.fillStyle = '#fff';
      for (const r of lista) {
        const pr = resamplear(
          r.map(([x, y]) => [x * E, y * E]),
          14 * E,
        );
        trazar(cc, deformar(pr, az, 3, 0.2));
        cc.fill();
      }
      const dr = cc.getImageData(0, 0, bw, bh).data;
      const R = new Float32Array(N);
      for (let i = 0, q = 0; i < N; i++, q += 4) R[i] = dr[q] / 255;
      const Rb = desenfocar(R, bw, bh, sigma);
      for (let i = 0; i < N; i++) D[i] *= 1 - Rb[i];
    };
    aplicarReservas(s.reservas, (s.reservaSuave ?? 1.1) * E);
    aplicarReservas(s.reservasBlandas, (s.reservaBlanda ?? 40) * E);

    // 5) Pincel seco: el pigmento solo agarra en las crestas del papel.
    if (s.seco) {
      const { ang = 0, cerdas = 1, umbral = 0.5, largo = 1 } = s.seco;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      for (let iy = 0; iy < bh; iy++) {
        for (let ix = 0; ix < bw; ix++) {
          const i = iy * bw + ix;
          const X = x0 + ix;
          const Y = y0 + iy;
          const u = X * ca + Y * sa;
          const v = -X * sa + Y * ca;
          const n = ruido(u / (70 * E * largo), v / ((1.7 * E) / cerdas), semilla + 5);
          const g = (this.grano[Y * W + X] + 1) / 2;
          D[i] *= suave(umbral - 0.12, umbral + 0.12, n * 0.7 + g * 0.3);
        }
      }
    }

    // 6) Granulación: el pigmento se asienta en los valles del papel.
    const pigs = s.pigmentos.length === 1 ? [s.pigmentos[0], s.pigmentos[0]] : s.pigmentos;
    const gran = s.granulacion ?? 0.8;
    const ca = rgbDe(pigs[0]);
    const cb = rgbDe(pigs[1]);

    // 7) Variación de valor y temperatura, y gradiente de densidad.
    const mez = s.mezcla ?? { dir: [0, 1], fuerza: 0.5, ruido: 0.4 };
    const dl = Math.hypot(mez.dir[0], mez.dir[1]) || 1;
    const dxm = mez.dir[0] / dl;
    const dym = mez.dir[1] / dl;
    const cxm = (mnx + mxx) / 2;
    const cym = (mny + mxy) / 2;
    const Lm = Math.max(tam / 2, 1);
    let pmin = 0;
    let pmax = 1;
    const gr = s.grad;
    let gdx = 0;
    let gdy = 1;
    if (gr) {
      const gl = Math.hypot(gr.dir[0], gr.dir[1]) || 1;
      gdx = gr.dir[0] / gl;
      gdy = gr.dir[1] / gl;
      const p = [mnx * gdx + mny * gdy, mxx * gdx + mny * gdy, mnx * gdx + mxy * gdy, mxx * gdx + mxy * gdy];
      pmin = Math.min(...p);
      pmax = Math.max(...p);
    }
    const flujo = s.flujo ?? 0.22;
    const Rg = this.modo === 'papel';
    for (let iy = 0; iy < bh; iy++) {
      for (let ix = 0; ix < bw; ix++) {
        const i = iy * bw + ix;
        let d = D[i];
        if (d < 0.002) continue;
        const X = x0 + ix;
        const Y = y0 + iy;
        const pi = Y * W + X;
        d *= clamp(1 + gran * 0.36 * this.grano[pi], 0.55, 1.4);
        d *= 1 + flujo * 2 * (fbm(X / (85 * E), Y / (85 * E), semilla + 3, 3) - 0.5);
        if (gr) {
          const tg = clamp(((X * gdx + Y * gdy) - pmin) / (pmax - pmin || 1));
          d *= gr.desde + (gr.hasta - gr.desde) * tg;
        }
        let t =
          0.5 +
          0.5 * mez.fuerza * (((X - cxm) * dxm + (Y - cym) * dym) / Lm) +
          (fbm(X / (170 * E), Y / (170 * E), semilla + 9, 3) - 0.5) * (mez.ruido ?? 0.4) * 1.5;
        t = clamp(t);
        const cr = ca[0] + (cb[0] - ca[0]) * t;
        const cg = ca[1] + (cb[1] - ca[1]) * t;
        const cbl = ca[2] + (cb[2] - ca[2]) * t;
        D[i] = d;
        if (Rg) {
          const dd = d > 1.4 ? 1.4 : d;
          const o = pi * 3;
          this.rgb[o] *= Math.max(0, 1 - dd * (1 - cr));
          this.rgb[o + 1] *= Math.max(0, 1 - dd * (1 - cg));
          this.rgb[o + 2] *= Math.max(0, 1 - dd * (1 - cbl));
        } else {
          const aa = d > 1 ? 1 : d;
          const aDst = this.a[pi];
          const aOut = aa + aDst * (1 - aa);
          const o = pi * 3;
          this.rgb[o] = (cr * aa + this.rgb[o] * aDst * (1 - aa)) / aOut;
          this.rgb[o + 1] = (cg * aa + this.rgb[o + 1] * aDst * (1 - aa)) / aOut;
          this.rgb[o + 2] = (cbl * aa + this.rgb[o + 2] * aDst * (1 - aa)) / aOut;
          this.a[pi] = aOut;
        }
      }
    }
  }

  /**
   * Sangrado sobre húmedo: la pintura que ya estaba se corre hacia adentro de una zona.
   * Se hace antes de pintar encima, con la forma de la zona mojada.
   */
  mojar({ poly, radio = 6, cantidad = 0.6 }) {
    if (this.modo !== 'papel') return;
    const { E, W, H } = this;
    const az = new Azar(hashInt(this.semilla * 31 + ++this.contador * 7));
    const pol = deformar(
      poly.map(([x, y]) => [x * E, y * E]),
      az,
      2,
      0.2,
    );
    let mnx = 1e9;
    let mny = 1e9;
    let mxx = -1e9;
    let mxy = -1e9;
    for (const [x, y] of pol) {
      mnx = Math.min(mnx, x);
      mny = Math.min(mny, y);
      mxx = Math.max(mxx, x);
      mxy = Math.max(mxy, y);
    }
    const sig = radio * E;
    const m = Math.ceil(sig * 3 + 8 * E);
    const x0 = Math.max(0, Math.floor(mnx - m));
    const y0 = Math.max(0, Math.floor(mny - m));
    const x1 = Math.min(W, Math.ceil(mxx + m));
    const y1 = Math.min(H, Math.ceil(mxy + m));
    const bw = x1 - x0;
    const bh = y1 - y0;
    if (bw < 2 || bh < 2) return;
    const N = bw * bh;
    const cv = document.createElement('canvas');
    cv.width = bw;
    cv.height = bh;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.fillStyle = '#000';
    cx.fillRect(0, 0, bw, bh);
    cx.setTransform(1, 0, 0, 1, -x0, -y0);
    cx.fillStyle = '#fff';
    trazar(cx, pol);
    cx.fill();
    const dat = cx.getImageData(0, 0, bw, bh).data;
    const M = new Float32Array(N);
    for (let i = 0, q = 0; i < N; i++, q += 4) M[i] = dat[q] / 255;
    const Mb = desenfocar(M, bw, bh, sig * 0.8);
    for (let c = 0; c < 3; c++) {
      const canal = new Float32Array(N);
      for (let iy = 0; iy < bh; iy++) for (let ix = 0; ix < bw; ix++) canal[iy * bw + ix] = this.rgb[((y0 + iy) * W + x0 + ix) * 3 + c];
      const borroso = desenfocar(canal, bw, bh, sig);
      for (let iy = 0; iy < bh; iy++) {
        for (let ix = 0; ix < bw; ix++) {
          const i = iy * bw + ix;
          const o = ((y0 + iy) * W + x0 + ix) * 3 + c;
          const k = cantidad * Mb[i];
          this.rgb[o] = this.rgb[o] + (borroso[i] - this.rgb[o]) * k;
        }
      }
    }
  }

  /** Salpicaduras: gotas chicas con borde oscuro, desparramadas en una zona. */
  salpicar({ centro, radio, cantidad, pigmentos, peso = 0.55, tamano = [0.8, 2.4], semilla = 1 }) {
    const az = new Azar(hashInt(semilla * 911 + this.semilla));
    for (let i = 0; i < cantidad; i++) {
      const ang = az.rango(0, Math.PI * 2);
      const d = Math.sqrt(az.next()) * radio;
      const r = az.rango(tamano[0], tamano[1]);
      this.mancha({
        poly: elipse(centro[0] + Math.cos(ang) * d * 1.4, centro[1] + Math.sin(ang) * d * 0.7, r, r * az.rango(0.7, 1), 7),
        pigmentos,
        peso: peso * az.rango(0.6, 1.1),
        capas: 6,
        rugosidad: 0.25,
        borde: 1.1,
        anchoBorde: 0.8,
        suavidad: 0.5,
        duro: 0.8,
        granulacion: 0.5,
      });
    }
  }

  /** Multiplica la transparencia por una función (x, y) en px CSS. Sirve para disolver bordes. */
  disolver(fn) {
    const { E, W, H } = this;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) this.a[y * W + x] *= clamp(fn(x / E, y / E));
  }

  /** Vuelca el lienzo a un <canvas>. En modo papel agrega el grano del block. */
  aCanvas() {
    const { W, H } = this;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const papel = this.modo === 'papel';
    for (let i = 0, q = 0; i < W * H; i++, q += 4) {
      const k = papel ? 1 - 0.02 * this.grano[i] : 1;
      d[q] = clamp(this.rgb[i * 3] * 255 * k, 0, 255);
      d[q + 1] = clamp(this.rgb[i * 3 + 1] * 255 * k, 0, 255);
      d[q + 2] = clamp(this.rgb[i * 3 + 2] * 255 * k, 0, 255);
      d[q + 3] = clamp(this.a[i] * 255, 0, 255);
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}
