/**
 * Dispara la descarga de un archivo de texto en el navegador via `Blob` +
 * elemento `<a download>` invisible. Toca DOM, por eso vive en
 * `src/ui/utils/` y no en `src/core/`.
 *
 * El elemento ancla y la URL del Blob se limpian inmediatamente tras el
 * click para no dejar referencias colgando en el documento ni en el
 * registro interno de URLs del navegador.
 */
export function downloadTextFile(
  filename: string,
  mimeType: string,
  content: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
