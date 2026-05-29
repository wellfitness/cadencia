import { describe, it, expect } from 'vitest';
import {
  cleanTitleForDedup,
  normalizeArtistsForDedup,
  dedupKey,
  sortByTitleThenArtist,
  annotateDuplicates,
  type AnnotatedItem,
} from './duplicates';
import type { Track } from './types';

/** Construye un Track mínimo para tests; solo name/artists/uri importan aquí. */
function makeTrack(
  partial: Pick<Track, 'name' | 'artists'> & Partial<Track>,
): Track {
  return {
    uri: partial.uri ?? `spotify:track:${partial.name}`,
    name: partial.name,
    album: partial.album ?? '',
    artists: partial.artists,
    genres: partial.genres ?? [],
    tempoBpm: partial.tempoBpm ?? 120,
    energy: partial.energy ?? 0.5,
    valence: partial.valence ?? 0.5,
    danceability: partial.danceability ?? 0.5,
    durationMs: partial.durationMs ?? 200_000,
    source: partial.source ?? 'test',
  };
}

function groupSizeByUri(ann: ReadonlyArray<AnnotatedItem<Track>>, uri: string): number {
  const found = ann.find((x) => x.item.uri === uri);
  if (found === undefined) throw new Error(`uri ${uri} no está en la anotación`);
  return found.groupSize;
}

describe('cleanTitleForDedup', () => {
  it('quita el sufijo "- Remastered 2011"', () => {
    expect(cleanTitleForDedup('We Are The Champions - Remastered 2011')).toBe(
      'we are the champions',
    );
  });

  it('quita "- Live", "- Radio Edit" y "- 2009 Remaster"', () => {
    expect(cleanTitleForDedup('Imagine - Live')).toBe('imagine');
    expect(cleanTitleForDedup('Halo - Radio Edit')).toBe('halo');
    expect(cleanTitleForDedup('Whatever - 2009 Remaster')).toBe('whatever');
  });

  it('quita paréntesis y corchetes con palabra clave de versión', () => {
    expect(cleanTitleForDedup('Song (2011 Remaster)')).toBe('song');
    expect(cleanTitleForDedup('Song [Deluxe]')).toBe('song');
    expect(cleanTitleForDedup('Song (Live)')).toBe('song');
  });

  it('quita el segmento feat./ft./featuring hasta el final', () => {
    expect(cleanTitleForDedup('Song (feat. Other Artist)')).toBe('song');
    expect(cleanTitleForDedup('Song feat. Other Artist')).toBe('song');
    expect(cleanTitleForDedup('Song ft. X')).toBe('song');
  });

  it('es insensible a tildes', () => {
    expect(cleanTitleForDedup('Café')).toBe(cleanTitleForDedup('cafe'));
  });

  it('CONSERVA paréntesis sin palabra clave de versión', () => {
    // "(Part 2)" no es una versión; debe distinguirse de "(Part 1)".
    expect(cleanTitleForDedup('Song (Part 2)')).not.toBe(
      cleanTitleForDedup('Song (Part 1)'),
    );
  });

  it('CONSERVA un título que es exactamente una palabra clave (sin sufijo)', () => {
    expect(cleanTitleForDedup('Live')).toBe('live');
  });

  it('salvaguarda: un título que solo es "(Live)" no queda vacío', () => {
    expect(cleanTitleForDedup('(Live)')).not.toBe('');
  });
});

describe('normalizeArtistsForDedup', () => {
  it('es insensible al orden de los artistas', () => {
    expect(normalizeArtistsForDedup(['Queen', 'David Bowie'])).toBe(
      normalizeArtistsForDedup(['David Bowie', 'Queen']),
    );
  });

  it('es insensible a tildes', () => {
    expect(normalizeArtistsForDedup(['Beyoncé'])).toBe(
      normalizeArtistsForDedup(['Beyonce']),
    );
  });

  it('ignora cadenas vacías', () => {
    expect(normalizeArtistsForDedup(['Queen', ''])).toBe(
      normalizeArtistsForDedup(['Queen']),
    );
  });
});

