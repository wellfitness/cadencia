import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { AlternativeCandidate, MatchedSegment } from '@core/matching';
import type { Track } from '@core/tracks';
import { PlaylistTrackRow } from './PlaylistTrackRow';

function makeTrack(partial: Partial<Track> & Pick<Track, 'uri' | 'name' | 'artists'>): Track {
  return {
    album: '',
    genres: [],
    tempoBpm: 120,
    energy: 0.6,
    valence: 0.5,
    danceability: 0.6,
    durationMs: 180_000,
    source: 'native',
    ...partial,
  };
}

function makeAlternative(
  track: Track,
  score = 0.8,
  usedAtIndex: number | null = null,
): AlternativeCandidate {
  return { track, score, passesCadence: true, usedAtIndex };
}

function makeMatched(track: Track | null = null): MatchedSegment {
  const fallbackTrack = track ?? makeTrack({ uri: 'spotify:track:current', name: 'Tema actual', artists: ['Artista actual'] });
  return {
    sport: 'bike',
    startSec: 0,
    durationSec: 60,
    avgPowerWatts: 200,
    zone: 3,
    cadenceProfile: 'flat',
    startDistanceMeters: 0,
    endDistanceMeters: 100,
    startElevationMeters: 0,
    endElevationMeters: 0,
    startLat: 0,
    startLon: 0,
    track: fallbackTrack,
    matchScore: 0.9,
    matchQuality: 'strict',
  };
}

function openPicker(): void {
  fireEvent.click(screen.getByRole('button', { name: /Cambiar tema del tramo/ }));
}

describe('PlaylistTrackRow > AlternativesPicker > buscador', () => {
  const altBorn = makeAlternative(makeTrack({ uri: 'spotify:track:1', name: 'Born to Be Wild', artists: ['Steppenwolf'] }), 0.95);
  const altSweet = makeAlternative(makeTrack({ uri: 'spotify:track:2', name: 'Sweet Child o\' Mine', artists: ['Guns N\' Roses'] }), 0.9);
  const altCafe = makeAlternative(makeTrack({ uri: 'spotify:track:3', name: 'Café para tres', artists: ['Bambino'] }), 0.85);
  const alternatives = [altBorn, altSweet, altCafe];

  it('sin query, muestra todas las alternativas en el orden recibido', () => {
    render(
      <PlaylistTrackRow
        matched={makeMatched()}
        index={1}
        alternatives={alternatives}
        onReplaceWith={vi.fn()}
      />,
    );
    openPicker();

    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('Born to Be Wild');
    expect(options[1]).toHaveTextContent('Sweet Child');
    expect(options[2]).toHaveTextContent('Café para tres');
  });

  it('filtra por título manteniendo el orden por score', () => {
    render(
      <PlaylistTrackRow
        matched={makeMatched()}
        index={1}
        alternatives={alternatives}
        onReplaceWith={vi.fn()}
      />,
    );
    openPicker();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por título o artista/), {
      target: { value: 'born' },
    });

    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Born to Be Wild');
  });

  it('filtra por artista', () => {
    render(
      <PlaylistTrackRow
        matched={makeMatched()}
        index={1}
        alternatives={alternatives}
        onReplaceWith={vi.fn()}
      />,
    );
    openPicker();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por título o artista/), {
      target: { value: 'Steppen' },
    });

    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Steppenwolf');
  });

  it('matching es case-insensitive y diacritic-insensitive', () => {
    render(
      <PlaylistTrackRow
        matched={makeMatched()}
        index={1}
        alternatives={alternatives}
        onReplaceWith={vi.fn()}
      />,
    );
    openPicker();

    // "cafe" sin tilde matchea "Café"
    fireEvent.change(screen.getByPlaceholderText(/Buscar por título o artista/), {
      target: { value: 'cafe' },
    });
    let options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Café');

    // "CAFÉ" en mayúsculas con tilde tambien funciona
    fireEvent.change(screen.getByPlaceholderText(/Buscar por título o artista/), {
      target: { value: 'CAFÉ' },
    });
    options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(1);
  });

  it('muestra mensaje "Sin resultados" cuando no hay matches', () => {
    render(
      <PlaylistTrackRow
        matched={makeMatched()}
        index={1}
        alternatives={alternatives}
        onReplaceWith={vi.fn()}
      />,
    );
    openPicker();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por título o artista/), {
      target: { value: 'noexisteestacancion' },
    });

    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.getByText(/Sin resultados/)).toBeInTheDocument();
  });

  it('botón X limpia la query y vuelve al ranking original', () => {
    render(
      <PlaylistTrackRow
        matched={makeMatched()}
        index={1}
        alternatives={alternatives}
        onReplaceWith={vi.fn()}
      />,
    );
    openPicker();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por título o artista/), {
      target: { value: 'born' },
    });
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Limpiar búsqueda/ }));

    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(3);
  });

  it('cerrar y reabrir resetea la query', () => {
    render(
      <PlaylistTrackRow
        matched={makeMatched()}
        index={1}
        alternatives={alternatives}
        onReplaceWith={vi.fn()}
      />,
    );
    openPicker();
    fireEvent.change(screen.getByPlaceholderText(/Buscar por título o artista/), {
      target: { value: 'born' },
    });
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);

    // Cierra el dropdown (toggle) y lo reabre.
    openPicker();
    expect(screen.queryByRole('listbox')).toBeNull();
    openPicker();

    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(3);
    expect(screen.getByPlaceholderText(/Buscar por título o artista/)).toHaveValue('');
  });

  it('clic en una alternativa filtrada llama a onReplaceWith con esa URI', () => {
    const onReplace = vi.fn();
    render(
      <PlaylistTrackRow
        matched={makeMatched()}
        index={1}
        alternatives={alternatives}
        onReplaceWith={onReplace}
      />,
    );
    openPicker();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por título o artista/), {
      target: { value: 'sweet' },
    });
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option'));

    expect(onReplace).toHaveBeenCalledWith('spotify:track:2');
  });
});

