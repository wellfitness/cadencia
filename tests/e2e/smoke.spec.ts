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

/**
 * Navega desde la landing al paso "Datos" del wizard, eligiendo deporte y
 * tipo de fuente en el paso "Tipo". Helper compartido por los tests.
 *
 * Flujo: landing -> click "Probar aplicación" -> modal -> click "Continuar"
 *        -> SourceTypeStep -> toggle deporte (si run) -> click card source
 *        -> DataStep.
 */
async function navigateToDataStep(
  page: Page,
  sport: 'bike' | 'run' = 'bike',
  source: 'gpx' | 'session' = 'gpx',
): Promise<void> {
  await page.goto('/');
  // Landing -> abrir modal
  await page.getByRole('button', { name: /probar aplicación/i }).first().click();
  // Modal -> continuar al wizard
  await page.getByRole('button', { name: /^continuar$/i }).click();
  // SourceTypeStep -> elegir deporte si es running
  if (sport === 'run') {
    await page.getByRole('radio', { name: /carrera/i }).click();
  }
  // Click en la card de tipo de fuente
  const cardLabel = source === 'gpx' ? /ruta con gpx/i : /sesión/i;
  await page.getByRole('button', { name: cardLabel }).first().click();
  // Esperar a estar en DataStep
  await page.getByRole('heading', { name: /tus datos/i }).waitFor({ timeout: 5_000 });
}

async function fillBikeUserData(page: Page): Promise<void> {
  // Bike + GPX outdoor: peso es obligatorio.
  await page.getByLabel(/tu peso/i).fill('70');
  await page.getByLabel(/^fc máxima$/i).fill('185');
  await page.getByLabel(/fc en reposo/i).fill('55');
}

async function fillBikeSessionUserData(page: Page): Promise<void> {
  // Bike + sesion indoor: bici/peso ocultos. Solo FC.
  await page.getByLabel(/^fc máxima$/i).fill('185');
  await page.getByLabel(/fc en reposo/i).fill('55');
}

async function fillRunUserData(page: Page): Promise<void> {
  // En running NO hay campo de peso ni FTP. Solo FC.
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

// =====================================================================
// Landing y navegacion al wizard
// =====================================================================

test.describe('Cadencia - landing y entrada al wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('carga la landing sin errores de consola', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      // Ignoramos el warning conocido de React sobre `fetchPriority` en el
      // <img> del hero: el atributo es valido en React 18+ y mejora LCP, pero
      // React aun emite un warning porque no esta en su whitelist de props
      // HTML estandar. Documentado en el comentario de HeroVisual.
      if (text.includes('fetchPriority') || text.includes('fetchpriority')) return;
      errors.push(text);
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('boton "Probar aplicación" abre el modal de acceso beta', async ({ page }) => {
    await page.getByRole('button', { name: /probar aplicación/i }).first().click();
    await expect(page.getByRole('button', { name: /^continuar$/i })).toBeVisible();
  });

  test('continuar desde modal lleva al paso "Tipo" del wizard', async ({ page }) => {
    await page.getByRole('button', { name: /probar aplicación/i }).first().click();
    await page.getByRole('button', { name: /^continuar$/i }).click();
    await expect(page.getByRole('heading', { name: /qué vas a hacer hoy/i })).toBeVisible();
  });
});

// =====================================================================
// Paso "Tipo": toggle de deporte y eleccion de fuente
// =====================================================================

