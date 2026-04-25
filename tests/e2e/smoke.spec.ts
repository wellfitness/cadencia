import { test, expect, type Page } from '@playwright/test';

/**
 * GPX minimo en memoria para tests E2E. ~5 minutos de ruta llana sintetica
 * con timestamps para que el procesamiento genere varios bloques de 60s.
 */
function buildSyntheticGpx(): string {
  const startTime = new Date('2026-01-01T08:00:00Z').getTime();
  const points: string[] = [];
  for (let i = 0; i < 60; i++) {
    const lat = 42.0 + i * 0.0003; // ~33m por punto
    const lon = -8.0;
    const ele = 100 + Math.sin(i / 5) * 20; // perfil ondulado
    const time = new Date(startTime + i * 5 * 1000).toISOString();
    points.push(
      `<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><ele>${ele.toFixed(1)}</ele><time>${time}</time></trkpt>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
 <trk><name>Smoke test ride</name><trkseg>${points.join('')}</trkseg></trk>
</gpx>`;
}

async function fillUserData(page: Page): Promise<void> {
  await page.getByLabel(/tu peso/i).fill('70');
  await page.getByLabel(/^fc máxima$/i).fill('185');
  await page.getByLabel(/fc en reposo/i).fill('55');
}

async function uploadGpx(page: Page, content: string, filename = 'test.gpx'): Promise<void> {
  await page.locator('input[type=file]').setInputFiles({
    name: filename,
    mimeType: 'application/gpx+xml',
    buffer: Buffer.from(content),
  });
}

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

  test('boton Siguiente se habilita con peso + FC valida', async ({ page }) => {
    await fillUserData(page);
    const submit = page.getByRole('button', { name: /siguiente: ruta/i }).first();
    await expect(submit).toBeEnabled();
  });

  test('muestra FC max estimada (Gulati) al introducir ano de nacimiento', async ({ page }) => {
    await page.getByLabel(/tu peso/i).fill('65');
    // El bloque "¿No conoces tu FC máxima?" esta colapsado por defecto.
    await page.getByText(/no conoces tu fc máxima/i).click();
    await page.getByLabel(/año de nacimiento/i).fill('1980');
    await expect(page.getByText(/FC máxima estimada/i)).toBeVisible();
  });
});

test.describe('Vatios con Ritmo - paso Ruta', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await fillUserData(page);
    await page.getByRole('button', { name: /siguiente: ruta/i }).first().click();
  });

  test('muestra dropzone tras navegar a Ruta', async ({ page }) => {
    await expect(page.getByText(/arrastra tu gpx/i)).toBeVisible();
    await expect(page.getByText(/qué pasa con tu archivo/i)).toBeVisible();
  });

  test('procesa un GPX subido y muestra perfil + summary', async ({ page }) => {
    await uploadGpx(page, buildSyntheticGpx());
    // Esperar a que aparezca el card "Perfil de la ruta"
    await expect(page.getByRole('heading', { name: /perfil de la ruta/i })).toBeVisible({
      timeout: 10_000,
    });
    // RouteSummary debe mostrar distancia
    await expect(page.getByText(/distancia/i).first()).toBeVisible();
    // Debe haber alguna mencion a km
    await expect(page.getByText(/km/i).first()).toBeVisible();
  });

  test('muestra error legible si subes un archivo no-GPX', async ({ page }) => {
    await uploadGpx(page, 'no soy un gpx', 'badfile.txt');
    await expect(page.getByText(/extensión \.gpx/i)).toBeVisible();
  });

  test('al pulsar Atrás vuelve a Datos con los inputs intactos', async ({ page }) => {
    await page.getByRole('button', { name: /atrás/i }).first().click();
    await expect(page.getByText(/bici y peso/i)).toBeVisible();
    await expect(page.getByLabel(/tu peso/i)).toHaveValue('70');
  });
});
