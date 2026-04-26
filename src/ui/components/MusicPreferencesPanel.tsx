import type { ChangeEvent } from 'react';
import type { MatchPreferences } from '@core/matching';
import type { GenreCount } from '@core/tracks';
import { GenrePills } from './GenrePills';
import { MaterialIcon } from './MaterialIcon';

export interface MusicPreferencesPanelProps {
  topGenres: readonly GenreCount[];
  preferences: MatchPreferences;
  onChange: (preferences: MatchPreferences) => void;
  defaultOpen?: boolean;
}

/**
 * Panel plegable "Cambiar mis preferencias musicales" que reusa la logica
 * del MusicStep (generos + toggle "todo con energia") para uso en la
 * pantalla Resultado.
 *
 * No tiene matching ni preview propios: el padre (ResultStep) ya muestra
 * la lista completa, solo necesitamos los controles para alterarla.
 */
export function MusicPreferencesPanel({
  topGenres,
  preferences,
  onChange,
  defaultOpen = false,
}: MusicPreferencesPanelProps): JSX.Element {
  const setGenres = (preferredGenres: string[]): void => {
    onChange({ ...preferences, preferredGenres });
  };
  const setAllEnergetic = (e: ChangeEvent<HTMLInputElement>): void => {
    onChange({ ...preferences, allEnergetic: e.target.checked });
  };

  return (
    <details
      className="group rounded-xl border border-gris-200 bg-white p-3 md:p-5 open:border-turquesa-300"
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="flex cursor-pointer items-center gap-2 text-base md:text-lg font-semibold text-gris-800 select-none min-h-[44px]">
        <MaterialIcon name="queue_music" size="small" className="text-turquesa-600" />
        Cambiar mis preferencias musicales
        <MaterialIcon
          name="expand_more"
          size="small"
          className="ml-auto text-gris-500 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="mt-3 pt-3 border-t border-gris-100 space-y-3">
        <div>
          <p className="text-sm font-semibold text-gris-700 mb-2">Géneros que te van</p>
          <p className="text-xs text-gris-500 mb-3">
            La lista de temas se actualiza al instante con tu selección.
          </p>
          <GenrePills
            availableGenres={topGenres}
            selectedGenres={preferences.preferredGenres}
            onChange={setGenres}
          />
        </div>
        <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={preferences.allEnergetic}
            onChange={setAllEnergetic}
            className="mt-1 w-5 h-5 accent-turquesa-600 cursor-pointer"
          />
          <div>
            <p className="text-sm font-semibold text-gris-700">Todo con energía</p>
            <p className="text-xs text-gris-500">
              Sube el listón en zonas suaves para que ningún tramo se sienta blando.
            </p>
          </div>
        </label>
      </div>
    </details>
  );
}
