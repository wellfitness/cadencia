import { test, expect } from '@playwright/test';

/**
 * E2E de las rutas auxiliares fuera del wizard principal:
 *  - /calendario  — planificacion de entrenamientos.
 *  - /preferencias — hub de datos del usuario.
 *  - /tv          — modo pantalla completa (sin handoff valido vuelve a home).
 *  - /catalogo    — editor del catalogo nativo.
 *  - /ayuda       — articulos de ayuda.
 *
 * Cubren las paginas que el code splitting carga lazy: validan que el
 * Suspense + fallback funcionan y que los chunks se cargan correctamente.
 */

test.describe('Cadencia - ruta /calendario', () => {
  test('carga la pagina con titulo y vistas Lista/Mes', async ({ page }) => {
    await page.goto('/calendario');
    // Titulo principal de la pagina (h1 o similar).
    await expect(page.getByText(/calendario/i).first()).toBeVisible();
    // Switch entre vista lista y vista mes (tabs o botones).
    await expect(page.getByRole('button', { name: /lista/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /mes/i }).first()).toBeVisible();
  });

  test('boton volver lleva a la home', async ({ page }) => {
    await page.goto('/calendario');
    await page.getByRole('button', { name: /volver/i }).first().click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('Cadencia - ruta /preferencias', () => {
  test('carga la pagina con secciones de datos del usuario', async ({ page }) => {
    await page.goto('/preferencias');
    // El hub muestra al menos los datos fisicos y la musica.
    await expect(page.getByText(/datos personales|datos fisiologicos|tus datos/i).first()).toBeVisible();
  });

  test('alias /cuenta redirige al mismo contenido (retrocompatibilidad)', async ({ page }) => {
    await page.goto('/cuenta');
    // No comprueba redirect URL (la app pinta el mismo componente sin
    // cambiar el path), solo que la pagina renderiza algo coherente.
    await expect(page.getByText(/datos personales|datos fisiologicos|tus datos/i).first()).toBeVisible();
  });
});

test.describe('Cadencia - ruta /tv', () => {
  test('sin handoff devuelve un placeholder o vuelve a la home', async ({ page }) => {
    await page.goto('/tv');
    // El comportamiento exacto puede ser: mostrar mensaje o redirigir.
    // Validamos que no crashea y que hay contenido visible.
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Cadencia - ruta /catalogo', () => {
  test('carga el editor con tabs y boton Volver', async ({ page }) => {
    await page.goto('/catalogo');
    // Tabs del editor (nativo, listas propias, descartadas).
    await expect(page.getByText(/nativo|listas propias|descartad/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /volver/i }).first()).toBeVisible();
  });
});

test.describe('Cadencia - ruta /ayuda', () => {
  test('home de ayuda lista articulos', async ({ page }) => {
    await page.goto('/ayuda');
    await expect(page.getByText(/ayuda/i).first()).toBeVisible();
  });
});