describe('dedupKey', () => {
  it('agrupa una canción con su remaster del mismo artista', () => {
    const a = makeTrack({ name: 'We Are The Champions', artists: ['Queen'] });
    const b = makeTrack({
      name: 'We Are The Champions - Remastered 2011',
      artists: ['Queen'],
    });
    expect(dedupKey(a)).toBe(dedupKey(b));
  });

  it('NO agrupa mismo título de artistas distintos', () => {
    // Caso real de all.csv: dos "Imagine" de artistas distintos.
    const lennon = makeTrack({ name: 'Imagine - Remastered 2010', artists: ['John Lennon'] });
    const madonna = makeTrack({ name: 'Imagine - Live', artists: ['Madonna'] });
    expect(dedupKey(lennon)).not.toBe(dedupKey(madonna));
  });

  it('devuelve cadena vacía para un título vacío', () => {
    expect(dedupKey(makeTrack({ name: '', artists: ['X'] }))).toBe('');
  });
});

describe('sortByTitleThenArtist', () => {
  it('ordena por título limpio y luego por artista', () => {
    const tracks = [
      makeTrack({ name: 'Zebra', artists: ['X'] }),
      makeTrack({ name: 'Apple - Live', artists: ['Queen'] }),
      makeTrack({ name: 'Apple', artists: ['Adele'] }),
    ];
    const sorted = sortByTitleThenArtist(
      tracks,
      (t) => t.name,
      (t) => t.artists,
    );
    expect(sorted.map((t) => t.name)).toEqual(['Apple', 'Apple - Live', 'Zebra']);
  });

  it('es estable: misma clave preserva el orden de entrada', () => {
    const a = makeTrack({ uri: 'spotify:track:1', name: 'Same', artists: ['A'] });
    const b = makeTrack({ uri: 'spotify:track:2', name: 'Same', artists: ['A'] });
    const sorted = sortByTitleThenArtist(
      [a, b],
      (t) => t.name,
      (t) => t.artists,
    );
    expect(sorted.map((t) => t.uri)).toEqual(['spotify:track:1', 'spotify:track:2']);
  });

  it('no muta el array de entrada', () => {
    const tracks = [
      makeTrack({ name: 'B', artists: ['X'] }),
      makeTrack({ name: 'A', artists: ['X'] }),
    ];
    const before = tracks.map((t) => t.name);
    sortByTitleThenArtist(
      tracks,
      (t) => t.name,
      (t) => t.artists,
    );
    expect(tracks.map((t) => t.name)).toEqual(before);
  });
});

describe('annotateDuplicates', () => {
  it('calcula groupSize sobre el conjunto, contando versiones', () => {
    const champ = makeTrack({ uri: 'a', name: 'We Are The Champions', artists: ['Queen'] });
    const champRe = makeTrack({
      uri: 'b',
      name: 'We Are The Champions - Remastered 2011',
      artists: ['Queen'],
    });
    const other = makeTrack({ uri: 'c', name: 'Bohemian Rhapsody', artists: ['Queen'] });
    const ann = annotateDuplicates([champ, champRe, other], (t) => t);
    expect(groupSizeByUri(ann, 'a')).toBe(2);
    expect(groupSizeByUri(ann, 'b')).toBe(2);
    expect(groupSizeByUri(ann, 'c')).toBe(1);
  });

  it('preserva el orden de entrada (no ordena)', () => {
    const z = makeTrack({ uri: 'z', name: 'Zebra', artists: ['X'] });
    const a = makeTrack({ uri: 'a', name: 'Apple', artists: ['X'] });
    const ann = annotateDuplicates([z, a], (t) => t);
    expect(ann.map((x) => x.item.uri)).toEqual(['z', 'a']);
  });

  it('los títulos vacíos no se agrupan entre sí (groupSize 1)', () => {
    const e1 = makeTrack({ uri: 'e1', name: '', artists: ['A'] });
    const e2 = makeTrack({ uri: 'e2', name: '', artists: ['B'] });
    const ann = annotateDuplicates([e1, e2], (t) => t);
    expect(groupSizeByUri(ann, 'e1')).toBe(1);
    expect(groupSizeByUri(ann, 'e2')).toBe(1);
  });

  it('funciona con envoltorios (trackOf extrae el track)', () => {
    const champ = makeTrack({ uri: 'a', name: 'Halo', artists: ['Beyoncé'] });
    const champRe = makeTrack({ uri: 'b', name: 'Halo - Radio Edit', artists: ['Beyoncé'] });
    const wrapped = [
      { track: champ, listName: 'L1' },
      { track: champRe, listName: 'L2' },
    ];
    const ann = annotateDuplicates(wrapped, (w) => w.track);
    expect(ann[0]?.groupSize).toBe(2);
    expect(ann[1]?.groupSize).toBe(2);
  });
});
