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
});

describe('UploadedTrackRow', () => {
  it('en estado activo muestra el tema y un botón para descartarlo', () => {
    render(<UploadedTrackRow track={track} dismissed={false} onToggleDismiss={vi.fn()} />);

    expect(screen.getByText('Born to Be Wild')).toBeInTheDocument();
    expect(screen.getByText('Steppenwolf')).toBeInTheDocument();
    expect(screen.getByText(/128/)).toBeInTheDocument();
    expect(screen.getByText('rock')).toBeInTheDocument();
    // El control de descarte está presente; no hay marca de "fuera".
    expect(screen.getByRole('button', { name: /no quiero/i })).toBeInTheDocument();
    expect(screen.queryByText('fuera')).toBeNull();
    expect(screen.queryByRole('button', { name: /recuperar/i })).toBeNull();
  });

  it('clic en "No la quiero" invoca onToggleDismiss', () => {
    const onToggle = vi.fn();
    render(<UploadedTrackRow track={track} dismissed={false} onToggleDismiss={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: /no quiero/i }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('en estado descartado muestra la marca "fuera" y un botón para recuperarla', () => {
    render(<UploadedTrackRow track={track} dismissed onToggleDismiss={vi.fn()} />);

    expect(screen.getByText('fuera')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recuperar/i })).toBeInTheDocument();
    // Ya no se ofrece descartar lo que ya está descartado.
    expect(screen.queryByRole('button', { name: /no quiero/i })).toBeNull();
  });

  it('clic en "Recuperar" invoca onToggleDismiss', () => {
    const onToggle = vi.fn();
    render(<UploadedTrackRow track={track} dismissed onToggleDismiss={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: /recuperar/i }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('el nombre del tema descartado se marca como tachado (señal no-solo-color)', () => {
    render(<UploadedTrackRow track={track} dismissed onToggleDismiss={vi.fn()} />);

    const name = screen.getByText('Born to Be Wild');
    expect(name.className).toContain('line-through');
  });
});
