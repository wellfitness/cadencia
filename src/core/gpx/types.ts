/**
 * Punto crudo del GPX, ya parseado a tipos primitivos.
 * `time` puede ser null si el GPX no trae timestamps por punto.
 */
export interface GpxPoint {
  lat: number;
  lon: number;
  ele: number; // metros sobre nivel del mar
  time: Date | null;
}

export interface GpxTrack {
  name: string;
  points: GpxPoint[];
  hasTimestamps: boolean;
}

/**
 * Segmento entre dos puntos consecutivos del track. Es la unidad sobre la que
 * la fisica calcula potencia: cada segmento tiene una distancia, una pendiente,
 * y una duracion (real si hay timestamps, estimada si no).
 */
export interface DistanceSegment {
  /** Indice del punto inicial dentro de track.points. */
  fromIndex: number;
  /** Indice del punto final (siempre fromIndex + 1). */
  toIndex: number;
  distanceMeters: number;
  /** Positivo subida, negativo bajada. */
  elevationDeltaMeters: number;
  /** Pendiente en porcentaje, clampada a [-30, 30] para descartar ruido GPS extremo. */
  slopePercent: number;
  durationSeconds: number;
  speedMps: number;
}
