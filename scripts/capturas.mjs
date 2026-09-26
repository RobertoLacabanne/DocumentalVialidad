// Capturas de las pantallas en 1440×900 y 390×844, como pide la skill de diseño.
// Requiere: npm run db:start, node scripts/preparar-local.mjs --ejemplos y npm run dev.
// Uso: npm run capturas [-- --solo=diseno,indice]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const SALIDA = 'capturas';
const solo = (process.argv.find((a) => a.startsWith('--solo=')) ?? '').replace('--solo=', '').split(',').filter(Boolean);
const quiero = (n) => !solo.length || solo.includes(n);
mkdirSync(SALIDA, { recursive: true });

const TAMANOS = [
  { nombre: '1440', viewport: { width: 1440, height: 900 } },
  { nombre: '390', viewport: { width: 390, height: 844 } },
];

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });

async function entrar(pagina) {
  await pagina.goto(BASE + '/');
  await pagina.getByLabel('Correo').fill('rober@ejemplo.test');
  await pagina.getByLabel('Contraseña').fill('clave-local-123');
  await pagina.getByRole('button', { name: 'Entrar con correo' }).click();
  await pagina.getByRole('heading', { name: 'Índice de prueba' }).waitFor({ timeout: 15000 });
}

for (const t of TAMANOS) {
  const contexto = await navegador.newContext({ viewport: t.viewport, deviceScaleFactor: 1 });
  const p = await contexto.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));

  if (quiero('diseno')) {
    await p.goto(BASE + '/diseno');
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${SALIDA}/diseno-${t.nombre}.png`, fullPage: true });
  }
  if (quiero('acceso')) {
    await p.goto(BASE + '/');
    await p.getByRole('button', { name: 'Entrar con Google' }).waitFor();
    await p.screenshot({ path: `${SALIDA}/acceso-${t.nombre}.png` });
  }
  if (quiero('indice') || quiero('ficha') || quiero('equipo')) {
    await entrar(p);
    await p.waitForTimeout(800);
    if (quiero('indice')) await p.screenshot({ path: `${SALIDA}/indice-${t.nombre}.png` });
    if (quiero('ficha')) {
      await p.getByText('Agenda 2021').first().click();
      await p.getByRole('complementary', { name: /Ficha de la pieza/ }).waitFor();
      await p.waitForTimeout(500);
      await p.screenshot({ path: `${SALIDA}/ficha-${t.nombre}.png` });
      await p.getByRole('button', { name: 'Editar' }).click();
      await p.waitForTimeout(300);
      await p.screenshot({ path: `${SALIDA}/ficha-edicion-${t.nombre}.png` });
      await p.keyboard.press('Escape');
    }
    if (quiero('equipo')) {
      await p.goto(p.url().replace(/\/indice.*$/, '/equipo'));
      await p.getByRole('heading', { name: 'Quiénes trabajan en el tablero' }).waitFor();
      await p.screenshot({ path: `${SALIDA}/equipo-${t.nombre}.png` });
      await p.goto(p.url().replace(/\/equipo.*$/, '/efectos'));
      await p.waitForTimeout(300);
      await p.screenshot({ path: `${SALIDA}/proximamente-${t.nombre}.png` });
    }
  }

  const anchoDoc = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log(`${t.nombre}: ancho del documento ${anchoDoc}px${anchoDoc > t.viewport.width ? ' ← SCROLL HORIZONTAL' : ''}`);
  if (errores.length) console.log(`${t.nombre}: errores en consola:\n  ${errores.join('\n  ')}`);
  await contexto.close();
}

await navegador.close();
console.log(`Capturas en ./${SALIDA}`);
