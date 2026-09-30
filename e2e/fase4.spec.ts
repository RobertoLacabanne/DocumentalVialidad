import { createClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pdfConImagen, pdfConTexto } from './fixtures/pdf.mjs';

// Fase 4: leer una carpeta de escaneos (capa de texto y OCR), validar las
// sugerencias, encontrar el texto con Ctrl+K, traer texto de AppUFIL e
// importar chats de un reporte de UFED. Otra persona mira en vivo.

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

const irA = (p: Page, seccion: string) => p.getByRole('navigation', { name: 'Secciones de la causa' }).getByRole('link', { name: seccion }).click();

/** Un efecto y una contratación de prueba, cargados por la API como ROBER, para que haya contra qué sugerir. */
async function prepararDatos(n: number) {
  const env = Object.fromEntries(
    execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' })
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
  );
  const db = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
  const { error: ea } = await db.auth.signInWithPassword({ email: 'rober@ejemplo.test', password: CLAVE });
  if (ea) throw ea;
  const { data: causa } = await db.from('causa').select('id').eq('legajo_fiscalia', '299113').single();
  const causaId = (causa as { id: string }).id;
  for (const [tabla, fila] of [
    ['efecto', { numero: String(n), soporte: 'papel' }],
    ['contratacion', { identificador: `LP F4-${n}`, expediente: String(n + 1) }],
  ] as const) {
    const { error } = await db.from(tabla).insert({ causa_id: causaId, ...fila });
    if (error) throw new Error(`${tabla}: ${error.message}`);
  }
}

