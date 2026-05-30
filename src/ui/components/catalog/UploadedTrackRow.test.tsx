import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Track } from '@core/tracks';
import { UploadedTrackRow } from './UploadedTrackRow';

function makeTrack(
  partial: Partial<Track> & Pick<Track, 'uri' | 'name' | 'artists'>,
): Track {
  return {
    album: '',
    genres: [],
    tempoBpm: 120,
    energy: 0.6,
    valence: 0.5,
    danceability: 0.6,
    durationMs: 180_000,
    source: 'user',
    ...partial,
  };
}

const track = makeTrack({
  uri: 'spotify:track:abc',
  name: 'Born to Be Wild',
  artists: ['Steppenwolf'],
  album: 'Steppenwolf',
  genres: ['rock', 'classic rock'],
  tempoBpm: 128,
  durationMs: 225_000,
});

describe('UploadedTrackRow', () => {
  it('muestra el tema, artista, BPM, duración y un botón para quitarlo', () => {
    render(<UploadedTrackRow track={track} onRemove={vi.fn()} />);

    expect(screen.getByText('Born to Be Wild')).toBeInTheDocument();
    expect(screen.getByText('Steppenwolf')).toBeInTheDocument();
    expect(screen.getByText(/128/)).toBeInTheDocument();
    expect(screen.getByText('3:45')).toBeInTheDocument();
    expect(screen.getByText('rock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quitar/i })).toBeInTheDocument();
  });

  it('clic en "Quitar" invoca onRemove', () => {
    const onRemove = vi.fn();
    render(<UploadedTrackRow track={track} onRemove={onRemove} />);

    fireEvent.click(screen.getByRole('button', { name: /quitar/i }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('muestra el chip de versiones cuando duplicateCount >= 2', () => {
    render(<UploadedTrackRow track={track} duplicateCount={3} onRemove={vi.fn()} />);
    expect(screen.getByText(/3 versiones/i)).toBeInTheDocument();
  });

  it('no muestra el chip de versiones cuando duplicateCount < 2', () => {
    render(<UploadedTrackRow track={track} duplicateCount={1} onRemove={vi.fn()} />);
    expect(screen.queryByText(/versiones/i)).toBeNull();
  });

  it('muestra la insignia de lista de origen cuando se pasa listName', () => {
    render(<UploadedTrackRow track={track} listName="Mi Rock" onRemove={vi.fn()} />);
    expect(screen.getByText('Mi Rock')).toBeInTheDocument();
  });

  it('no muestra insignia de lista cuando listName está vacío', () => {
    render(<UploadedTrackRow track={track} listName="" onRemove={vi.fn()} />);
    // El único texto adicional sería la lista; sin ella, no hay nodo "Lista:".
    expect(screen.queryByTitle(/^Lista:/)).toBeNull();
  });
});
