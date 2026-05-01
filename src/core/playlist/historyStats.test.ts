import { describe, it, expect } from 'vitest';
import {
  computeSummary,
  computeTopTracks,
  computeTopArtists,
  computeTopGenresByDuration,
  countReplacedTracks,
  countTotalTracks,
} from './historyStats';
import type { PlaylistHistoryEntry, PlaylistHistoryTrack } from './historyTypes';

function track(
  uri: string,
  name: string,
  artist: string,
  zone: 1 | 2 | 3 | 4 | 5 | 6,
  durationSec: number,
  genres: string[] = ['rock'],
  wasReplaced = false,
): PlaylistHistoryTrack {
  return {
    uri,
    name,
    artist,
    genres,
    tempoBpm: 80,
    zone,
    durationSec,
    matchQuality: 'strict',
    wasReplaced,
  };
}

function entry(
  id: string,
  tracks: PlaylistHistoryTrack[],
  sport: 'bike' | 'run' = 'bike',
): PlaylistHistoryEntry {
  const totalDurationSec = tracks.reduce((acc, t) => acc + t.durationSec, 0);
  const zoneDurations: Record<1 | 2 | 3 | 4 | 5 | 6, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  };
  for (const t of tracks) zoneDurations[t.zone] += t.durationSec;
  return {
    id,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    sport,
    mode: 'session',
    totalDurationSec,
    zoneDurations,
    seed: 42,
    tracks,
  };
}

describe('computeSummary', () => {
  it('agrega totalPlaylists y totalDurationSec', () => {
    const entries = [
      entry('e1', [track('u:1', 'A', 'X', 2, 120)]),
      entry('e2', [
        track('u:2', 'B', 'Y', 3, 60),
        track('u:3', 'C', 'Z', 4, 90),
      ]),
    ];
    const s = computeSummary(entries);
    expect(s.totalPlaylists).toBe(2);
    expect(s.totalDurationSec).toBe(270);
  });

  it('zoneDistribution suma duraciones por zona y calcula pctOfTotal', () => {
    const entries = [
      entry('e1', [track('u:1', 'A', 'X', 2, 100), track('u:2', 'B', 'Y', 4, 100)]),
    ];
    const s = computeSummary(entries);
    const z2 = s.zoneDistribution.find((z) => z.zone === 2);
    const z4 = s.zoneDistribution.find((z) => z.zone === 4);
    expect(z2?.totalDurationSec).toBe(100);
    expect(z2?.pctOfTotal).toBeCloseTo(0.5);
    expect(z4?.pctOfTotal).toBeCloseTo(0.5);
  });

  it('replacementRate cuenta wasReplaced sobre total', () => {
    const entries = [
      entry('e1', [
        track('u:1', 'A', 'X', 2, 60, ['rock'], true),
        track('u:2', 'B', 'Y', 2, 60, ['rock'], false),
      ]),
      entry('e2', [
        track('u:3', 'C', 'Z', 3, 60, ['rock'], false),
        track('u:4', 'D', 'W', 3, 60, ['rock'], true),
      ]),
    ];
    expect(computeSummary(entries).replacementRate).toBeCloseTo(0.5);
  });

  it('bySport cuenta playlists por deporte', () => {
    const entries = [
      entry('e1', [track('u:1', 'A', 'X', 2, 60)], 'bike'),
      entry('e2', [track('u:2', 'B', 'Y', 2, 60)], 'run'),
      entry('e3', [track('u:3', 'C', 'Z', 2, 60)], 'bike'),
    ];
    const s = computeSummary(entries);
    expect(s.bySport.bike).toBe(2);
    expect(s.bySport.run).toBe(1);
  });

  it('historial vacio devuelve summary nulo sin dividir por cero', () => {
    const s = computeSummary([]);
    expect(s.totalPlaylists).toBe(0);
    expect(s.totalDurationSec).toBe(0);
    expect(s.replacementRate).toBe(0);
    expect(s.zoneDistribution.every((z) => z.pctOfTotal === 0)).toBe(true);
  });
});