test.describe('Cadencia - paso Tipo (multisport)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /probar aplicación/i }).first().click();
    await page.getByRole('button', { name: /^continuar$/i }).click();
    await page
      .getByRole('heading', { name: /qué vas a hacer hoy/i })
      .waitFor({ timeout: 5_000 });
  });

  test('muestra el toggle Ciclismo / Carrera y dos cards de fuente', async ({ page }) => {
    await expect(page.getByRole('radio', { name: /ciclismo/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /carrera/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /ruta con gpx/i }).first()).toBeVisible();
  });

  test('Ciclismo activo por defecto', async ({ page }) => {
    await expect(page.getByRole('radio', { name: /ciclismo/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByRole('radio', { name: /carrera/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  test('toggle a Carrera cambia el copy de las cards', async ({ page }) => {
    await page.getByRole('radio', { name: /carrera/i }).click();
    // Card de sesion se actualiza para mencionar plantillas de running.
    await expect(page.getByText(/yasso 800/i)).toBeVisible();
  });

  test('elegir bici + ruta lleva a DataStep con campo de peso', async ({ page }) => {
    await page.getByRole('button', { name: /ruta con gpx/i }).first().click();
    await expect(page.getByLabel(/tu peso/i)).toBeVisible();
  });

  test('elegir carrera + ruta lleva a DataStep SIN peso ni FTP', async ({ page }) => {
    await page.getByRole('radio', { name: /carrera/i }).click();
    await page.getByRole('button', { name: /ruta con gpx/i }).first().click();
    await expect(page.getByRole('heading', { name: /tus datos/i })).toBeVisible();
    // En running el form no debe mostrar peso (ya no aplica al motor) ni FTP
    // (el runner promedio no usa potenciometro).
    await expect(page.getByLabel(/tu peso/i)).not.toBeVisible();
    await expect(page.getByText(/¿tienes potenciómetro\?/i)).not.toBeVisible();
    // FC max si esta visible.
    await expect(page.getByLabel(/^fc máxima$/i)).toBeVisible();
  });
});

// =====================================================================
// Paso "Datos" en bike (flujo legacy)
// =====================================================================

test.describe('Cadencia - paso Datos (bike + gpx)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDataStep(page, 'bike', 'gpx');
  });

  test('muestra el stepper con los pasos del wizard', async ({ page }) => {
    const stepper = page.getByRole('navigation', { name: /progreso del flujo/i });
    await expect(stepper).toBeVisible();
    await expect(stepper.getByText('Datos', { exact: true })).toBeVisible();
    await expect(stepper.getByText('Plan', { exact: true })).toBeVisible();
    await expect(stepper.getByText('Música', { exact: true })).toBeVisible();
  });

  test('boton Siguiente deshabilitado sin datos', async ({ page }) => {
    const submit = page.getByRole('button', { name: /^plan$/i }).first();
    await expect(submit).toBeDisabled();
  });

  test('boton Siguiente se habilita con peso + FC valida', async ({ page }) => {
    await fillBikeUserData(page);
    const submit = page.getByRole('button', { name: /^plan$/i }).first();
    await expect(submit).toBeEnabled();
  });

  test('muestra FC max estimada al introducir ano de nacimiento + sexo', async ({ page }) => {
    await page.getByLabel(/tu peso/i).fill('65');
    await page.getByText(/no conoces tu fc máxima/i).click();
    await page.getByLabel(/año de nacimiento/i).fill('1980');
    await expect(page.getByText(/FC máxima estimada/i)).not.toBeVisible();
    await page.getByRole('radio', { name: /mujer/i }).click();
    await expect(page.getByText(/FC máxima estimada/i)).toBeVisible();
  });
});

// =====================================================================
// Paso "Datos" en running
// =====================================================================

test.describe('Cadencia - paso Datos (run + gpx)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDataStep(page, 'run', 'gpx');
  });

  test('formulario adaptado: solo FC, sin peso ni FTP ni bici', async ({ page }) => {
    await expect(page.getByLabel(/^fc máxima$/i)).toBeVisible();
    await expect(page.getByLabel(/tu peso/i)).not.toBeVisible();
    await expect(page.getByText(/¿tienes potenciómetro\?/i)).not.toBeVisible();
    await expect(page.getByText(/bici y peso/i)).not.toBeVisible();
  });

  test('boton Siguiente se habilita solo con FC valida', async ({ page }) => {
    const submit = page.getByRole('button', { name: /^plan$/i }).first();
    await expect(submit).toBeDisabled();
    await fillRunUserData(page);
    await expect(submit).toBeEnabled();
  });
});

// =====================================================================
// Paso "Ruta" (GPX outdoor)
// =====================================================================

test.describe('Cadencia - paso Ruta', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDataStep(page, 'bike', 'gpx');
    await fillBikeUserData(page);
    await page.getByRole('button', { name: /^plan$/i }).first().click();
  });

  test('muestra dropzone tras navegar a Ruta', async ({ page }) => {
    await expect(page.getByText(/arrastra tu gpx/i)).toBeVisible();
  });

  test('procesa un GPX subido y muestra perfil + summary', async ({ page }) => {
    await uploadGpx(page, buildSyntheticGpx());
    await expect(page.getByRole('heading', { name: /perfil de la ruta/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/distancia/i).first()).toBeVisible();
    await expect(page.getByText(/km/i).first()).toBeVisible();
  });

  test('muestra error legible si subes un archivo no-GPX', async ({ page }) => {
    await uploadGpx(page, 'no soy un gpx', 'badfile.txt');
    await expect(page.getByText(/extensión \.gpx/i)).toBeVisible();
  });
});

// =====================================================================
// Paso "Sesion" (indoor cycling) — confirma que se ven plantillas de bike
// =====================================================================

test.describe('Cadencia - paso Sesion bike (indoor cycling)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDataStep(page, 'bike', 'session');
    await fillBikeSessionUserData(page);
    await page.getByRole('button', { name: /^plan$/i }).first().click();
  });

  test('muestra plantillas de ciclismo y boton Importar .zwo', async ({ page }) => {
    await expect(page.getByText(/noruego 4×4/i)).toBeVisible();
    await expect(page.getByText(/sit/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /importar \.zwo/i })).toBeVisible();
  });

  test('NO muestra plantillas exclusivas de running', async ({ page }) => {
    await expect(page.getByText(/yasso 800/i)).not.toBeVisible();
    await expect(page.getByText(/daniels intervals/i)).not.toBeVisible();
  });
});

// =====================================================================
// Paso "Sesion" (running) — confirma plantillas de carrera y sin .zwo
// =====================================================================

test.describe('Cadencia - paso Sesion run (carrera)', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDataStep(page, 'run', 'session');
    await fillRunUserData(page);
    await page.getByRole('button', { name: /^plan$/i }).first().click();
  });

  test('muestra plantillas de running', async ({ page }) => {
    await expect(page.getByText(/easy long run/i)).toBeVisible();
    await expect(page.getByText(/yasso 800/i)).toBeVisible();
    await expect(page.getByText(/daniels intervals/i)).toBeVisible();
    await expect(page.getByText(/threshold cruise/i)).toBeVisible();
  });

  test('NO muestra plantillas de ciclismo ni boton .zwo', async ({ page }) => {
    await expect(page.getByText(/noruego 4×4/i)).not.toBeVisible();
    await expect(page.getByText(/zona 2 continuo/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /importar \.zwo/i })).not.toBeVisible();
  });

  test('Card del builder dice "sesión de carrera", no "indoor"', async ({ page }) => {
    await expect(page.getByText(/tu sesión de carrera/i)).toBeVisible();
  });
});
