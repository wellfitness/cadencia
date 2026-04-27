import { describe, it, expect } from 'vitest';
import { buildPlaylistDescription, buildPlaylistName, extractUris } from './builder';
import type { MatchedSegment } from '../matching/types';
import type { RouteMeta } from '../segmentation/types';

describe('buildPlaylistName', () => {
  const date = new Date('2026-04-26T10:00:00Z');

  it('formato "Cadencia - {ruta} - YYYY-MM-DD"', () => {
    expect(buildPlaylistName('Mi ruta', date)).toBe(
      'Cadencia - Mi ruta - 2026-04-26',
    );
  });

  it('ruta vacia usa "Sin título"', () => {
    expect(buildPlaylistName('', date)).toBe('Cadencia - Sin título - 2026-04-26');
    expect(buildPlaylistName('   ', date)).toBe('Cadencia - Sin título - 2026-04-26');
  });

  it('pad cero en mes y dia', () => {
    expect(buildPlaylistName('R', new Date('2026-01-05T10:00:00Z'))).toContain('2026-01-05');
  });
});

describe('buildPlaylistDescription', () => {
  const baseMeta: RouteMeta = {
    name: 'X',
    totalDistanceMeters: 5000,
    totalElevationGainMeters: 117,
    totalElevationLossMeters: 100,
    totalDurationSec: 480,
    averagePowerWatts: 200,
    normalizedPowerWatts: 220,
    zoneDurationsSec: { 1: 0, 2: 0, 3: 60, 4: 60, 5: 360, 6: 0 },
    hadRealTimestamps: true,
  };

  it('incluye km con 1 decimal, desnivel entero y duracion', () => {
    const desc = buildPlaylistDescription(baseMeta);
    expect(desc).toContain('5.0 km');
    expect(desc).toContain('117 m+');
    expect(desc).toContain('8 min');
  });

  it('cabe en el limite de Spotify (300 chars)', () => {
    expect(buildPlaylistDescription(baseMeta).length).toBeLessThanOrEqual(300);
  });
});

describe('extractUris', () => {
  function fakeMatched(uri: string | null): MatchedSegment {
    return {
      startSec: 0,
      durationSec: 60,
      avgPowerWatts: 200,
      zone: 3,
      cadenceProfile: 'flat',
      startDistanceMeters: 0,
      endDistanceMeters: 100,
      startElevationMeters: 100,
      endElevationMeters: 100,
      startLat: 42,
      startLon: -8,
      track:
        uri === null
          ? null
          : {
              uri,
              name: 'T',
              album: 'A',
              artists: [],
              genres: [],
              tempoBpm: 120,
              energy: 0.5,
              valence: 0.5,
              danceability: 0.5,
              durationMs: 0,
              source: 'cinelli_rider',
            },
      matchScore: 0.5,
      matchQuality: 'strict',
    };
  }

  it('mapea las URIs en orden', () => {
    expect(
      extractUris([
        fakeMatched('spotify:track:a'),
        fakeMatched('spotify:track:b'),
        fakeMatched('spotify:track:c'),
      ]),
    ).toEqual(['spotify:track:a', 'spotify:track:b', 'spotify:track:c']);
  });

  it('omite tracks null', () => {
    expect(
      extractUris([
        fakeMatched('spotify:track:a'),
        fakeMatched(null),
        fakeMatched('spotify:track:c'),
      ]),
    ).toEqual(['spotify:track:a', 'spotify:track:c']);
  });

  it('lista vacia -> []', () => {
    expect(extractUris([])).toEqual([]);
  });
});
