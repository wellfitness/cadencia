import type { Track } from '@core/tracks';

/**
 * Una lista CSV subida por el usuario en MusicStep. Vive en memoria a nivel de
 * App (no en sessionStorage por tamano: los tracks parseados pueden ocupar
 * varios MB y romperian el limite de cuota). Sobrevive a remountajes del
 * paso pero no a un refresh de pestana.
 */
export interface UploadedCsv {
  id: string;
  name: string;
  trackCount: number;
  tracks: readonly Track[];
  error?: string;
}