describe('computeTopTracks', () => {
  it('ordena por nº de apariciones desc', () => {
    const entries = [
      entry('e1', [track('u:1', 'A', 'X', 2, 60)]),
      entry('e2', [track('u:2', 'B', 'Y', 2, 60)]),
      entry('e3', [track('u:1', 'A', 'X', 2, 60)]),
      entry('e4', [track('u:1', 'A', 'X', 2, 60)]),
    ];
    const top = computeTopTracks(entries);
    expect(top[0]?.uri).toBe('u:1');
    expect(top[0]?.appearances).toBe(3);
    expect(top[1]?.uri).toBe('u:2');
    expect(top[1]?.appearances).toBe(1);
  });

  it('tie-break por replacementsByUser desc cuando hay empate de apariciones', () => {
    const entries = [
      entry('e1', [
        track('u:1', 'A', 'X', 2, 60, ['rock'], false),
        track('u:2', 'B', 'Y', 2, 60, ['rock'], true),
      ]),
      entry('e2', [
        track('u:1', 'A', 'X', 2, 60, ['rock'], false),
        track('u:2', 'B', 'Y', 2, 60, ['rock'], true),
      ]),
    ];
    const top = computeTopTracks(entries);
    expect(top[0]?.uri).toBe('u:2');
    expect(top[0]?.replacementsByUser).toBe(2);
    expect(top[1]?.uri).toBe('u:1');
  });

  it('respeta el limite', () => {
    const entries = [
      entry(
        'e1',
        Array.from({ length: 25 }, (_, i) => track(`u:${i}`, `T${i}`, 'X', 2, 60)),
      ),
    ];
    expect(computeTopTracks(entries, 5)).toHaveLength(5);
    expect(computeTopTracks(entries, 20)).toHaveLength(20);
  });

  it('limit por defecto de 20', () => {
    const entries = [
      entry(
        'e1',
        Array.from({ length: 30 }, (_, i) => track(`u:${i}`, `T${i}`, 'X', 2, 60)),
      ),
    ];
    expect(computeTopTracks(entries)).toHaveLength(20);
  });

  it('historial vacio devuelve []', () => {
    expect(computeTopTracks([])).toEqual([]);
  });
});

describe('computeTopArtists', () => {
  it('cuenta colaboraciones split por coma', () => {
    const entries = [
      entry('e1', [track('u:1', 'Song', 'Bowie, Queen', 2, 60)]),
      entry('e2', [track('u:2', 'Other', 'Bowie', 2, 60)]),
    ];
    const top = computeTopArtists(entries);
    expect(top[0]?.artist).toBe('Bowie');
    expect(top[0]?.appearances).toBe(2);
    expect(top[1]?.artist).toBe('Queen');
    expect(top[1]?.appearances).toBe(1);
  });

  it('uniqueTracks cuenta URIs distintas por artista', () => {
    const entries = [
      entry('e1', [track('u:1', 'A', 'Bowie', 2, 60)]),
      entry('e2', [track('u:1', 'A', 'Bowie', 2, 60)]),
      entry('e3', [track('u:2', 'B', 'Bowie', 2, 60)]),
    ];
    const top = computeTopArtists(entries);
    expect(top[0]?.appearances).toBe(3);
    expect(top[0]?.uniqueTracks).toBe(2);
  });

  it('respeta el limite', () => {
    const entries = [
      entry(
        'e1',
        Array.from({ length: 20 }, (_, i) => track(`u:${i}`, 'T', `A${i}`, 2, 60)),
      ),
    ];
    expect(computeTopArtists(entries, 5)).toHaveLength(5);
  });
});

describe('computeTopGenresByDuration', () => {
  it('ordena por duracion total, no por nº de apariciones', () => {
    // genero 'rock': 1 aparicion x 600s = 600s
    // genero 'pop':  3 apariciones x 30s = 90s
    const entries = [
      entry('e1', [
        track('u:1', 'A', 'X', 2, 600, ['rock']),
        track('u:2', 'B', 'Y', 6, 30, ['pop']),
        track('u:3', 'C', 'Z', 6, 30, ['pop']),
        track('u:4', 'D', 'W', 6, 30, ['pop']),
      ]),
    ];
    const top = computeTopGenresByDuration(entries);
    expect(top[0]?.genre).toBe('rock');
    expect(top[0]?.totalDurationSec).toBe(600);
    expect(top[0]?.appearances).toBe(1);
    expect(top[1]?.genre).toBe('pop');
    expect(top[1]?.appearances).toBe(3);
  });

  it('tracks con multiples generos cuentan en cada uno', () => {
    const entries = [
      entry('e1', [track('u:1', 'A', 'X', 2, 100, ['rock', 'classic-rock'])]),
    ];
    const top = computeTopGenresByDuration(entries);
    const genres = top.map((g) => g.genre);
    expect(genres).toContain('rock');
    expect(genres).toContain('classic-rock');
    expect(top.find((g) => g.genre === 'rock')?.totalDurationSec).toBe(100);
  });

  it('respeta el limite', () => {
    const entries = [
      entry(
        'e1',
        Array.from({ length: 20 }, (_, i) =>
          track(`u:${i}`, 'T', 'X', 2, 60, [`genre-${i}`]),
        ),
      ),
    ];
    expect(computeTopGenresByDuration(entries, 5)).toHaveLength(5);
  });
});

describe('helpers', () => {
  it('countReplacedTracks suma wasReplaced=true', () => {
    const entries = [
      entry('e1', [
        track('u:1', 'A', 'X', 2, 60, ['r'], true),
        track('u:2', 'B', 'Y', 2, 60, ['r'], false),
      ]),
      entry('e2', [track('u:3', 'C', 'Z', 2, 60, ['r'], true)]),
    ];
    expect(countReplacedTracks(entries)).toBe(2);
  });

  it('countTotalTracks suma todos los tracks', () => {
    const entries = [
      entry('e1', [track('u:1', 'A', 'X', 2, 60), track('u:2', 'B', 'Y', 2, 60)]),
      entry('e2', [track('u:3', 'C', 'Z', 2, 60)]),
    ];
    expect(countTotalTracks(entries)).toBe(3);
  });
});
