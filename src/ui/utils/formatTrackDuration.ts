/**
 * Formatea la duración de una pista (en milisegundos) a `m:ss`, p. ej. `3:45`.
 * Para canciones sueltas, no para totales de sesión (esos usan horas+minutos).
 * Las duraciones > 1 h se expresan en minutos totales (p. ej. `62:05`).
 */
export function formatTrackDuration(durationMs: number): string {
  const totalSec = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
