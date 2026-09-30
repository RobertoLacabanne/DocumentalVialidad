import { expect, test, type Browser, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Fase 1: importar una planilla con el asistente, mover efectos en el tablero
// con otra persona mirando, y encontrar cualquier cosa con Ctrl+K.

const CLAVE = 'clave-local-123';

async function entrar(browser: Browser, email: string): Promise<Page> {
  const contexto = await browser.newContext();
  const pagina = await contexto.newPage();
  await pagina.goto('/');
  await pagina.getByLabel('Correo').fill(email);
  await pagina.getByLabel('Contraseña').fill(CLAVE);
  await pagina.getByRole('button', { name: 'Entrar con correo' }).click();
  await expect(pagina.getByText('Avance de los efectos')).toBeVisible();
  return pagina;
}

async function irA(p: Page, seccion: string) {
  await p.getByRole('navigation', { name: 'Secciones de la causa' }).getByRole('link', { name: seccion }).click();
}

test('el asistente importa una planilla y muestra qué entra y qué no', async ({ browser }) => {
  // Números distintos en cada corrida, para que la prueba se pueda repetir sobre la misma base.
  const base = 700000 + (Date.now() % 90000) * 10;
  const carpeta = mkdtempSync(join(tmpdir(), 'planillas-'));
  execFileSync('node', ['e2e/fixtures/generar-planillas.mjs', carpeta, `--base=${base}`]);

  const rober = await entrar(browser, 'rober@ejemplo.test');
  await irA(rober, 'Efectos');
  await rober.getByRole('link', { name: 'Importar planilla' }).click();
  await expect(rober.getByRole('heading', { name: 'Importar una planilla de efectos' })).toBeVisible();

  // 1. Planilla: detecta la fila de títulos y que son dispositivos.
  await rober.locator('input[type=file]').setInputFiles(join(carpeta, 'efectos-dispositivos-prueba.xlsx'));
  await expect(rober.getByText('la fila 2 tiene los títulos')).toBeVisible();
  await expect(rober.getByRole('button', { name: 'Dispositivos' })).toHaveAttribute('aria-pressed', 'true');

  // 2. Columnas: las reconoce solas, incluidas las dos OBSERVACIONES.
  await rober.getByRole('button', { name: /Seguir: revisar columnas/ }).click();
  await expect(rober.getByLabel('Destino de la columna N° de Efecto')).toHaveValue('numero');
  await expect(rober.getByLabel('Destino de la columna OBSERVACIONES', { exact: true })).toHaveValue('observaciones');
  await expect(rober.getByLabel('Destino de la columna Observaciones', { exact: true })).toHaveValue('observaciones_gabinete');

  // 3. Revisión: el balance cierra y nada se corrige por deducción.
  await rober.getByRole('button', { name: /Seguir: ver qué entra/ }).click();
  await expect(rober.getByText('filas con datos en la planilla')).toBeVisible();
  await expect(rober.locator('span').filter({ hasText: /^\d+se importan$/ })).toHaveText('3se importan');
  await expect(rober.getByText(/Estado «A MEDIAS» no reconocido/)).toBeVisible();
  await expect(rober.getByText(/Cargador sin número/)).toBeVisible();
  await expect(rober.getByText(`El Nº ${base + 2} aparece en las filas 4, 8`)).toBeVisible();
  await expect(rober.getByText(/RUTA: sus efectos quedan a su nombre/)).toBeVisible();

  // 4. Confirmar.
  await rober.getByRole('button', { name: 'Importar 3 efectos' }).click();
  await expect(rober.getByRole('heading', { name: '3 efectos importados' })).toBeVisible();
  await expect(rober.getByText(/De las 6 filas con datos .* entraron 3; 3 quedaron afuera/)).toBeVisible();

  // Quedan agrupados por allanamiento y el que decía «Informe C9001» queda vinculado.
  await rober.getByRole('link', { name: 'Ver los efectos' }).click();
  await rober.getByRole('button', { name: 'Por allanamiento' }).click();
  await expect(rober.getByRole('row').filter({ hasText: 'Calle Inventada 123' }).first()).toBeVisible();
  await rober.locator(`[data-efecto="${base + 1}"]`).first().click();
  const ficha = rober.getByRole('complementary', { name: `Ficha del efecto ${base + 1}` });
  await expect(ficha).toContainText('03/02/2026 · Calle Inventada 123 (Oficina de prueba)');
  await expect(ficha).toContainText('C9001');
  await expect(ficha).toContainText('Importado de «efectos-dispositivos-prueba.xlsx», fila 3');

  // Importar la misma planilla otra vez no duplica nada.
  await rober.goto(rober.url().replace(/\/efectos.*$/, '/importar'));
  await rober.locator('input[type=file]').setInputFiles(join(carpeta, 'efectos-dispositivos-prueba.xlsx'));
  await rober.getByRole('button', { name: /Seguir: revisar columnas/ }).click();
  await rober.getByRole('button', { name: /Seguir: ver qué entra/ }).click();
  await expect(rober.getByRole('button', { name: 'No hay efectos nuevos para importar' })).toBeDisabled();
});

test('lo que una persona mueve en el tablero, la otra lo ve al instante', async ({ browser }) => {
  const numero = String(600000 + (Date.now() % 100000));
  const rober = await entrar(browser, 'rober@ejemplo.test');
  const ines = await entrar(browser, 'ines@ejemplo.test');
  await irA(rober, 'Efectos');
  await irA(ines, 'Efectos');
  await expect(ines.getByRole('heading', { name: 'Efectos secuestrados' })).toBeVisible();

  // ROBER carga un efecto a mano: a INES le aparece solo, en «Sin iniciar».
  await rober.getByRole('button', { name: 'Nuevo efecto' }).click();
  await rober.getByLabel('Nº de efecto').fill(numero);
  await rober.getByLabel('Descripción según el acta').fill('Caja de prueba con documentación');
  await rober.getByRole('button', { name: 'Cargar efecto' }).click();
  await expect(rober.getByRole('complementary', { name: `Ficha del efecto ${numero}` })).toBeVisible();
  await rober.keyboard.press('Escape');
  const enInes = (columna: string) => ines.locator(`[data-columna="${columna}"] [data-efecto="${numero}"]`);
  await expect(enInes('sin_iniciar')).toBeVisible({ timeout: 8000 });

  // ROBER lo arrastra a «Escaneado»: a INES se le mueve sin recargar.
  await rober.locator(`[data-columna="sin_iniciar"] [data-efecto="${numero}"]`).dragTo(rober.locator('[data-columna="escaneado"]'));
  await expect(rober.locator(`[data-columna="escaneado"] [data-efecto="${numero}"]`)).toBeVisible();
  await expect(enInes('escaneado')).toBeVisible({ timeout: 8000 });
  await expect(enInes('sin_iniciar')).toHaveCount(0);

  // El cambio queda en el historial del efecto, con nombre.
  await enInes('escaneado').click();
  const historial = ines.getByRole('region', { name: 'Historial' });
  await expect(historial).toContainText('ROBER cambió Estado');
});

test('Ctrl+K encuentra un efecto por su número desde cualquier pantalla', async ({ browser }) => {
  const numero = String(500000 + (Date.now() % 100000));
  const rober = await entrar(browser, 'rober@ejemplo.test');
  await irA(rober, 'Efectos');
  await rober.getByRole('button', { name: 'Nuevo efecto' }).click();
  await rober.getByLabel('Nº de efecto').fill(numero);
  await rober.getByRole('button', { name: 'Cargar efecto' }).click();
  await rober.keyboard.press('Escape');

  await irA(rober, 'Índice de prueba');
  await expect(rober.getByRole('heading', { name: 'Índice de prueba' })).toBeVisible();
  await rober.keyboard.press('Control+k');
  await rober.getByPlaceholder(/Buscá un Nº de efecto/).fill(numero);
  await expect(rober.getByRole('option', { name: new RegExp(`Efecto Nº ${numero}`) })).toBeVisible();
  await rober.keyboard.press('Enter');
  await expect(rober).toHaveURL(/\/efectos\?efecto=/);
  await expect(rober.getByRole('heading', { name: `Efecto Nº ${numero}` })).toBeVisible();
});