describe('PlaylistTrackRow > Aleatorio (nunca repite)', () => {
  const fresh = makeTrack({ uri: 'spotify:track:fresh', name: 'Fresca', artists: ['A'] });
  const used1 = makeTrack({ uri: 'spotify:track:u1', name: 'Usada 1', artists: ['B'] });
  const used2 = makeTrack({ uri: 'spotify:track:u2', name: 'Usada 2', artists: ['C'] });

  it('solo elige entre alternativas libres (nunca una usada)', () => {
    const onReplace = vi.fn();
    // 1 libre + 2 usadas → el azar solo puede caer en la libre.
    const alts = [
      makeAlternative(fresh, 0.9, null),
      makeAlternative(used1, 0.8, 4),
      makeAlternative(used2, 0.7, 7),
    ];
    render(
      <PlaylistTrackRow
        matched={makeMatched()}
        index={1}
        alternatives={alts}
        onReplaceWith={onReplace}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Elegir un tema libre al azar/ }));
    expect(onReplace).toHaveBeenCalledWith('spotify:track:fresh');
  });

  it('se deshabilita si no quedan alternativas libres (todas usadas)', () => {
    const alts = [makeAlternative(used1, 0.8, 4), makeAlternative(used2, 0.7, 7)];
    render(
      <PlaylistTrackRow
        matched={makeMatched()}
        index={1}
        alternatives={alts}
        onReplaceWith={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: /Elegir un tema libre al azar/ }),
    ).toBeDisabled();
  });
});

describe('PlaylistTrackRow > Otro tema marca las usadas', () => {
  const fresh = makeTrack({ uri: 'spotify:track:f', name: 'Fresca', artists: ['A'] });
  const used = makeTrack({ uri: 'spotify:track:u', name: 'Usada', artists: ['B'] });

  it('separador "Ya en tu lista" y badge con el tramo (usedAtIndex 4 → tramo 5)', () => {
    const alts = [makeAlternative(fresh, 0.9, null), makeAlternative(used, 0.8, 4)];
    render(
      <PlaylistTrackRow
        matched={makeMatched()}
        index={1}
        alternatives={alts}
        onReplaceWith={vi.fn()}
      />,
    );
    openPicker();
    expect(screen.getByText(/Ya en tu lista/)).toBeInTheDocument();
    expect(screen.getByText(/tramo 5/)).toBeInTheDocument();
    // Ambas (libre y usada) siguen siendo opciones seleccionables.
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(2);
  });

  it('clic en una usada llama a onReplaceWith con su uri (el padre decide mover)', () => {
    const onReplace = vi.fn();
    const alts = [makeAlternative(used, 0.8, 4)];
    render(
      <PlaylistTrackRow
        matched={makeMatched()}
        index={1}
        alternatives={alts}
        onReplaceWith={onReplace}
      />,
    );
    openPicker();
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option'));
    expect(onReplace).toHaveBeenCalledWith('spotify:track:u');
  });
});
