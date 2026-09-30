// Arma el PDF del manual de uso a partir de docs/manual/manual.html.
// Uso: node scripts/manual-pdf.mjs   (las capturas salen de scripts/capturas-manual.mjs)
import { chromium } from '@playwright/test';
import { mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SALIDA = 'public/manual/Manual-Tablero-de-Prueba.pdf';
mkdirSync('public/manual', { recursive: true });
const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
const p = await navegador.newPage();
await p.emulateMedia({ media: 'print' });
await p.goto(pathToFileURL(resolve('docs/manual/manual.html')).href, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.pdf({
  path: SALIDA,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
});
await navegador.close();
console.log(SALIDA, Math.round(statSync(SALIDA).size / 1024), 'KB');
