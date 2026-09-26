import { createClient } from '@supabase/supabase-js';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Fase 3: armar el ofrecimiento de prueba con los avisos procesales, sacar
// el listado para la remisión, cargar un acto en la cronología y una
// relación en el grafo, con otra persona mirando.

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

/** Carga por la API (como ROBER) lo que la prueba necesita de antemano: dos piezas, una con planteo, y dos fichas del directorio. */
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
  const insertar = async (tabla: string, fila: Record<string, unknown>) => {
    const { data, error } = await db.from(tabla).insert({ causa_id: causaId, ...fila }).select('id').single();
    if (error) throw new Error(`${tabla}: ${error.message}`);
    return (data as { id: string }).id;
  };
  await insertar('pieza', { numero_orden: `${n}.1`, tipo: 'documental_secuestrada', titulo: `Pieza F3 ${n} sin planteos` });
  const cuestionada = await insertar('pieza', { numero_orden: `${n}.2`, tipo: 'extraccion_forense', titulo: `Pieza F3 ${n} con planteo` });
  const incidencia = await insertar('incidencia_procesal', { titulo: `Planteo F3 ${n}`, tipo: 'planteo_exclusion', situacion: 'admisibilidad_cuestionada' });
  await insertar('incidencia_alcance', { incidencia_id: incidencia, entidad_id: cuestionada });
  const testigo = await insertar('persona', { nombre: `Testigo F3 ${n}`, tipo_persona: 'fisica' });
  await insertar('rol_en_causa', { persona_id: testigo, rol: 'testigo' });
  await insertar('persona', { nombre: `Empresa F3 ${n} SRL`, tipo_persona: 'juridica' });
}

