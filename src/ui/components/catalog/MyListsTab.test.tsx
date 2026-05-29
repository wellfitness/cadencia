import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { clearCadenciaData } from '@ui/state/cadenciaStore';
import { createUploadedCsv } from '@core/csvs/uploadedCsvs';
import { addDismissedUri, listDismissed } from '@core/csvs/dismissed';
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

  it('descartar una canción la añade a dismissedTrackUris', () => {
    createUploadedCsv({ name: 'Lista A', csvText: csvA });
    render(<MyListsTab />);

    fireEvent.click(screen.getByRole('button', { name: /no quiero «Alpha»/i }));

    expect(listDismissed()).toContain('spotify:track:alpha');
  });

  it('recuperar una canción descartada la quita de dismissedTrackUris', () => {
    createUploadedCsv({ name: 'Lista A', csvText: csvA });
    addDismissedUri('spotify:track:alpha');
    render(<MyListsTab />);

    fireEvent.click(screen.getByRole('button', { name: /recuperar «Alpha»/i }));

    expect(listDismissed()).not.toContain('spotify:track:alpha');
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

  it('«descartar todas las visibles» descarta todas las activas mostradas', () => {
    createUploadedCsv({ name: 'Lista A', csvText: csvA });
    render(<MyListsTab />);

    fireEvent.click(screen.getByRole('button', { name: /descartar todas/i }));

    expect(listDismissed()).toContain('spotify:track:alpha');
    expect(listDismissed()).toContain('spotify:track:beta');
  });

  it('muestra cuántas canciones están descartadas', () => {
    createUploadedCsv({ name: 'Lista A', csvText: csvA });
    addDismissedUri('spotify:track:beta');
    render(<MyListsTab />);

    expect(screen.getByText(/1 descartada/)).toBeInTheDocument();
  });

  it('una lista con CSV inválido muestra el error y no canciones', () => {
    createUploadedCsv({ name: 'Lista rota', csvText: 'cabecera,sin,columnas\n1,2,3' });
    render(<MyListsTab />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /no quiero/i })).toBeNull();
  });
});
