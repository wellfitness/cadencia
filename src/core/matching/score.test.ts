import { describe, it, expect } from 'vitest';
import { scoreTrack } from './score';
import { getZoneCriteria } from './zoneCriteria';
import type { Track } from '../tracks/types';

function track(overrides: Partial<Track> = {}): Track {
  return {
    uri: 'spotify:track:abc',
    name: 'Track',
    album: 'Album',
    artists: ['Artist'],
    genres: [],
    tempoBpm: 80,
    energy: 0.5,
    valence: 0.5,
    danceability: 0.5,
    durationMs: 200_000,
    source: 'cinelli_rider',
    ...overrides,
  };
}

describe('scoreTrack', () => {
  // Z3 flat: cadencia 70-90 rpm. Midpoint 1:1 = 80, midpoint 2:1 = 160.
  // energyIdeal = 0.70, valenceIdeal = 0.55.
  // Pesos sin preferencias (BASE): cadencia 0.30, energy 0.30, valence 0.20,
  //                                 genre 0.20 (con genreScore=0.5 neutro).
  // Pesos con preferencias (PREF): cadencia 0.30, energy 0.25, valence 0.10,
  //                                 genre 0.35.
  const z3 = getZoneCriteria(3, 'flat', 'bike');

  it('track perfecto en todas las dimensiones puntua cerca de 1', () => {
    // `electronic` es el macro que contiene el tag 'edm'.
    const t = track({ tempoBpm: 80, energy: 0.7, valence: 0.55, genres: ['edm'] });
    const score = scoreTrack(t, z3, ['electronic']);
    expect(score).toBeCloseTo(1.0, 1);
  });

  it('cadencia perfecta 1:1 + ideales perfectos + sin preferencia genero (neutro 0.5)', () => {
    const t = track({ tempoBpm: 80, energy: 0.7, valence: 0.55 });
    // cadencia=1, energy=1, valence=1, genre=0.5 (neutro)
    // = 0.30*1 + 0.30*1 + 0.20*1 + 0.20*0.5 = 0.30+0.30+0.20+0.10 = 0.90
    expect(scoreTrack(t, z3, [])).toBeCloseTo(0.9, 2);
  });

  it('cadencia perfecta 2:1 (half-time) puntua igual que 1:1', () => {
    const t1 = track({ tempoBpm: 160, energy: 0.7, valence: 0.55 });
    const t2 = track({ tempoBpm: 80, energy: 0.7, valence: 0.55 });
    expect(scoreTrack(t1, z3, [])).toBeCloseTo(scoreTrack(t2, z3, []), 2);
  });

  it('genero matcheado vs no matcheado: diferencia exactamente W_GENRE_PREF = 0.35', () => {
    // Con preferencias activas el peso del genero sube de 0.20 a 0.35 para
    // que la eleccion explicita pese mas que el sesgo del catalogo.
    const matched = track({ tempoBpm: 80, energy: 0.7, valence: 0.55, genres: ['edm'] });
    const unmatched = track({ tempoBpm: 80, energy: 0.7, valence: 0.55, genres: ['rock'] });
    const diff =
      scoreTrack(matched, z3, ['electronic']) - scoreTrack(unmatched, z3, ['electronic']);
    expect(diff).toBeCloseTo(0.35, 2);
  });

  it('reweight con preferencias activas: track perfecto suma 1.00 con pesos PREF', () => {
    // Pesos PREF: 0.30 + 0.25 + 0.10 + 0.35 = 1.00.
    // Track perfecto = cadencia 1, energy 1, valence 1, genero matched 1.
    const t = track({ tempoBpm: 80, energy: 0.7, valence: 0.55, genres: ['edm'] });
    expect(scoreTrack(t, z3, ['electronic'])).toBeCloseTo(1.0, 5);
  });

  it('reweight con preferencias: el peso de genero supera al de cadencia perdida', () => {
    const trackA = track({ tempoBpm: 85, energy: 0.7, valence: 0.55, genres: ['edm'] });
    const trackB = track({ tempoBpm: 80, energy: 0.7, valence: 0.55, genres: ['rock'] });
    const scoreA = scoreTrack(trackA, z3, ['electronic']);
    const scoreB = scoreTrack(trackB, z3, ['electronic']);
    expect(scoreA).toBeGreaterThan(scoreB);
  });

  it('preferredGenres expande de macro a tags: marcar "house" matchea cualquier sub-house', () => {
    // Si el usuario marca el macro 'house', un track con tag 'tropical house'
    // debe puntuar como matched (1), no como no-matched (0).
    const tropical = track({
      tempoBpm: 80,
      energy: 0.7,
      valence: 0.55,
      genres: ['tropical house'],
    });
    const noHouse = track({
      tempoBpm: 80,
      energy: 0.7,
      valence: 0.55,
      genres: ['rock'],
    });
    const diff = scoreTrack(tropical, z3, ['house']) - scoreTrack(noHouse, z3, ['house']);
    expect(diff).toBeCloseTo(0.35, 2);
  });

  it('compatibilidad: tag literal en preferredGenres se trata como antes', () => {
    // Datos antiguos en storage podian guardar tags directos. El motor los
    // sigue tratando como literales para no romper la transicion.
    const matched = track({
      tempoBpm: 80,
      energy: 0.7,
      valence: 0.55,
      genres: ['edm-tag-raro'],
    });
    const score = scoreTrack(matched, z3, ['edm-tag-raro']);
    // Con un literal cualquiera el match aplica via fallback de tag literal.
    expect(score).toBeGreaterThan(0.9);
  });

  it('cadencia en el borde (90 rpm 1:1) y energy/valence lejos: score bajo', () => {
    // Track en el borde 1:1 y muy lejos del 2:1 midpoint (160).
    const t = track({ tempoBpm: 90, energy: 0, valence: 0 });
    // cadencia=0
    // energy: dist=0.7 → cuadratico (1-0.7)² = 0.09
    // valence: dist=0.55 → cuadratico (1-0.55)² ≈ 0.2025
    // genre=0.5
    // = 0.30*0 + 0.30*0.09 + 0.20*0.2025 + 0.20*0.5
    // = 0 + 0.027 + 0.0405 + 0.10 = 0.1675
    const score = scoreTrack(t, z3, []);
    expect(score).toBeCloseTo(0.17, 2);
  });

  it('energy lejos del ideal reduce score pero no descarta', () => {
    const tIdeal = track({ tempoBpm: 80, energy: 0.7, valence: 0.55 });
    const tFar = track({ tempoBpm: 80, energy: 0.0, valence: 0.55 });
    const dIdeal = scoreTrack(tIdeal, z3, []);
    const dFar = scoreTrack(tFar, z3, []);
    expect(dFar).toBeLessThan(dIdeal);
    expect(dFar).toBeGreaterThan(0); // sigue siendo candidato
  });

  it('track de catalogo predefinido (source != "user") queda en [0..1]', () => {
    const t = track({ tempoBpm: 80, energy: 1, valence: 1, genres: ['edm'] });
    const score = scoreTrack(t, z3, ['edm']);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('determinista: misma entrada da misma salida', () => {
    const t = track({ tempoBpm: 80, energy: 0.65, valence: 0.5, genres: ['trance'] });
    const a = scoreTrack(t, z3, ['trance']);
    const b = scoreTrack(t, z3, ['trance']);
    expect(a).toBe(b);
  });

  it('track con source "user" recibe bonus aditivo de 0.08 sobre el score base', () => {
    const base = track({ tempoBpm: 80, energy: 0.7, valence: 0.55, source: 'cinelli_rider' });
    const userTrack = track({ tempoBpm: 80, energy: 0.7, valence: 0.55, source: 'user' });
    const diff = scoreTrack(userTrack, z3, []) - scoreTrack(base, z3, []);
    expect(diff).toBeCloseTo(0.08, 5);
  });

  it('bonus user puede empujar el score por encima de 1.0', () => {
    // Track perfecto en todas las dimensiones (genero matched) + source 'user':
    // cadencia=1, energy=1, valence=1, genre=1 → 1.0 + 0.08 = 1.08
    const t = track({
      tempoBpm: 80,
      energy: 0.7,
      valence: 0.55,
      genres: ['edm'],
      source: 'user',
    });
    expect(scoreTrack(t, z3, ['edm'])).toBeCloseTo(1.08, 2);
  });

  it('bonus user es uniforme: dos tracks "user" identicos puntuan igual', () => {
    const a = track({ tempoBpm: 80, energy: 0.7, valence: 0.55, source: 'user' });
    const b = track({ tempoBpm: 80, energy: 0.7, valence: 0.55, source: 'user' });
    expect(scoreTrack(a, z3, [])).toBe(scoreTrack(b, z3, []));
  });
});
