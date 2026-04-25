import { test, expect } from '@playwright/test';

test.describe('Vatios con Ritmo - shell + paso Datos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('carga la app sin errores de consola', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Vatios con Ritmo', level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('muestra el stepper con los 4 pasos', async ({ page }) => {
    const stepper = page.getByRole('navigation', { name: /progreso del flujo/i });
    await expect(stepper).toBeVisible();
    await expect(stepper.getByText('Datos', { exact: true })).toBeVisible();
    await expect(stepper.getByText('Ruta', { exact: true })).toBeVisible();
    await expect(stepper.getByText('Música', { exact: true })).toBeVisible();
    await expect(stepper.getByText('Resultado', { exact: true })).toBeVisible();
  });

  test('boton Siguiente deshabilitado sin datos', async ({ page }) => {
    const submit = page.getByRole('button', { name: /siguiente: ruta/i }).first();
    await expect(submit).toBeDisabled();
  });

  test('boton Siguiente se habilita con peso + FTP validos', async ({ page }) => {
    await page.getByLabel(/peso corporal/i).fill('70');
    await page.getByLabel(/^ftp/i).fill('220');
    const submit = page.getByRole('button', { name: /siguiente: ruta/i }).first();
    await expect(submit).toBeEnabled();
  });

  test('muestra FC max estimada (Gulati) al introducir ano de nacimiento', async ({ page }) => {
    await page.getByLabel(/peso corporal/i).fill('65');
    await page.getByLabel(/año de nacimiento/i).fill('1980');
    await expect(page.getByText(/FC máxima estimada/i)).toBeVisible();
  });
});
