import { expect, test, type Browser, type Page } from '@playwright/test';

// Dos personas, dos navegadores, la misma causa. Es la prueba de la Fase 0:
// lo que carga una le aparece a la otra sin recargar, y si editan el mismo
// campo a la vez no se pierde el trabajo de ninguna.

const CLAVE = 'clave-local-123';

async function entrar(browser: Browser, email: string): Promise<Page> {
  const contexto = await browser.newContext();
  const pagina = await contexto.newPage();
  await pagina.goto('/');
  await pagina.getByLabel('Correo').fill(email);
  await pagina.getByLabel('Contraseña').fill(CLAVE);
  await pagina.getByRole('button', { name: 'Entrar con correo' }).click();
  await expect(pagina.getByRole('heading', { name: 'Índice de prueba' })).toBeVisible();
  await expect(pagina.getByText('En vivo: los cambios del equipo aparecen solos')).toBeVisible();
  return pagina;
}

const fila = (p: Page, titulo: string) => p.getByRole('row').filter({ hasText: titulo });

test('dos personas trabajan a la vez sobre la misma causa', async ({ browser }) => {
  const rober = await entrar(browser, 'rober@ejemplo.test');
  const ines = await entrar(browser, 'ines@ejemplo.test');
  const titulo = `Pieza de prueba ${Date.now()}`;

  // 1. ROBER carga una pieza: a INES le aparece sola.
  await rober.getByRole('button', { name: 'Nueva pieza' }).click();
  await rober.getByLabel('Nº de orden').fill('900');
  await rober.getByLabel('Título o asunto').fill(titulo);
  await rober.getByRole('button', { name: 'Cargar pieza' }).click();
  await expect(rober.getByRole('complementary', { name: /Ficha de la pieza 900/ })).toBeVisible();
  await expect(fila(ines, titulo)).toBeVisible({ timeout: 8000 });

  // 2. INES abre la ficha: ROBER ve que la está mirando.
  await fila(ines, titulo).click();
  await expect(ines.getByRole('heading', { name: titulo })).toBeVisible();
  await expect(fila(rober, titulo).getByText('INES está viendo')).toBeVisible({ timeout: 8000 });

  // 3. Los dos editan "Fojas" a la vez. ROBER guarda primero.
  //    ROBER ya está en modo edición (la ficha nueva se abre así).
  await ines.getByRole('button', { name: 'Editar' }).click();
  const fojasRober = rober.locator('[data-campo="fojas"] input');
  const fojasInes = ines.locator('[data-campo="fojas"] input');
  await fojasInes.click(); // INES empieza a editar con el campo vacío
  await fojasRober.fill('12');
  await fojasRober.press('Enter');
  await expect(rober.locator('[data-campo="fojas"]').getByText('Guardado')).toBeVisible();

  // INES termina de escribir lo suyo sin haber visto el cambio de ROBER.
  await fojasInes.fill('14');
  await fojasInes.press('Enter');
  const conflicto = ines.locator('[data-campo="fojas"]').getByRole('alert');
  await expect(conflicto).toContainText('ROBER cambió este campo mientras lo editabas');
  await expect(conflicto).toContainText('12');

  // Nada se pisó: el valor de ROBER sigue en la base.
  await expect(fojasRober).toHaveValue('12');

  // 4. INES decide guardar el suyo igual: ahora sí se guarda y ROBER lo ve.
  await conflicto.getByRole('button', { name: 'Guardar el mío igual' }).click();
  await expect(ines.locator('[data-campo="fojas"]').getByText('Guardado')).toBeVisible();
  await expect(rober.getByRole('status').filter({ hasText: 'INES acaba de cambiar' })).toContainText('Fojas: 12 → 14', {
    timeout: 8000,
  });
  await expect(fojasRober).toHaveValue('14', { timeout: 8000 });

  // 5. El historial de la ficha cuenta todo, con nombre.
  await rober.getByRole('button', { name: 'Listo' }).click();
  const historial = rober.getByRole('region', { name: 'Historial' });
  await expect(historial).toContainText('ROBER cargó la ficha');
  await expect(historial).toContainText('ROBER cambió Fojas');
  await expect(historial).toContainText('INES cambió Fojas');

  // 6. ROBER archiva la pieza: a INES se le va del índice, sin borrarse.
  await rober.getByRole('button', { name: 'Archivar esta pieza' }).click();
  await rober.getByRole('button', { name: 'Archivar', exact: true }).click();
  await expect(fila(ines, titulo)).toHaveCount(0, { timeout: 8000 });
});

test('la cita se arma con lo que hay y marca lo que falta', async ({ browser }) => {
  const rober = await entrar(browser, 'rober@ejemplo.test');
  const titulo = `Agenda de prueba ${Date.now()}`;
  await rober.getByRole('button', { name: 'Nueva pieza' }).click();
  await rober.getByLabel('Nº de orden').fill('901');
  await rober.getByLabel('Título o asunto').fill(titulo);
  await rober.getByRole('button', { name: 'Cargar pieza' }).click();
  const efecto = rober.locator('[data-campo="efecto_id"] input');
  await efecto.fill('48435');
  await efecto.press('Enter');
  await expect(rober.locator('[data-campo="efecto_id"]').getByText('Guardado')).toBeVisible();
  const cita = rober.getByRole('region', { name: 'Cita para escritos' });
  await expect(cita).toContainText(`Efecto Nº 48435 – ${titulo} (Sobre Nº [completar]), fs. [completar], informe [completar], pieza Nº 901`);
});
