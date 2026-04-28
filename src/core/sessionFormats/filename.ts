/**
 * Limpia caracteres problemáticos para nombres de archivo (Windows/macOS).
 * Espacios y acentos sí se aceptan; lo que se quita son separadores de ruta
 * (`/`, `\`) y caracteres reservados (`:*?"<>|`).
 *
 * Se usa para construir el nombre del fichero al descargar workouts (.zwo)
 * desde el SessionBuilder o el ResultStep en modo GPX.
 */
export function sanitizeFilename(name: string): string {
  const trimmed = name.trim().replace(/[\\/:*?"<>|]/g, '');
  return trimmed.length > 0 ? trimmed : 'workout';
}
