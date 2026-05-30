import { describe, it, expect, beforeEach } from 'vitest';
import {
  createUploadedCsv,
  listUploadedCsvs,
  getUploadedCsv,
  updateUploadedCsv,
  deleteUploadedCsv,
  removeTrackFromUploadedCsv,
} from './uploadedCsvs';
import { parseTrackCsv, serializeTracksToCsv, type Track } from '@core/tracks';
import { clearCadenciaData } from '@ui/state/cadenciaStore';

// CSV con todas las columnas que requiere parseTrackCsv (formato Exportify).
const SAMPLE_CSV =
  'Track URI,Track Name,Album Name,Artist Name(s),Genres,Danceability,Energy,Valence,Tempo,Duration (ms)\n' +
  'spotify:track:abc,Foo,Album1,The Bar,rock,0.5,0.7,0.6,120,180000\n' +
  'spotify:track:def,Baz,Album2,The Qux,pop,0.6,0.8,0.7,140,200000\n';

describe('uploadedCsvs CRUD', () => {
  beforeEach(() => clearCadenciaData());

  it('createUploadedCsv persiste y devuelve record con id', () => {
    const created = createUploadedCsv({ name: 'mi-rock.csv', csvText: SAMPLE_CSV });
    expect(created.id.length).toBeGreaterThan(0);
    expect(created.name).toBe('mi-rock.csv');
    expect(listUploadedCsvs()).toHaveLength(1);
  });

  it('createUploadedCsv calcula trackCount via parseTrackCsv', () => {
    const created = createUploadedCsv({ name: 'mi-rock.csv', csvText: SAMPLE_CSV });
    expect(created.trackCount).toBe(2);
  });

  it('listUploadedCsvs oculta tombstones', () => {
    const a = createUploadedCsv({ name: 'a.csv', csvText: SAMPLE_CSV });
    deleteUploadedCsv(a.id);
    expect(listUploadedCsvs()).toHaveLength(0);
  });

  it('getUploadedCsv devuelve null para tombstones', () => {
    const a = createUploadedCsv({ name: 'a.csv', csvText: SAMPLE_CSV });
    deleteUploadedCsv(a.id);
    expect(getUploadedCsv(a.id)).toBeNull();
  });

  it('updateUploadedCsv bumpea updatedAt y recalcula trackCount', async () => {
    const a = createUploadedCsv({ name: 'a.csv', csvText: SAMPLE_CSV });
    await new Promise((r) => setTimeout(r, 10));
    const newCsv =
      SAMPLE_CSV +
      'spotify:track:ghi,Quux,Album3,The Corge,jazz,0.7,0.9,0.8,160,220000\n';
    const after = updateUploadedCsv(a.id, { csvText: newCsv });
    expect(after?.trackCount).toBe(3);
    expect(new Date(after!.updatedAt).getTime()).toBeGreaterThan(
      new Date(a.updatedAt).getTime(),
    );
  });

  it('updateUploadedCsv devuelve null para id inexistente', () => {
    expect(updateUploadedCsv('no-existe', { name: 'X' })).toBeNull();
  });

  it('deleteUploadedCsv deja tombstone (no borra el item)', () => {
    const a = createUploadedCsv({ name: 'a.csv', csvText: SAMPLE_CSV });
    deleteUploadedCsv(a.id);
    const raw = localStorage.getItem('cadencia:data:v1');
    expect(raw).toContain('deletedAt');
  });

  it('listUploadedCsvs ordena por updatedAt descendente', async () => {
    const a = createUploadedCsv({ name: 'a.csv', csvText: SAMPLE_CSV });
    await new Promise((r) => setTimeout(r, 10));
    const b = createUploadedCsv({ name: 'b.csv', csvText: SAMPLE_CSV });
    const list = listUploadedCsvs();
    expect(list[0]?.id).toBe(b.id);
    expect(list[1]?.id).toBe(a.id);
  });
});

function makeTrack(uri: string, name: string): Track {
  return {
    uri,
    name,
    album: '',
    artists: ['Artista'],
    genres: [],
    tempoBpm: 120,
    energy: 0.5,
    valence: 0.5,
    danceability: 0.5,
    durationMs: 200_000,
    source: 'user',
  };
}

/** Lee y parsea el csvText vivo de una lista; lanza si no existe. */
function urisOf(id: string): string[] {
  const rec = getUploadedCsv(id);
  if (rec === null) throw new Error('lista no encontrada');
  return parseTrackCsv(rec.csvText, 'user').map((t) => t.uri);
}

describe('removeTrackFromUploadedCsv', () => {
  beforeEach(() => clearCadenciaData());

  it('quita la copia indicada y CONSERVA otra copia del mismo URI (deja una)', () => {
    // La misma cancion (URI 1) aparece dos veces: en los indices 0 y 2.
    const csv = serializeTracksToCsv([
      makeTrack('spotify:track:1', 'A'),
      makeTrack('spotify:track:2', 'B'),
      makeTrack('spotify:track:1', 'A'),
    ]);
    const rec = createUploadedCsv({ name: 'L', csvText: csv });

    const res = removeTrackFromUploadedCsv(rec.id, 2); // quita la 2a copia de A

    expect(res).not.toBeNull();
    // Queda UNA copia de la URI 1 (no se han ido las dos) + la URI 2.
    expect(urisOf(rec.id)).toEqual(['spotify:track:1', 'spotify:track:2']);
  });

  it('quita por posicion, no por URI (respeta el indice exacto)', () => {
    const csv = serializeTracksToCsv([
      makeTrack('spotify:track:1', 'A'),
      makeTrack('spotify:track:2', 'B'),
      makeTrack('spotify:track:3', 'C'),
    ]);
    const rec = createUploadedCsv({ name: 'L', csvText: csv });

    removeTrackFromUploadedCsv(rec.id, 1); // quita B

    expect(urisOf(rec.id)).toEqual(['spotify:track:1', 'spotify:track:3']);
  });

  it('indice fuera de rango devuelve null y no altera la lista', () => {
    const csv = serializeTracksToCsv([makeTrack('spotify:track:1', 'A')]);
    const rec = createUploadedCsv({ name: 'L', csvText: csv });

    expect(removeTrackFromUploadedCsv(rec.id, 5)).toBeNull();
    expect(urisOf(rec.id)).toEqual(['spotify:track:1']);
  });

  it('lista inexistente devuelve null', () => {
    expect(removeTrackFromUploadedCsv('no-existe', 0)).toBeNull();
  });

  it('devuelve prevCsvText y el nombre, permitiendo deshacer (restaurar)', () => {
    const csv = serializeTracksToCsv([
      makeTrack('spotify:track:1', 'A'),
      makeTrack('spotify:track:2', 'B'),
    ]);
    const rec = createUploadedCsv({ name: 'L', csvText: csv });

    const res = removeTrackFromUploadedCsv(rec.id, 0);
    expect(res?.removedName).toBe('A');
    expect(urisOf(rec.id)).toEqual(['spotify:track:2']);

    // Deshacer: restaurar el csvText previo.
    if (res !== null) updateUploadedCsv(rec.id, { csvText: res.prevCsvText });
    expect(urisOf(rec.id)).toEqual(['spotify:track:1', 'spotify:track:2']);
  });
});
