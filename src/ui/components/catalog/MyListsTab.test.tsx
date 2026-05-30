import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { clearCadenciaData } from '@ui/state/cadenciaStore';
import {
  createUploadedCsv,
  getUploadedCsv,
  listUploadedCsvs,
} from '@core/csvs/uploadedCsvs';
import { parseTrackCsv } from '@core/tracks';
import { MyListsTab } from './MyListsTab';

interface Row {
  uri: string;
  name: string;
  artist: string;
  tempo: number;
}

function makeCsv(rows: readonly Row[]): string {
  const header =
    'Track URI,Track Name,Album Name,Artist Name(s),Genres,Danceability,Energy,Valence,Tempo,Duration (ms)';
  const lines = rows.map(
    (r) => `${r.uri},${r.name},Album,${r.artist},rock,0.5,0.6,0.5,${r.tempo},180000`,
  );
  return [header, ...lines].join('\n');
}

/** URIs vivas de una lista, leídas del store y parseadas. */
function listUris(id: string): string[] {
  const rec = getUploadedCsv(id);
  if (rec === null) throw new Error('lista no encontrada');
  return parseTrackCsv(rec.csvText, 'user').map((t) => t.uri);
}

const csvA = makeCsv([
  { uri: 'spotify:track:alpha', name: 'Alpha', artist: 'Banda Uno', tempo: 120 },
  { uri: 'spotify:track:beta', name: 'Beta', artist: 'Banda Dos', tempo: 180 },
]);
const csvB = makeCsv([
  { uri: 'spotify:track:gamma', name: 'Gamma', artist: 'Banda Tres', tempo: 100 },
]);

describe('MyListsTab (editor con selector)', () => {
  beforeEach(() => clearCadenciaData());

  it('sin listas muestra la zona de subida', () => {
    render(<MyListsTab />);
    expect(screen.getByText(/no has subido ninguna lista/i)).toBeInTheDocument();
  });

  it('con una lista muestra sus canciones directamente, sin expandir', () => {
    createUploadedCsv({ name: 'Lista A', csvText: csvA });
    render(<MyListsTab />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('el selector cambia la lista activa', () => {
    createUploadedCsv({ name: 'Lista A', csvText: csvA });
    const b = createUploadedCsv({ name: 'Lista B', csvText: csvB });
    render(<MyListsTab />);

    // Por defecto la primera lista; sus canciones se ven, las de B no.
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Gamma')).toBeNull();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: b.id } });

    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).toBeNull();
  });

  it('quitar una canción la elimina de su lista (conservando las demás)', () => {
    const a = createUploadedCsv({ name: 'Lista A', csvText: csvA });
    render(<MyListsTab />);

    fireEvent.click(screen.getByRole('button', { name: /quitar «Alpha»/i }));

    expect(listUris(a.id)).toEqual(['spotify:track:beta']);
  });

  it('«Deshacer» restaura la canción quitada', () => {
    const a = createUploadedCsv({ name: 'Lista A', csvText: csvA });
    render(<MyListsTab />);

    fireEvent.click(screen.getByRole('button', { name: /quitar «Alpha»/i }));
    fireEvent.click(screen.getByRole('button', { name: /deshacer/i }));

    expect(listUris(a.id)).toEqual(['spotify:track:alpha', 'spotify:track:beta']);
  });

  it('en «Todas las listas», quitar una copia conserva la otra (deja al menos una)', () => {
    // La MISMA canción (mismo URI) en dos listas distintas: el caso del bug.
    const dup = makeCsv([
      { uri: 'spotify:track:alpha', name: 'Alpha', artist: 'Banda Uno', tempo: 120 },
    ]);
    createUploadedCsv({ name: 'Lista A', csvText: dup });
    createUploadedCsv({ name: 'Lista B', csvText: dup });
    render(<MyListsTab />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '__all__' } });

    // Dos filas «Alpha» (una por lista), cada una con su botón Quitar.
    const quitar = screen.getAllByRole('button', { name: /quitar «Alpha»/i });
    expect(quitar).toHaveLength(2);

    const [first] = quitar;
    if (first === undefined) throw new Error('no hay botón Quitar');
    fireEvent.click(first);

    // Sigue existiendo UNA copia de Alpha entre todas las listas (no se fueron las dos).
    const allUris = listUploadedCsvs().flatMap((l) =>
      parseTrackCsv(l.csvText, 'user').map((t) => t.uri),
    );
    expect(allUris.filter((u) => u === 'spotify:track:alpha')).toHaveLength(1);
  });

  it('el buscador filtra por nombre', () => {
    createUploadedCsv({ name: 'Lista A', csvText: csvA });
    render(<MyListsTab />);

    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'alpha' } });

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).toBeNull();
  });

  it('el filtro de BPM filtra por tempo', () => {
    createUploadedCsv({ name: 'Lista A', csvText: csvA });
    render(<MyListsTab />);

    fireEvent.change(screen.getByLabelText(/BPM mínimo/i), { target: { value: '150' } });

    expect(screen.getByText('Beta')).toBeInTheDocument(); // 180 BPM
    expect(screen.queryByText('Alpha')).toBeNull(); // 120 BPM
  });

  it('una lista con CSV inválido muestra el error y no canciones', () => {
    createUploadedCsv({ name: 'Lista rota', csvText: 'cabecera,sin,columnas\n1,2,3' });
    render(<MyListsTab />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quitar/i })).toBeNull();
  });
});
