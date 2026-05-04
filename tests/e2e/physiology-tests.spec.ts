import { test, expect, type Page } from '@playwright/test';

/**
 * E2E del flujo de tests fisiologicos guiados:
 * - Pesta~na "Tests" en la galeria de plantillas (bike y run)
 * - Plantillas-test se renderizan filtradas por sport + kind
 * - Plantillas-test NO aparecen en la pesta~na de entrenos
 * - El TestSetupDialog se dispara antes de Modo TV cuando el test tiene
 *   `hardwareDisclaimer` (rampa, 3MT, 30-15 IFT)
 *
 * No simulamos la sesion completa en Modo TV (requiere fakeTimers
 * coordinados con audio/video y ahora mismo el smoke E2E no lo cubre);
 * el TestResultDialog se valida indirectamente via los tests unit del
 * compute() en src/core/physiology/tests.test.ts.
 */

async function gotoPlanStep(
  page: Page,
  sport: 'bike' | 'run' = 'bike',
): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /crear mi sesión/i }).first().click();
  await page.getByRole('button', { name: /^continuar$/i }).click();
  if (sport === 'run') {
    await page.getByRole('radio', { name: /carrera/i }).click();
  }
  // Sesion indoor (no GPX) para llegar al builder.
  await page.getByRole('button', { name: /sesión/i }).first().click();
  // DataStep: solo FC.
  await page.getByLabel(/^fc máxima$/i).fill('185');
  await page.getByLabel(/fc en reposo/i).fill('55');
  await page.getByRole('button', { name: /^plan$/i }).first().click();
  // Esperar al builder.
  await page
    .getByRole('heading', { name: /tu sesión/i })
    .first()
    .waitFor({ timeout: 5_000 });
}

test.describe('Tests fisiologicos - galeria (ciclismo)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoPlanStep(page, 'bike');
  });

  test('la pestaña Tests muestra los 3 tests de ciclismo', async ({ page }) => {
    await page.getByRole('tab', { name: /^tests$/i }).click();
    await expect(page.getByText(/test de rampa/i)).toBeVisible();
    await expect(page.getByText(/test 5 min/i)).toBeVisible();
    await expect(page.getByText(/test 3mt/i)).toBeVisible();
  });

  test('los tests NO aparecen en la pestaña de Plantillas científicas', async ({
    page,
  }) => {
    // Por defecto la galeria abre en Plantillas. Los tests no deberian
    // estar mezclados con los entrenos.
    await expect(page.getByText(/test de rampa/i)).not.toBeVisible();
    await expect(page.getByText(/test 3mt/i)).not.toBeVisible();
    // Pero los entrenos clasicos si.
    await expect(page.getByText(/noruego 4×4/i)).toBeVisible();
    await expect(page.getByText(/sit/i).first()).toBeVisible();
  });

  test('seleccionar un test carga su plan en el builder', async ({ page }) => {
    await page.getByRole('tab', { name: /^tests$/i }).click();
    await page.getByText(/test de rampa/i).click();
    // El builder debe mostrar bloques del plan-rampa (warmup + escalones Z2..Z6).
    await expect(page.getByText(/calentamiento muy suave/i)).toBeVisible();
  });
});

test.describe('Tests fisiologicos - galeria (running)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoPlanStep(page, 'run');
  });

  test('la pestaña Tests muestra los 3 tests de running', async ({ page }) => {
    await page.getByRole('tab', { name: /^tests$/i }).click();
    await expect(page.getByText(/test fcmáx \(daniels\)/i)).toBeVisible();
    await expect(page.getByText(/test 5 min \(fcmáx \+ lthr\)/i)).toBeVisible();
    await expect(page.getByText(/test 30-15 ift/i)).toBeVisible();
  });

  test('NO mezcla tests de bike en la galeria de running', async ({ page }) => {
    await page.getByRole('tab', { name: /^tests$/i }).click();
    await expect(page.getByText(/test de rampa/i)).not.toBeVisible();
    await expect(page.getByText(/test 3mt/i)).not.toBeVisible();
  });
});