test('escaneos leídos, sugerencias validadas, texto buscable, AppUFIL y UFED', async ({ browser }) => {
  test.setTimeout(180_000);
  const n = 800000 + (Date.now() % 90000);
  await prepararDatos(n);
  const carpeta = mkdtempSync(join(tmpdir(), 'fase4-'));
  execFileSync('node', ['e2e/fixtures/generar-planillas.mjs', carpeta, `--base=${n}`]);

  const rober = await entrar(browser, 'rober@ejemplo.test');
  const ines = await entrar(browser, 'ines@ejemplo.test');

  // Los PDF de la carpeta «EFECTO n»: uno con capa de texto y otro que es solo una imagen impresa.
  const jpeg = await rober.evaluate((marca) => {
    const c = document.createElement('canvas');
    c.width = 1240;
    c.height = 1754;
    const x = c.getContext('2d')!;
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#111';
    x.font = '48px Arial';
    ['REMITO DE PRUEBA', `Control ${marca}`, 'Entrega de materiales viales', 'Firma del receptor'].forEach((t, i) => x.fillText(t, 110, 220 + i * 100));
    return c.toDataURL('image/jpeg', 0.92).split(',')[1];
  }, String(n));
  const efecto = join(carpeta, `EFECTO ${n}`);
  mkdirSync(efecto);
  writeFileSync(join(efecto, 'Factura F4.pdf'), pdfConTexto([[`Factura de prueba F4 ${n}`, `Ref. Expte. ${n + 1}`, 'Remito firmado por la proveedora de prueba'], ['Segunda hoja del documento de prueba, sin nada relevante.']]));
  writeFileSync(join(efecto, 'Remito escaneado.pdf'), pdfConImagen(Buffer.from(jpeg, 'base64'), 1240, 1754));

  await irA(ines, 'Documentos');
  await irA(rober, 'Documentos');
  await expect(rober.getByRole('heading', { name: 'Documentos y escaneos' })).toBeVisible();

  // 1. La carpeta entera: se lee en el navegador y solo viaja el texto.
  await rober.locator('input[aria-label="Elegir una carpeta para leer"]').setInputFiles(efecto);
  await expect(rober.getByText('Lectura terminada')).toBeVisible({ timeout: 120_000 });
  const cola = rober.getByRole('region', { name: 'Lectura en curso' });
  await expect(cola.getByText(/2 con texto del PDF/)).toBeVisible();
  await expect(cola.getByText(/1 por OCR/)).toBeVisible();
  // La otra persona ve aparecer los documentos sin recargar.
  await expect(ines.getByRole('row', { name: new RegExp(`Remito escaneado\\.pdf EFECTO ${n}`) })).toBeVisible();

  // 2. Las sugerencias no se aplican solas: se confirman.
  await rober.getByRole('button', { name: /^Sugerencias/ }).click();
  const bandeja = rober.locator('li', { hasText: `EFECTO ${n}/Factura F4.pdf` });
  await expect(bandeja.filter({ hasText: `Es del efecto Nº ${n}` })).toBeVisible();
  await bandeja.filter({ hasText: `Es del efecto Nº ${n}` }).getByRole('button', { name: 'Confirmar' }).click();
  await expect(rober.getByText('Confirmada: quedó aplicada.')).toBeVisible();
  const contratacion = bandeja.filter({ hasText: `Menciona la contratación LP F4-${n}` });
  await expect(contratacion).toContainText(`Expte. ${n + 1}`);
  await contratacion.getByRole('button', { name: 'Descartar' }).click();
  await expect(contratacion).toBeHidden();

  // 3. El texto leído por OCR se encuentra con Ctrl+K y abre la página.
  await rober.keyboard.press('Control+k');
  await rober.getByRole('textbox', { name: 'Buscar en toda la causa' }).fill(`control ${n}`);
  const resultado = rober.getByRole('option', { name: /Remito escaneado\.pdf · pág\. 1/ });
  await expect(resultado).toBeVisible();
  await resultado.click();
  const ficha = rober.getByRole('complementary', { name: 'Ficha del documento Remito escaneado.pdf' });
  await expect(ficha.getByLabel('Texto de la página 1')).toContainText(String(n));
  await expect(ficha.getByText(/OCR en el navegador/).first()).toBeVisible();
  await rober.keyboard.press('Escape');

  // 4. Volver a arrastrar el mismo archivo no lo duplica: se reconoce por la huella.
  await rober.getByRole('button', { name: 'Documentos', exact: true }).click();
  await rober.getByRole('button', { name: 'Limpiar terminadas' }).click();
  await rober.locator('input[aria-label="Elegir archivos para leer"]').setInputFiles(join(efecto, 'Factura F4.pdf'));
  await expect(cola.getByText('Ya estaba leído.')).toBeVisible({ timeout: 30_000 });

  // 5. Texto de AppUFIL por paquete: sin volver a hacer el OCR.
  const sha = createHash('sha256').update(`appufil ${n}`).digest('hex');
  const paquete = join(carpeta, 'texto-para-el-tablero.json');
  writeFileSync(
    paquete,
    JSON.stringify({
      formato: 'tablero-texto/1',
      generado_por: 'AppUFIL (prueba)',
      legajo: '299113',
      archivos: [{ sha256: sha, nombre: `Contrato AppUFIL ${n}.pdf`, ruta: `EFECTO ${n}/Contrato AppUFIL ${n}.pdf`, paginas: 1, texto: [{ nro: 1, texto: `Contrato leído por AppUFIL ${n}`, confianza: 91 }] }],
    }),
  );
  await rober.getByRole('button', { name: 'Traer texto de AppUFIL' }).click();
  const dialogo = rober.getByRole('dialog', { name: 'Traer texto de AppUFIL' });
  await dialogo.locator('input[type=file]').setInputFiles(paquete);
  await expect(dialogo.getByText('1 archivo · 1 páginas con texto')).toBeVisible();
  await dialogo.getByRole('button', { name: 'Traer 1 archivo' }).click();
  await expect(dialogo.getByText(/Listo\. 1 documento nuevo/)).toBeVisible();
  await dialogo.getByRole('button', { name: 'Cerrar' }).click();
  await expect(rober.getByRole('row', { name: new RegExp(`Contrato AppUFIL ${n}`) })).toContainText('AppUFIL');

  // 6. Un reporte de UFED en Excel: cada chat, una conversación.
  await irA(rober, 'Mensajes');
  await rober.getByRole('link', { name: /Importar conversación/ }).first().click();
  await rober.locator('input[type=file]').setInputFiles(join(carpeta, 'reporte-ufed-prueba.xlsx'));
  const chats = rober.getByRole('list', { name: 'Chats del reporte' });
  await expect(chats.getByRole('listitem')).toHaveCount(2);
  await expect(rober.getByText(/Mensaje \(texto\) ← «Body»/)).toBeVisible();
  await chats.getByRole('listitem').filter({ hasText: 'WhatsApp' }).getByRole('button', { name: 'Revisar este chat' }).click();
  await expect(rober.getByRole('row', { name: /Importar Fila Fecha Remitente Mensaje/ })).toBeVisible();
  await rober.getByLabel('Título').fill(`Chat UFED de prueba ${n}`);
  await rober.getByRole('button', { name: 'Importar 3 mensajes' }).click();
  await expect(rober.getByRole('heading', { name: '3 mensajes importados' })).toBeVisible();
  await rober.getByRole('button', { name: 'Otro chat del mismo reporte' }).click();
  await chats.getByRole('listitem').filter({ hasText: 'SMS' }).getByRole('button', { name: 'Revisar este chat' }).click();
  await rober.getByLabel('Título').fill(`Chat SMS de prueba ${n}`);
  await rober.getByRole('button', { name: 'Importar 1 mensaje' }).click();
  await expect(rober.getByRole('heading', { name: '1 mensajes importados' })).toBeVisible();
});
