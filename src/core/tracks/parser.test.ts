import { describe, it, expect } from 'vitest';
import { parseTrackCsv } from './parser';

const HEADER =
  'Track URI,Track Name,Album Name,Artist Name(s),Release Date,Duration (ms),Popularity,Explicit,Added By,Added At,Genres,Record Label,Danceability,Energy,Key,Loudness,Mode,Speechiness,Acousticness,Instrumentalness,Liveness,Valence,Tempo,Time Signature';

function buildCsv(rows: string[]): string {
  return [HEADER, ...rows].join('\n');
}

describe('parseTrackCsv', () => {
  it('parsea fila simple sin generos', () => {
    const csv = buildCsv([
      'spotify:track:abc123,"Last of Mohicans","Last of Mohicans","DJ Nano;Dany Bpm",2020-04-16,250489,39,false,user,2026-04-18T08:33:56Z,"","Natas",0.281,0.832,2,-3.939,0,0.0383,0.00582,0.0000108,0.0719,0.0496,102.533,3',
    ]);
    const tracks = parseTrackCsv(csv, 'cinelli_rider');
    expect(tracks).toHaveLength(1);
    const t = tracks[0]!;
    expect(t.uri).toBe('spotify:track:abc123');
    expect(t.name).toBe('Last of Mohicans');
    expect(t.artists).toEqual(['DJ Nano', 'Dany Bpm']);
    expect(t.genres).toEqual([]);
    expect(t.tempoBpm).toBeCloseTo(102.533, 2);
    expect(t.energy).toBeCloseTo(0.832, 3);
    expect(t.source).toBe('cinelli_rider');
  });

  it('split y normaliza generos (lowercase, trim, dedupe)', () => {
    const csv = buildCsv([
      'spotify:track:def456,"X","X","Artist",2020-01-01,200000,50,false,u,2026-01-01T00:00:00Z,"Italo Dance, eurodance ,EDM,italo dance","Label",0.5,0.7,5,-5,1,0.05,0.1,0.001,0.1,0.5,128,4',
    ]);
    const t = parseTrackCsv(csv, 'cinelli_rider')[0]!;
    expect(t.genres).toEqual(['italo dance', 'eurodance', 'edm']);
  });

  it('respeta comillas escapadas con doble comilla', () => {
    const csv = buildCsv([
      'spotify:track:ghi789,"Some ""quoted"" title","Album","Artist",2020,100000,1,false,u,2026,"","",0.5,0.5,1,-5,1,0.05,0.1,0.001,0.1,0.5,120,4',
    ]);
    const t = parseTrackCsv(csv, 'cinelli_rider')[0]!;
    expect(t.name).toBe('Some "quoted" title');
  });

  it('ignora filas con URI invalido', () => {
    const csv = buildCsv([
      'invalid-uri,"X","X","X",2020,100000,1,false,u,2026,"","",0.5,0.5,1,-5,1,0.05,0.1,0.001,0.1,0.5,120,4',
      'spotify:track:valid,"Y","Y","Y",2020,100000,1,false,u,2026,"","",0.5,0.5,1,-5,1,0.05,0.1,0.001,0.1,0.5,120,4',
    ]);
    expect(parseTrackCsv(csv, 'cinelli_rider')).toHaveLength(1);
  });

  it('ignora filas con tempo no numerico', () => {
    const csv = buildCsv([
      'spotify:track:bad,"X","X","X",2020,100000,1,false,u,2026,"","",0.5,0.5,1,-5,1,0.05,0.1,0.001,0.1,0.5,not-a-number,4',
    ]);
    expect(parseTrackCsv(csv, 'cinelli_rider')).toHaveLength(0);
  });

  it('CSV vacio devuelve []', () => {
    expect(parseTrackCsv('', 'cinelli_rider')).toEqual([]);
    expect(parseTrackCsv(HEADER, 'cinelli_rider')).toEqual([]);
  });

  it('falta columna critica -> Error', () => {
    // El parser solo valida cabecera cuando hay >= 2 lineas (header + datos)
    expect(() =>
      parseTrackCsv('No,Header,Valido\nrow,uno,dos', 'cinelli_rider'),
    ).toThrow(/columna/i);
  });
});
