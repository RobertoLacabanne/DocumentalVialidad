// Capturas de las pantallas en 1440×900 y 390×844, como pide la skill de diseño.
// Requiere: npm run db:start, node scripts/preparar-local.mjs --ejemplos,
// node e2e/fixtures/generar-planillas.mjs y npm run dev.
// Uso: npm run capturas [-- --solo=inicio,importar,efectos,personas,busqueda,indice,ficha,equipo,contrataciones,mensajes,diseno,acceso]
// La importación se hace en la primera pasada (1440); en la segunda solo se revisa.
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const SALIDA = 'capturas';
const PLANILLAS = 'e2e/fixtures/generadas';
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
  await pagina.getByText('Avance de los efectos').waitFor({ timeout: 15000 });
  return pagina.url().replace(/\/inicio.*$/, '');
}

async function foto(p, nombre, t, completa = false) {
  await p.waitForTimeout(450);
  await p.screenshot({ path: `${SALIDA}/${nombre}-${t.nombre}.png`, fullPage: completa });
}

async function importar(p, causa, archivo, confirmar, t, prefijo) {
  await p.goto(`${causa}/importar`);
  await p.locator('input[type=file]').setInputFiles(`${PLANILLAS}/${archivo}`);
  await p.getByText(archivo).waitFor();
  if (prefijo) await foto(p, `${prefijo}-1-planilla`, t);
  await p.getByRole('button', { name: /Seguir: revisar columnas/ }).click();
  if (prefijo) await foto(p, `${prefijo}-2-columnas`, t, true);
  await p.getByRole('button', { name: /Seguir: ver qué entra/ }).click();
  await p.getByText('filas con datos en la planilla').waitFor();
  if (prefijo) await foto(p, `${prefijo}-3-revision`, t, true);
  if (!confirmar) return;
  const boton = p.getByRole('button', { name: /^Importar \d+ efectos?$/ });
  if (await boton.count()) {
    await boton.click();
    await p.getByText(/importados?$/).first().waitFor();
    if (prefijo) await foto(p, `${prefijo}-4-listo`, t);
  }
}

