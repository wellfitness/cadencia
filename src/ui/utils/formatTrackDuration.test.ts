import { describe, it, expect } from 'vitest';
import { formatTrackDuration } from './formatTrackDuration';

describe('formatTrackDuration', () => {
  it('formatea milisegundos a m:ss', () => {
    expect(formatTrackDuration(225_000)).toBe('3:45');
  });

  it('rellena los segundos < 10 con un cero', () => {
    expect(formatTrackDuration(125_000)).toBe('2:05');
  });

  it('redondea al segundo más cercano', () => {
    expect(formatTrackDuration(3_900)).toBe('0:04');
  });

  it('0 ms → 0:00', () => {
    expect(formatTrackDuration(0)).toBe('0:00');
  });

  it('expresa duraciones de más de una hora en minutos totales', () => {
    expect(formatTrackDuration(3_725_000)).toBe('62:05');
  });
});
