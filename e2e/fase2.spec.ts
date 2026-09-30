import { expect, test, type Browser, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Fase 2: importar contrataciones y una conversación, marcar mensajes
// relevantes con otra persona mirando, vincularlos y sacar el informe.

const CLAVE = 'clave-local-123';

async function entrar(browser: Browser, email: string): Promise<Page> {
  const contexto = await browser.newContext({ acceptDownloads: true });
  const pagina = await contexto.newPage();
  await pagina.goto('/');
  await pagina.getByLabel('Correo').fill(email);
  await pagina.getByLabel('Contraseña').fill(CLAVE);
  await pagina.getByRole('button', { name: 'Entrar con correo' }).click();
  await expect(pagina.getByText('Avance de los efectos')).toBeVisible();
  return pagina;
}

const irA = (p: Page, seccion: string) => p.getByRole('navigation', { name: 'Secciones de la causa' }).getByRole('link', { name: seccion }).click();

test('contrataciones, mensajes relevantes e informe de relevamiento', async ({ browser }) => {
  // Identificadores distintos en cada corrida, para repetir la prueba sobre la misma base.
  const base = 400000 + (Date.now() % 90000) * 10;
  const lp = `LP ${base + 1}/2020`;
  const carpeta = mkdtempSync(join(tmpdir(), 'fase2-'));
  execFileSync('node', ['e2e/fixtures/generar-planillas.mjs', carpeta, `--base=${base}`]);

  const rober = await entrar(browser, 'rober@ejemplo.test');
  const ines = await entrar(browser, 'ines@ejemplo.test');

  // 1. La planilla entra con su trámite; los montos escritos son sugerencias.
  await irA(rober, 'Contrataciones');
  await rober.getByRole('link', { name: 'Importar planilla' }).first().click();
  await rober.locator('input[type=file]').setInputFiles(join(carpeta, 'contrataciones-prueba.xlsx'));
  await expect(rober.getByText('2 contrataciones encontradas · 1 hoja sin trámite')).toBeVisible();
  await rober.getByRole('button', { name: /Seguir: revisar/ }).click();
  await expect(rober.getByLabel(`Identificador de la hoja LP ${base + 1}_2020`)).toHaveValue(lp);
  await expect(rober.getByText(/Excel no admite «\/»/).first()).toBeVisible();
  await expect(rober.getByLabel(/Presupuesto oficial: /)).not.toBeChecked();
  await rober.getByLabel(/Presupuesto oficial: /).check();
  await rober.getByLabel(/Oferta de Comercio Supuesto/).check();
  await rober.getByRole('button', { name: 'Importar 2 contrataciones' }).click();
  await expect(rober.getByRole('heading', { name: '2 contrataciones importadas' })).toBeVisible();
  await expect(rober.getByText(`${lp}: 9 pasos y 3 ofertas`)).toBeVisible();

  // La ficha muestra el trámite a fojas, con la fecha ambigua tal cual.
  await rober.getByRole('link', { name: 'Ver las contrataciones' }).click();
  await rober.getByRole('button', { name: new RegExp(lp.replace('/', '\\/')) }).click();
  const ficha = rober.getByRole('article', { name: `Contratación ${lp}` });
  await expect(ficha.getByText('entre el 11 y 17/3/2020')).toBeVisible();
  await expect(ficha.getByText('$ 16.163.917,90').first()).toBeVisible();
  const ofertas = ficha.getByRole('region', { name: 'Cuadro de ofertas' });
  await expect(ofertas.getByRole('row', { name: /Comercio Supuesto/ })).toContainText('$ 17.951.672,50');
  await expect(ofertas.getByRole('row', { name: /Empresa Imaginaria/ })).toContainText('[completar]');

  // Se completa un monto a mano, escrito como en el expediente.
  await ofertas.getByRole('row', { name: /Empresa Imaginaria/ }).click();
  const monto = rober.getByRole('dialog', { name: 'Oferta' }).locator('[data-campo="monto"] input');
  await monto.fill('18.415.263');
  await monto.press('Enter');
  await rober.getByRole('button', { name: 'Listo' }).click();
  await expect(ofertas.getByRole('row', { name: /Empresa Imaginaria/ })).toContainText('$ 18.415.263,00');
  await expect(ofertas.getByRole('row', { name: /Comercio Supuesto/ })).toContainText('menor oferta');

  // Las observaciones del analista y la apertura se leen sin entrar a editar.
  await ficha.getByRole('button', { name: 'Editar datos' }).click();
  await ficha.locator('[data-campo="fecha_apertura"] input').fill('2020-08-19');
  await ficha.locator('[data-campo="fecha_apertura"] input').blur();
  const nota = ficha.locator('[data-campo="observaciones"] textarea');
  await nota.fill('Nota de prueba del analista.');
  await nota.blur();
  await expect(rober.getByText('Guardado').first()).toBeVisible();
  await ficha.getByRole('button', { name: 'Listo' }).click();
  await expect(ficha.getByRole('region', { name: 'Observaciones del analista' })).toContainText('Nota de prueba del analista.');
  await expect(ficha.getByText('Apertura: 19/08/2020')).toBeVisible();

  // 2. La transcripción entra literal, con la nota al pie como observación.
  await irA(rober, 'Mensajes');
  await rober.getByRole('link', { name: /Importar conversación/ }).first().click();
  await rober.locator('input[type=file]').setInputFiles(join(carpeta, 'conversacion-prueba.docx'));
  await expect(rober.getByText('5 mensajes detectados · 1 línea que no es un mensaje')).toBeVisible();
  await rober.getByLabel('Título').fill(`Conversación de prueba ${base}`);
  await rober.getByRole('button', { name: 'Importar 5 mensajes' }).click();
  await expect(rober.getByRole('heading', { name: '5 mensajes importados' })).toBeVisible();
  await rober.getByRole('link', { name: /Abrir la conversación/ }).click();
  const chat = rober.getByRole('region', { name: `Conversación de prueba ${base}` });
  await expect(chat.getByText('Esa la ganaste compitiendo, acordate')).toBeVisible();
  await expect(chat.getByText(/Nota sintética del analista/)).toBeVisible();

  // INES abre la misma conversación.
  await irA(ines, 'Mensajes');
  await ines.getByRole('button', { name: new RegExp(`Conversación de prueba ${base}`) }).click();
  const chatInes = ines.getByRole('region', { name: `Conversación de prueba ${base}` });

  // 3. ROBER marca un mensaje con la tecla R: a INES le aparece marcado sin recargar.
  await chat.getByRole('button', { name: 'Mensaje de Ficticio' }).first().focus();
  await rober.keyboard.press('r');
  await expect(chat.getByRole('button', { name: 'Mensaje de Ficticio, marcado como relevante' })).toBeVisible();
  await expect(chatInes.getByRole('button', { name: 'Mensaje de Ficticio, marcado como relevante' })).toBeVisible({ timeout: 8000 });

  // El texto literal no se edita; se vincula a la contratación.
  await chat.getByRole('button', { name: 'Mensaje de Ficticio, marcado como relevante' }).click();
  const panel = rober.getByRole('complementary', { name: 'Ficha del mensaje' });
  await expect(panel.getByText(/Transcripción literal: no se edita/)).toBeVisible();
  await panel.getByLabel('Contratación a vincular').selectOption({ label: `${lp} · Expte. ${base + 500}` });
  await panel.getByRole('button', { name: 'Vincular' }).first().click();
  await expect(rober.getByText(`Vinculado a ${lp}.`)).toBeVisible();
  await expect(chat.getByText(lp, { exact: true })).toBeVisible();
  await rober.keyboard.press('Escape');

  // Buscar dentro de la conversación resalta sin distinguir tildes.
  await rober.getByPlaceholder('Buscar en esta conversación…').fill('invitacion');
  await expect(chat.locator('mark')).toHaveText('invitación');
  await expect(rober.getByText('1 de 5')).toBeVisible();

  // 4. El informe sale con la plantilla y el mensaje literal.
  await rober.getByRole('button', { name: 'Informe .docx' }).click();
  const dialogo = rober.getByRole('dialog', { name: 'Informe de relevamiento de mensajes' });
  const descarga = rober.waitForEvent('download');
  await dialogo.getByRole('button', { name: /Descargar \.docx \(1 mensaje\)/ }).click();
  const archivo = await (await descarga).path();
  const xml = strFromU8(unzipSync(new Uint8Array(readFileSync(archivo!)))['word/document.xml']);
  expect(xml).toContain('INFORME DE RELEVAMIENTO DE MENSAJES');
  expect(xml).toContain('Ref.: Legajo N.º 299113');
  expect(xml).toContain(`Hoy te llega la invitación de la ${lp}, arreglá con los otros la cotización.`);
  expect(xml).toContain(`Se vincula con: ${lp} (Expte. ${base + 500}).`);
  // «Emisor» es el titular del teléfono: la conversación de prueba no lo tiene cargado.
  expect(xml).toMatch(/Emisor: <\/w:t><\/w:r><w:r>(?:<w:rPr>.*?<\/w:rPr>)?<w:t xml:space="preserve">\[completar: titular del teléfono\]/);

  // 5. La búsqueda global encuentra el mensaje y lleva a la conversación.
  await ines.keyboard.press('Control+k');
  await ines.getByPlaceholder(/Buscá un Nº de efecto/).fill('presupuesto de prueba');
  await ines.getByRole('option').filter({ hasText: 'Ficticio' }).first().click();
  await expect(ines.getByRole('complementary', { name: 'Ficha del mensaje' })).toBeVisible();
});