test('ofrecimiento de prueba, listado para la remisión, cronología y relaciones', async ({ browser }) => {
  const n = 700000 + (Date.now() % 90000);
  await prepararDatos(n);

  const rober = await entrar(browser, 'rober@ejemplo.test');
  const ines = await entrar(browser, 'ines@ejemplo.test');
  await irA(ines, 'Juicio');
  await expect(ines.getByRole('heading', { name: 'Preparación del juicio' })).toBeVisible();

  // 1. Al sumar una pieza con planteo, avisa antes de confirmar.
  await irA(rober, 'Juicio');
  await rober.getByRole('button', { name: 'Sumar piezas', exact: true }).click();
  const sumar = rober.getByRole('dialog', { name: 'Sumar piezas del índice' });
  await sumar.getByLabel('Buscar pieza').fill(`F3 ${n}`);
  await sumar.getByText(`Pieza F3 ${n} sin planteos`).click();
  await sumar.getByText(`Pieza F3 ${n} con planteo`).click();
  await expect(sumar.getByRole('alert')).toContainText(`Planteo F3 ${n}`);
  await sumar.getByRole('button', { name: 'Sumar igual 2' }).click();
  await expect(sumar).toBeHidden();

  const cuestionada = rober.getByRole('row', { name: new RegExp(`Pieza F3 ${n} con planteo`) });
  await expect(cuestionada).toContainText(/Admisibilidad cuestionada/i);
  // La otra persona lo ve aparecer sin recargar.
  await expect(ines.getByRole('row', { name: new RegExp(`Pieza F3 ${n} con planteo`) })).toBeVisible();

  // 2. Un testigo del directorio, con su rol primero.
  await rober.getByRole('button', { name: 'Testigos o peritos', exact: true }).click();
  const personas = rober.getByRole('dialog', { name: 'Sumar testigos o peritos' });
  await personas.getByLabel('Buscar persona').fill(`Testigo F3 ${n}`);
  await personas.getByText(`Testigo F3 ${n}`).click();
  await personas.getByRole('button', { name: /^Sumar/ }).click();
  const filaTestigo = rober.getByRole('region', { name: 'Testigos' }).getByRole('row', { name: new RegExp(`Testigo F3 ${n}`) });
  await expect(filaTestigo).toContainText('[completar: sobre qué declara]');

  // 3. Si se exhibe y nadie la introduce, avisa; al elegir el testigo y la entrega, deja de avisar.
  await rober.getByRole('row', { name: new RegExp(`Pieza F3 ${n} sin planteos`) }).click();
  const ficha = rober.getByRole('complementary', { name: 'Ficha del ofrecimiento' });
  await expect(ficha.getByText('No figura entregada a la defensa.')).toBeVisible();
  await ficha.locator('[data-campo="incorporacion"] select').selectOption('exhibicion');
  await expect(ficha.getByText('Se exhibe, pero falta con qué testigo o perito se introduce.')).toBeVisible();
  await ficha.locator('[data-campo="introduce_id"] select').selectOption({ label: `Testigo F3 ${n}` });
  await ficha.locator('[data-campo="entregada_defensa"] select').selectOption('si');
  await expect(ficha.getByText('Se exhibe, pero falta con qué testigo o perito se introduce.')).toBeHidden();
  await expect(ficha.getByText('No figura entregada a la defensa.')).toBeHidden();
  await rober.keyboard.press('Escape');

  // 4. El listado para la remisión sale por clase, con lo que falta marcado.
  await rober.getByRole('button', { name: /^Exportar/ }).click();
  await rober.getByRole('menuitem', { name: /Listado para la remisión/ }).click();
  const listado = rober.getByRole('dialog', { name: 'Listado de prueba' });
  const descarga = rober.waitForEvent('download');
  await listado.getByRole('button', { name: /Descargar \.docx/ }).click();
  const archivo = await (await descarga).path();
  const xml = strFromU8(unzipSync(new Uint8Array(readFileSync(archivo!)))['word/document.xml']);
  const texto = xml.replace(/<[^>]+>/g, '');
  expect(texto).toContain('OFRECIMIENTO DE PRUEBA');
  expect(texto).toMatch(/TESTIMONIAL/);
  expect(texto).toContain(`Testigo F3 ${n}`);
  expect(texto).toContain(`Pieza F3 ${n} con planteo`);
  expect(texto).toContain('[completar');
  expect(texto.indexOf('TESTIMONIAL')).toBeLessThan(texto.indexOf('DOCUMENTAL'));

  // 5. Un acto procesal entra en la cronología, en su mes.
  await irA(rober, 'Cronología');
  await rober.getByRole('button', { name: 'Acto procesal' }).click();
  const acto = rober.getByRole('dialog', { name: 'Nuevo acto procesal' });
  await acto.getByLabel('Qué pasó').fill(`Audiencia F3 ${n}`);
  await acto.getByLabel('Fecha', { exact: true }).fill('2026-03-15');
  await acto.getByRole('button', { name: 'Cargar' }).click();
  await expect(rober.getByText(`Audiencia F3 ${n}`)).toBeVisible();
  await expect(rober.getByRole('heading', { name: /marzo 2026/i })).toBeVisible();
  // Los filtros por tipo muestran solo lo elegido.
  await rober.getByRole('button', { name: /^Piezas/ }).click();
  await expect(rober.getByText(`Audiencia F3 ${n}`)).toBeHidden();
  await rober.getByRole('button', { name: /^Piezas/ }).click();

  // 6. Una relación cargada aparece en el grafo y en la ficha de las dos.
  await irA(rober, 'Personas y empresas');
  await rober.getByRole('button', { name: 'Relaciones' }).click();
  await rober.getByRole('button', { name: 'Nueva relación' }).click();
  const relacion = rober.getByRole('dialog', { name: 'Nueva relación' });
  await relacion.getByLabel('Entre').selectOption({ label: `Testigo F3 ${n}` });
  await relacion.getByLabel('Y', { exact: true }).selectOption({ label: `Empresa F3 ${n} SRL` });
  await relacion.getByLabel('Qué relación tienen').fill('Socio');
  await relacion.getByLabel('De dónde surge').fill(`Contrato social F3 ${n}`);
  await relacion.getByRole('button', { name: 'Cargar relación' }).click();
  await expect(relacion).toBeHidden();
  const lista = rober.getByRole('complementary', { name: 'Relaciones en lista' });
  await expect(lista.getByText(`surge de Contrato social F3 ${n}`)).toBeVisible();
  await rober.getByRole('button', { name: new RegExp(`Persona: Testigo F3 ${n}`) }).click();
  const fichaPersona = rober.getByRole('complementary', { name: `Ficha de Testigo F3 ${n}` });
  await expect(fichaPersona.getByRole('region', { name: 'Relaciones' })).toContainText(`Empresa F3 ${n} SRL`);
  await expect(fichaPersona.getByRole('region', { name: 'Dónde aparece' })).toContainText('Ofrecida como testigo');
});
