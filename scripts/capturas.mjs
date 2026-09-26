// Capturas de las pantallas en 1440×900 y 390×844, como pide la skill de diseño.
// Requiere: npm run db:start, node scripts/preparar-local.mjs --ejemplos,
// node e2e/fixtures/generar-planillas.mjs y npm run dev.
// Uso: npm run capturas [-- --solo=inicio,importar,efectos,personas,busqueda,indice,ficha,equipo,contrataciones,mensajes,juicio,cronologia,relaciones,documentos,ufed,diseno,acceso]
// La importación se hace en la primera pasada (1440); en la segunda solo se revisa.
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { pdfConImagen, pdfConTexto } from '../e2e/fixtures/pdf.mjs';

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

  const resto = ['inicio', 'importar', 'efectos', 'personas', 'busqueda', 'indice', 'ficha', 'equipo', 'contrataciones', 'mensajes', 'juicio', 'cronologia', 'relaciones', 'documentos', 'ufed'];
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
    if (quiero('juicio')) {
      await p.goto(`${causa}/juicio`);
      await p.getByRole('heading', { name: 'Preparación del juicio' }).waitFor();
      if (n === 0) {
        const vacio = p.getByText('Todavía no hay prueba ofrecida');
        if (await vacio.count()) await foto(p, 'juicio-vacio', t);
        await p.getByRole('button', { name: 'Sumar piezas', exact: true }).click();
        const dialogo = p.getByRole('dialog', { name: 'Sumar piezas del índice' });
        for (const titulo of ['Acta de allanamiento – DPV', 'Agenda 2021', 'Extracción de teléfono celular']) {
          const fila = dialogo.getByText(titulo, { exact: true });
          if (await fila.count()) await fila.click();
        }
        await foto(p, 'juicio-sumar', t);
        const sumar = dialogo.getByRole('button', { name: /^Sumar/ });
        if (await sumar.isEnabled()) await sumar.click();
        else await p.keyboard.press('Escape');
        await p.getByRole('button', { name: 'Testigos o peritos', exact: true }).click();
        const personas = p.getByRole('dialog', { name: 'Sumar testigos o peritos' });
        const testigo = personas.getByText('Testigo Ejemplo Local');
        if (await testigo.count()) {
          await testigo.click();
          await personas.getByRole('button', { name: /^Sumar/ }).click();
        } else await p.keyboard.press('Escape');
      }
      await p.getByRole('region', { name: 'Documental' }).waitFor();
      await foto(p, 'juicio', t);
      await medir('juicio');
      await p.getByRole('row', { name: /Extracción de teléfono celular/ }).click();
      await p.getByRole('complementary', { name: 'Ficha del ofrecimiento' }).waitFor();
      await foto(p, 'juicio-ficha', t);
      await p.keyboard.press('Escape');
      await p.getByRole('button', { name: /^Exportar/ }).click();
      await p.getByRole('menuitem', { name: /Listado para la remisión/ }).click();
      await p.getByRole('dialog', { name: 'Listado de prueba' }).waitFor();
      await foto(p, 'juicio-listado', t);
      await p.keyboard.press('Escape');
    }
    if (quiero('cronologia')) {
      await p.goto(`${causa}/cronologia`);
      await p.getByRole('heading', { name: 'Cronología', exact: true }).waitFor();
      if (n === 0) {
        await p.getByRole('button', { name: 'Acto procesal' }).click();
        const d = p.getByRole('dialog', { name: 'Nuevo acto procesal' });
        await d.getByLabel('Qué pasó').fill('Audiencia de control de la acusación (ejemplo local)');
        await d.getByLabel('Fecha', { exact: true }).fill('2026-03-15');
        await foto(p, 'cronologia-acto', t);
        await d.getByRole('button', { name: 'Cargar' }).click();
        await p.getByText('Audiencia de control de la acusación (ejemplo local)').waitFor();
      }
      await foto(p, 'cronologia', t);
      await medir('cronologia');
      if (n === 0) {
        await p.emulateMedia({ media: 'print' });
        await foto(p, 'cronologia-impresion', t, true);
        await p.pdf({ path: `${SALIDA}/cronologia.pdf`, format: 'A4', printBackground: true });
        await p.emulateMedia({ media: 'screen' });
      }
    }
    if (quiero('relaciones')) {
      await p.goto(`${causa}/personas?vista=relaciones`);
      await p.getByRole('complementary', { name: 'Relaciones en lista' }).or(p.getByText('Todavía no hay relaciones para dibujar')).first().waitFor();
      if (n === 0) {
        await p.getByRole('button', { name: 'Nueva relación' }).click();
        const d = p.getByRole('dialog', { name: 'Nueva relación' });
        await d.getByLabel('Entre').selectOption({ label: 'Testigo Ejemplo Local' });
        await d.getByLabel('Y', { exact: true }).selectOption({ label: 'Proveedora Ejemplo SRL' });
        await d.getByLabel('Qué relación tienen').fill('Empleado (ejemplo local)');
        await d.getByLabel('De dónde surge').fill('Recibos de sueldo, efecto Nº 48436 (ejemplo local)');
        await foto(p, 'relaciones-nueva', t);
        await d.getByRole('button', { name: 'Cargar relación' }).click();
        const repetida = d.getByText(/Ya hay una relación cargada/);
        await Promise.race([d.waitFor({ state: 'hidden' }), repetida.waitFor()]);
        if (await repetida.count()) await p.keyboard.press('Escape');
      }
      await p.waitForTimeout(400);
      await foto(p, 'relaciones', t);
      await medir('relaciones');
      const nodo = p.getByRole('button', { name: /Persona: Imputado Ejemplo Local/ });
      if (await nodo.count()) {
        await nodo.click();
        await p.getByRole('complementary', { name: /Ficha de Imputado Ejemplo Local/ }).waitFor();
        await p.waitForTimeout(400);
        await foto(p, 'relaciones-ficha', t);
        await p.keyboard.press('Escape');
      }
    }
    if (quiero('documentos')) {
      await p.goto(`${causa}/documentos`);
      await p.getByRole('heading', { name: 'Documentos y escaneos' }).waitFor();
      if (n === 0) {
        await foto(p, 'documentos-vacio', t);
        // Una carpeta «EFECTO 48435» (el efecto de ejemplo) con un PDF con texto y otro que es solo imagen. Todo inventado.
        const jpeg = await p.evaluate(() => {
          const c = document.createElement('canvas');
          c.width = 1240;
          c.height = 1754;
          const x = c.getContext('2d');
          x.fillStyle = '#fff';
          x.fillRect(0, 0, c.width, c.height);
          x.fillStyle = '#111';
          x.font = '44px Arial';
          ['REMITO N° 0002-00001234 (ejemplo local)', 'Proveedora Ejemplo SRL', 'Entrega de materiales viales', 'Licitación Pública LP 99/2026', 'Firma y aclaración del receptor'].forEach((l, i) =>
            x.fillText(l, 110, 200 + i * 90),
          );
          return c.toDataURL('image/jpeg', 0.92).split(',')[1];
        });
        const carpeta = `${SALIDA}/escaneos/EFECTO 48435`;
        mkdirSync(carpeta, { recursive: true });
        writeFileSync(`${carpeta}/Remito escaneado (ejemplo).pdf`, pdfConImagen(Buffer.from(jpeg, 'base64'), 1240, 1754));
        writeFileSync(
          `${carpeta}/Compras de ejemplo.pdf`,
          pdfConTexto([
            ['Compras de ejemplo local', 'Factura B 0024-00004850', 'Referencia: Licitación Pública LP 99/2026', 'Constructora Ejemplo SA'],
            ['Segunda hoja del documento de ejemplo', 'Detalle de materiales entregados en la planta'],
          ]),
        );
        await p.locator('input[aria-label="Elegir una carpeta para leer"]').setInputFiles(carpeta);
        await p.getByText('Lectura terminada').waitFor({ timeout: 120000 });
      }
      await foto(p, 'documentos', t);
      await medir('documentos');
      await p.getByRole('button', { name: /^Sugerencias/ }).click();
      await p.waitForTimeout(300);
      await foto(p, 'documentos-sugerencias', t);
      await medir('documentos sugerencias');
      await p.getByRole('button', { name: 'Documentos', exact: true }).click();
      const fila = p.getByRole('row', { name: /Remito escaneado/ }).first();
      await fila.waitFor({ timeout: 10000 }).catch(() => undefined);
      if (await fila.count()) {
        await fila.click();
        await p.getByRole('complementary', { name: /Ficha del documento/ }).waitFor();
        await foto(p, 'documentos-ficha', t);
        await p.keyboard.press('Escape');
      }
      await p.getByRole('button', { name: 'Traer texto de AppUFIL' }).click();
      await p.getByRole('dialog', { name: 'Traer texto de AppUFIL' }).waitFor();
      await foto(p, 'documentos-appufil', t);
      await p.keyboard.press('Escape');
    }
    if (quiero('ufed')) {
      await p.goto(`${causa}/importar-conversacion`);
      await p.getByRole('heading', { name: 'Importar una conversación' }).waitFor();
      await p.locator('input[type=file]').setInputFiles(`${PLANILLAS}/reporte-ufed-prueba.xlsx`);
      await p.getByRole('list', { name: 'Chats del reporte' }).waitFor();
      await foto(p, 'ufed-chats', t, true);
      await medir('ufed');
      await p.getByRole('button', { name: 'Revisar este chat' }).first().click();
      await p.getByText('Revisión').first().waitFor();
      await foto(p, 'ufed-revision', t);
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
