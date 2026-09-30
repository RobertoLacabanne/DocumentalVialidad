// Hornea las ilustraciones: abre el laboratorio (herramientas/ilustraciones/lab.html) con Chromium,
// pinta cada pieza con su semilla y escribe public/ilustraciones/<id>-v<N>.webp y <id>-v<N>@2x.webp.
// Los archivos horneados se commitean: el build no depende de Playwright ni de generar nada.
// Uso: npm run ilustraciones [-- --solo=bajada,hilo-bajada] [--previas=carpeta]
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const RAIZ = process.cwd();
const SALIDA = join(RAIZ, 'public', 'ilustraciones');
const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? '').split('=').slice(1).join('=');
const solo = arg('solo').split(',').filter(Boolean);
const previas = arg('previas');
mkdirSync(SALIDA, { recursive: true });
if (previas) mkdirSync(previas, { recursive: true });

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json' };
const servidor = createServer((req, res) => {
  const ruta = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const archivo = join(RAIZ, ruta);
  try {
    if (!archivo.startsWith(RAIZ) || !statSync(archivo).isFile()) throw new Error('no');
    res.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream' });
    res.end(readFileSync(archivo));
  } catch {
    res.writeHead(404);
    res.end('no está');
  }
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const puerto = servidor.address().port;

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
const p = await navegador.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', (e) => console.error('error en el laboratorio:', e.message));
await p.goto(`http://127.0.0.1:${puerto}/herramientas/ilustraciones/lab.html`);
await p.waitForFunction(() => window.PIEZAS_IDS);
const ids = (await p.evaluate(() => window.PIEZAS_IDS)).filter((id) => !solo.length || solo.includes(id));

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
let total1x = 0;
for (const id of ids) {
  const r = await p.evaluate((i) => window.hornear(i), id);
  const base = `${id}-v${r.version}`;
  for (const f of readdirSync(SALIDA)) if (f.startsWith(`${id}-v`) && f.endsWith('.webp')) rmSync(join(SALIDA, f));
  writeFileSync(join(SALIDA, `${base}.webp`), Buffer.from(r.x1.split(',')[1], 'base64'));
  writeFileSync(join(SALIDA, `${base}@2x.webp`), Buffer.from(r.x2.split(',')[1], 'base64'));
  if (previas) writeFileSync(join(previas, `${id}.png`), Buffer.from(r.previa.split(',')[1], 'base64'));
  total1x += r.b1;
  console.log(`${id}  v${r.version}  ${r.ancho}×${r.alto}  1x ${kb(r.b1)} (calidad ${r.calidad.toFixed(2)})  2x ${kb(r.b2)}  pintado en ${(r.ms / 1000).toFixed(1)} s`);
}
const compuesta = arg('compuesta');
if (compuesta && previas) {
  const png = await p.evaluate((l) => window.compuesta(l), compuesta.split('+'));
  writeFileSync(join(previas, 'compuesta.png'), Buffer.from(png.split(',')[1], 'base64'));
}
if (compuesta && previas) {
  const png = await p.evaluate((l) => window.entrecerrada(l), compuesta.split('+'));
  writeFileSync(join(previas, 'entrecerrada.png'), Buffer.from(png.split(',')[1], 'base64'));
}
const cmp = await p.evaluate(() => window.__comparacion);
console.log(`Punzó vs lacre: ΔE ${cmp.dE.toFixed(1)}, matiz ${cmp.matizPunzo.toFixed(0)}° vs ${cmp.matizLacre.toFixed(0)}°`);
console.log(`Total a 1x de lo horneado ahora: ${kb(total1x)}`);
await navegador.close();
servidor.close();
