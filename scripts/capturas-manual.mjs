// Capturas del manual de uso, con la causa de ejemplo inventada (scripts/preparar-manual.mjs).
// Requiere el Supabase local preparado y `npm run dev`. Guarda JPEG livianos en public/manual/img (se publican: solo datos inventados).
// Uso: node scripts/capturas-manual.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pdfConImagen, pdfConTexto } from '../e2e/fixtures/pdf.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const SALIDA = 'public/manual/img';
mkdirSync(SALIDA, { recursive: true });
const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await contexto.newPage();
const fallas = [];

async function foto(nombre, completa = false) {
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${SALIDA}/${nombre}.jpg`, type: 'jpeg', quality: 78, fullPage: completa });
  console.log('captura', nombre);
}
async function paso(nombre, fn) {
  try {
    await fn();
  } catch (e) {
    fallas.push(nombre);
    console.warn('no salió', nombre, e.message.split('\n')[0]);
  }
}

await p.goto(BASE + '/');
await p.getByLabel('Correo').fill('rober@ejemplo.test');
await p.getByLabel('Contraseña').fill('clave-local-123');
await p.getByRole('button', { name: 'Entrar con correo' }).click();
await p.getByText('Avance de los efectos').waitFor({ timeout: 15000 });
const causa = p.url().replace(/\/inicio.*$/, '');
const ir = async (ruta) => {
  await p.goto(`${causa}/${ruta}`);
  await p.waitForLoadState('networkidle');
};

await paso('inicio', async () => {
  await ir('inicio');
  await foto('02-inicio');
});
await paso('indice', async () => {
  await ir('indice');
  await p.getByText('Agenda 2021 con anotaciones de precios').waitFor();
  await foto('03-indice');
  await p.getByText('Agenda 2021 con anotaciones de precios').click();
  await foto('04-ficha-pieza');
});
await paso('efectos', async () => {
  await ir('efectos');
  await p.getByRole('button', { name: 'Tablero' }).click();
  await foto('05-efectos-tablero');
  await p.getByRole('button', { name: 'Por allanamiento' }).click();
  await foto('06-efectos-allanamiento');
  await p.locator('[data-efecto="20001"]').first().click();
  await foto('07-ficha-efecto');
});
await paso('documentos', async () => {
  await ir('documentos');
  const jpeg = await p.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1240;
    c.height = 1754;
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#111';
    x.font = '44px Arial';
    ['REMITO N° 0002-00001234', 'Comercio Supuesto S.R.L.', 'Entrega de repuestos', 'Licitación Pública LP 01/2021', 'Firma y aclaración del receptor'].forEach((l, i) => x.fillText(l, 110, 200 + i * 90));
    return c.toDataURL('image/jpeg', 0.92).split(',')[1];
  });
  const carpeta = 'capturas/manual/EFECTO 10002';
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(`${carpeta}/Remito escaneado.pdf`, pdfConImagen(Buffer.from(jpeg, 'base64'), 1240, 1754));
  writeFileSync(`${carpeta}/Factura 0001-00000123.pdf`, pdfConTexto([['Factura 0001-00000123', 'Comercio Supuesto S.R.L. – CUIT 30-11111111-1', 'Referencia: Licitación Pública LP 01/2021', 'Total: $ 1.180.000'], ['Detalle de repuestos entregados']]));
  await p.locator('input[aria-label="Elegir una carpeta para leer"]').setInputFiles(carpeta);
  await p.getByText('Lectura terminada').waitFor({ timeout: 180000 });
  await foto('08-documentos');
  await p.getByRole('button', { name: /^Sugerencias/ }).click();
  await foto('09-sugerencias');
});
await paso('contrataciones', async () => {
  await ir('contrataciones');
  await p.locator('nav[aria-label="Contrataciones de la causa"] button').filter({ hasText: 'LP 01/2021' }).first().click();
  await p.getByRole('article').waitFor();
  await foto('10-contratacion');
  await p.getByRole('article').hover();
  await p.mouse.wheel(0, 760);
  await foto('11-contratacion-tramite');
});
await paso('personas', async () => {
  await ir('personas');
  await foto('12-personas');
  await p.getByText('Pedro Muestra', { exact: true }).first().click();
  await foto('13-ficha-persona');
  await ir('personas?vista=relaciones');
  await p.waitForTimeout(3500);
  await foto('14-relaciones');
});
await paso('mensajes', async () => {
  await ir('mensajes');
  await p.getByText('Conversación entre Laura Ejemplo y Pedro Muestra').first().click();
  await p.waitForTimeout(800);
  await foto('15-mensajes');
  await p.getByText('Mañana te llega la invitación de la licitación 01', { exact: false }).first().click();
  await foto('16-ficha-mensaje');
  await p.keyboard.press('Escape');
  await p.getByRole('button', { name: 'Informe .docx' }).click();
  await foto('17-informe');
  await p.keyboard.press('Escape');
});
await paso('cronologia', async () => {
  await ir('cronologia');
  await foto('18-cronologia');
});
await paso('juicio', async () => {
  await ir('juicio');
  await foto('19-juicio');
});
await paso('busqueda', async () => {
  await ir('inicio');
  await p.keyboard.press('Control+k');
  await p.getByPlaceholder(/Buscá un Nº de efecto/).fill('invitación');
  await p.waitForTimeout(1200);
  await foto('20-busqueda');
  await p.keyboard.press('Escape');
});
await paso('equipo', async () => {
  await ir('equipo');
  await foto('21-equipo');
});
await paso('celular', async () => {
  await p.setViewportSize({ width: 390, height: 844 });
  await ir('inicio');
  await foto('22-celular-inicio');
  await ir('contrataciones');
  await p.locator('nav[aria-label="Contrataciones de la causa"] button').filter({ hasText: 'LP 01/2021' }).first().click();
  await foto('23-celular-contratacion');
});

await navegador.close();
if (fallas.length) {
  console.error('Faltaron:', fallas.join(', '));
  process.exit(1);
}