for (const [n, t] of TAMANOS.entries()) {
  const contexto = await navegador.newContext({ viewport: t.viewport, deviceScaleFactor: 1 });
  const p = await contexto.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  let maximo = 0;
  const medir = async (donde) => {
    const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
    if (ancho > t.viewport.width) console.log(`${t.nombre}: SCROLL HORIZONTAL en ${donde} (${ancho}px)`);
    maximo = Math.max(maximo, ancho);
  };

  if (quiero('diseno')) {
    await p.goto(BASE + '/diseno');
    await foto(p, 'diseno', t, true);
  }
  if (quiero('acceso')) {
    await p.goto(BASE + '/');
    await p.getByRole('button', { name: 'Entrar con Google' }).waitFor();
    await foto(p, 'acceso', t);
  }

  const resto = ['inicio', 'importar', 'efectos', 'personas', 'busqueda', 'indice', 'ficha', 'equipo', 'contrataciones', 'mensajes'];
  if (resto.some(quiero)) {
    const causa = await entrar(p);

    if (quiero('importar')) {
      if (!existsSync(`${PLANILLAS}/efectos-dispositivos-prueba.xlsx`)) throw new Error('Falta generar las planillas: node e2e/fixtures/generar-planillas.mjs');
      await importar(p, causa, 'efectos-dispositivos-prueba.xlsx', n === 0, t, 'importar');
      await medir('importar');
      if (n === 0) await importar(p, causa, 'efectos-papel-prueba.xlsx', true, t, null);
    }
    if (quiero('inicio')) {
      await p.goto(`${causa}/inicio`);
      await p.getByText('Avance de los efectos').waitFor();
      await foto(p, 'inicio', t, true);
      await medir('inicio');
    }
    if (quiero('efectos')) {
      await p.goto(`${causa}/efectos`);
      await p.getByRole('heading', { name: 'Efectos secuestrados' }).waitFor();
      await p.getByRole('button', { name: 'Tablero' }).click();
      await foto(p, 'efectos-tablero', t);
      await medir('efectos tablero');
      await p.getByRole('button', { name: 'Por allanamiento' }).click();
      await foto(p, 'efectos-tabla', t);
      await medir('efectos tabla');
      const fila = p.locator('[data-efecto="90001"]').first();
      if (await fila.count()) {
        await fila.click();
        await p.getByRole('complementary', { name: /Ficha del efecto/ }).waitFor();
        await foto(p, 'efecto-ficha', t);
        await p.keyboard.press('Escape');
      }
    }
    if (quiero('personas')) {
      await p.goto(`${causa}/personas`);
      await p.getByRole('heading', { name: 'Personas y empresas' }).waitFor();
      await foto(p, 'personas', t);
      await medir('personas');
      const agregar = p.getByRole('button', { name: 'Agregar', exact: true }).first();
      if (await agregar.count()) {
        await agregar.click();
        await foto(p, 'personas-sugerencia', t);
        await p.keyboard.press('Escape');
      }
    }
    if (quiero('busqueda')) {
      await p.goto(`${causa}/inicio`);
      await p.getByText('Avance de los efectos').waitFor();
      await p.keyboard.press('Control+k');
      await p.getByPlaceholder(/Buscá un Nº de efecto/).fill('Imaginaria');
      await p.getByRole('option').first().waitFor({ timeout: 5000 }).catch(() => {});
      await foto(p, 'busqueda', t);
      await p.keyboard.press('Escape');
    }
    if (quiero('indice') || quiero('ficha')) {
      await p.goto(`${causa}/indice`);
      await p.getByRole('heading', { name: 'Índice de prueba' }).waitFor();
      if (quiero('indice')) {
        await foto(p, 'indice', t);
        await medir('indice');
      }
      if (quiero('ficha')) {
        await p.getByText('Agenda 2021').first().click();
        await p.getByRole('complementary', { name: /Ficha de la pieza/ }).waitFor();
        await foto(p, 'ficha', t);
        await p.getByRole('button', { name: 'Editar' }).click();
        await foto(p, 'ficha-edicion', t);
        await p.keyboard.press('Escape');
      }
    }
    if (quiero('contrataciones')) {
      await p.goto(`${causa}/importar-contrataciones`);
      await p.locator('input[type=file]').setInputFiles(`${PLANILLAS}/contrataciones-prueba.xlsx`);
      await p.getByText('contrataciones-prueba.xlsx').waitFor();
      await foto(p, 'contrataciones-importar-1', t);
      const seguir = p.getByRole('button', { name: /Seguir: revisar/ });
      if (await seguir.isEnabled()) {
        await seguir.click();
        await foto(p, 'contrataciones-importar-2', t, true);
        if (n === 0) {
          await p.getByLabel(/Presupuesto oficial: /).first().check();
          await p.getByRole('button', { name: /^Importar \d+ contratac/ }).click();
          await p.getByText(/importadas?$/).first().waitFor();
          await foto(p, 'contrataciones-importar-3', t);
        }
      }
      await medir('importar contrataciones');
      await p.goto(`${causa}/contrataciones`);
      await p.getByRole('heading', { name: 'Contrataciones', exact: true }).waitFor();
      await foto(p, 'contrataciones', t);
      await p.getByRole('button', { name: /LP 90001\/2020/ }).first().click();
      await p.getByRole('heading', { name: 'LP 90001/2020' }).waitFor();
      await foto(p, 'contratacion', t);
      await foto(p, 'contratacion-completa', t, true);
      await medir('contratacion');
      await p.getByRole('row', { name: /Proveedora Ejemplo/ }).click();
      await p.getByRole('dialog', { name: 'Oferta' }).waitFor();
      await foto(p, 'contratacion-oferta', t);
      await p.keyboard.press('Escape');
    }
    if (quiero('mensajes')) {
      if (n === 0) {
        await p.goto(`${causa}/importar-conversacion`);
        await p.locator('input[type=file]').setInputFiles(`${PLANILLAS}/conversacion-prueba.docx`);
        await p.getByText('mensajes detectados').first().waitFor();
        await foto(p, 'conversacion-importar', t, true);
        await p.getByRole('button', { name: /^Importar \d+ mensajes?$/ }).click();
        await p.getByText(/mensajes importados$/).waitFor();
        await p.getByRole('link', { name: /Abrir la conversación/ }).click();
      } else {
        await p.goto(`${causa}/mensajes`);
        await p.getByRole('button', { name: /Conversación entre Ficticio y Muestra/ }).first().click();
      }
      await p.getByRole('region', { name: /Conversación entre Ficticio y Muestra/ }).waitFor();
      await p.waitForTimeout(400);
      if (n === 0) {
        const burbuja = p.getByRole('button', { name: /Mensaje de Ficticio/ }).first();
        await burbuja.hover();
        await p.getByRole('button', { name: 'Marcar como relevante' }).first().click();
      }
      await foto(p, 'mensajes', t);
      await medir('mensajes');
      await p.getByRole('button', { name: /Mensaje de Ficticio/ }).first().click();
      await p.getByRole('complementary', { name: 'Ficha del mensaje' }).waitFor();
      if (n === 0) {
        await p.getByLabel('Contratación a vincular').selectOption({ label: 'LP 90001/2020 · Expte. 90500' });
        await p.getByRole('button', { name: 'Vincular', exact: true }).first().click();
        await p.getByText('Vinculado a LP 90001/2020.').waitFor();
      }
      await foto(p, 'mensaje-ficha', t);
      await p.keyboard.press('Escape');
      await p.getByRole('button', { name: 'Datos de la conversación' }).click();
      await p.getByRole('complementary', { name: 'Datos de la conversación' }).waitFor();
      await foto(p, 'conversacion-datos', t);
      await p.keyboard.press('Escape');
      await p.getByRole('button', { name: 'Informe .docx' }).click();
      await p.getByRole('dialog', { name: 'Informe de relevamiento de mensajes' }).waitFor();
      await foto(p, 'informe', t);
      await p.keyboard.press('Escape');
    }
    if (quiero('equipo')) {
      await p.goto(`${causa}/equipo`);
      await p.getByRole('heading', { name: 'Quiénes trabajan en el tablero' }).waitFor();
      await foto(p, 'equipo', t, true);
      await medir('equipo');
    }
  }

  console.log(`${t.nombre}: ancho máximo del documento ${maximo || '(sin medir)'}px`);
  if (errores.length) console.log(`${t.nombre}: errores en consola:\n  ${[...new Set(errores)].join('\n  ')}`);
  await contexto.close();
}

await navegador.close();
console.log(`Capturas en ./${SALIDA}`);
