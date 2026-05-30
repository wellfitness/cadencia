import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PlaylistHistoryEntry } from '@core/sync/types';
import { HistoryEntryRow } from './HistoryEntryRow';

function makeEntry(overrides: Partial<PlaylistHistoryEntry> = {}): PlaylistHistoryEntry {
  return {
    id: 'h1',
    createdAt: '2026-05-29T10:00:00.000Z',
    updatedAt: '2026-05-29T10:00:00.000Z',
    sport: 'bike',
    mode: 'gpx',
    totalDurationSec: 4320,
    zoneDurations: { 1: 1000, 2: 1000, 3: 800, 4: 700, 5: 500, 6: 320 },
    seed: 42,
    tracks: [
      {
        uri: 'u1',
        name: 'A',
        artist: 'X',
        genres: [],
        tempoBpm: 120,
        zone: 2,
        durationSec: 200,
        matchQuality: 'strict',
        wasReplaced: false,
      },
    ],
    ...overrides,
  };
}

describe('HistoryEntryRow', () => {
  it('muestra el nombre de la lista como titular cuando existe', () => {
    render(
      <ul>
        <HistoryEntryRow entry={makeEntry({ name: 'Cadencia - Ruta del río - 2026-05-29' })} />
      </ul>,
    );
    expect(
      screen.getByText('Cadencia - Ruta del río - 2026-05-29'),
    ).toBeInTheDocument();
  });

  it('cae a la fecha como titular cuando la entrada no tiene nombre', () => {
    const entry = makeEntry();
    render(
      <ul>
        <HistoryEntryRow entry={entry} />
      </ul>,
    );
    // El titular lleva la fecha como `title` (solo la cabecera tiene ese
    // atributo; así no chocamos con la fecha que repite el diálogo de borrado).
    const expectedDate = new Date(entry.createdAt).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    expect(screen.getByTitle(expectedDate)).toBeInTheDocument();
  });
});
