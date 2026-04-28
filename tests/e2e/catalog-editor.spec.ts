import { test, expect, type Page } from '@playwright/test';

/**
 * E2E del editor del catalogo nativo (`/catalogo`).
 *
 * El editor es independiente del wizard: NO requiere haber rellenado datos,
 * subido GPX ni nada. Por eso los tests entran directos a la URL.
 */

async function gotoCatalog(page: Page): Promise<void> {
  await page.goto('/catalogo');
  // Esperar a que cargue el header del editor.
  await expect(
    page.getByRole('heading', { name: /personalizar cat[aá]logo nativo/i, level: 1 }),
  ).toBeVisible();
}

test.describe('Cadencia - editor del catalogo nativo', () => {
  test('carga la pagina con el catalogo entero marcado por defecto', async ({ page }) => {
    await gotoCatalog(page);

    // El contador del header debe mostrar "X de Y canciones marcadas" con
    // X === Y (todas marcadas).
    const counter = page
      .locator('p[aria-live="polite"]')
      .filter({ hasText: /canciones marcadas/i })
      .first();
    await expect(counter).toBeVisible();
    const text = (await counter.textContent()) ?? '';
    const match = text.match(/(\d+)\s*de\s*(\d+)/);
    expect(match).not.toBeNull();
    if (match !== null) {
      const included = Number(match[1]);
      const total = Number(match[2]);
      expect(total).toBeGreaterThan(0);
      expect(included).toBe(total);
    }
  });

  test('el boton Volver a la musica esta visible', async ({ page }) => {
    await gotoCatalog(page);
    await expect(page.getByRole('button', { name: /volver a la m[uú]sica/i })).toBeVisible();
  });

  test('el campo de busqueda filtra el listado en vivo', async ({ page }) => {
    await gotoCatalog(page);
    // Lista visible al cargar: muchas filas (no las contamos exactas).
    const search = page.getByPlaceholder(/buscar por canci[oó]n/i);
    await search.fill('Queen');

    // El contador debe pintar "X visibles" tras filtrar.
    const visibles = page.locator('p[aria-live="polite"]').filter({ hasText: /visibles/i });
    await expect(visibles).toBeVisible();
  });

  test('desmarcar una fila reduce el contador', async ({ page }) => {
    await gotoCatalog(page);
    const counter = page.locator('p[aria-live="polite"]').first();
    const before = await counter.textContent();
    const beforeMatch = before?.match(/(\d+)\s*de/);
    expect(beforeMatch).not.toBeNull();
    const beforeCount = Number(beforeMatch?.[1] ?? '0');

    // Desmarcar el primer checkbox (los del header — search/Bpm — son input
    // pero no checkbox; el primer checkbox es de un track).
    const firstCheckbox = page.getByRole('checkbox').first();
    await firstCheckbox.uncheck();

    // El contador debe haber bajado en 1.
    await expect(counter).not.toHaveText(before ?? '');
    const after = (await counter.textContent()) ?? '';
    const afterMatch = after.match(/(\d+)\s*de/);
    expect(afterMatch).not.toBeNull();
    const afterCount = Number(afterMatch?.[1] ?? '0');
    expect(afterCount).toBe(beforeCount - 1);
  });

  test('descargar CSV emite un download con cabecera esperada', async ({ page }) => {
    await gotoCatalog(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /descargar csv/i }).click();
    const download = await downloadPromise;

    // Nombre del archivo configurado en el handler.
    expect(download.suggestedFilename()).toBe('cadencia-mi-catalogo.csv');

    // Verificar contenido leyendo el path temporal.
    const path = await download.path();
    expect(path).not.toBeNull();
    if (path !== null) {
      const fs = await import('node:fs/promises');
      const content = await fs.readFile(path, 'utf-8');
      const firstLine = content.split(/\r?\n/)[0];
      expect(firstLine).toBe(
        'Track URI,Track Name,Artist Name(s),Album Name,Genres,Tempo,Energy,Valence,Danceability,Duration (ms)',
      );
      // Debe haber al menos algunas filas mas alla de la cabecera.
      const dataLines = content
        .split(/\r?\n/)
        .filter((l) => l.trim() !== '')
        .slice(1);
      expect(dataLines.length).toBeGreaterThan(10);
    }
  });

  test('boton Descargar se deshabilita si no hay nada marcado', async ({ page }) => {
    await gotoCatalog(page);
    // "Desmarcar todas las visibles" sin filtro = desmarcar todo el catalogo.
    await page.getByRole('button', { name: /desmarcar todas las visibles/i }).click();

    const downloadBtn = page.getByRole('button', { name: /descargar csv/i });
    await expect(downloadBtn).toBeDisabled();
  });
});
