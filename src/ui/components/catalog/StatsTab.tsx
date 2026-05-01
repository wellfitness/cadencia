import { useMemo, useState } from 'react';
import { usePlaylistHistory } from '@ui/state/cadenciaStore';
import {
  computeSummary,
  computeTopArtists,
  computeTopGenresByDuration,
  computeTopTracks,
} from '@core/playlist/historyStats';
import { clearAllPlaylistHistory } from '@core/playlist/history';
import { Button } from '@ui/components/Button';
import { ConfirmDialog } from '@ui/components/ConfirmDialog';
import { MaterialIcon } from '@ui/components/MaterialIcon';
import { ZoneStackedBar } from '@ui/components/ZoneStackedBar';
import type { HeartRateZone } from '@core/physiology/karvonen';
import { HistoryEntryRow } from './HistoryEntryRow';

const TOP_TRACKS_LIMIT = 20;
const TOP_ARTISTS_LIMIT = 15;
const TOP_GENRES_LIMIT = 10;
const RECENT_PLAYLISTS_LIMIT = 30;

function formatDuration(totalSec: number): string {
  const totalMin = Math.round(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

function formatPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/**
 * Pestana de Estadisticas del catalogo. Agrega el historial real de
 * playlists creadas en Spotify (via `createPlaylistHistoryEntry` en
 * ResultStep tras exito de la API). Cinco secciones colapsables:
 *
 *  1. Resumen: totales + barra de zonas + ratio de sustituciones.
 *  2. Top temas (20).
 *  3. Top artistas (15).
 *  4. Top generos por tiempo total (10).
 *  5. Tus ultimas 30 listas: lista cronologica con borrar.
 *
 * Estado vacio cuando no hay entradas: onboarding suave.
 */
export function StatsTab(): JSX.Element {
  const history = usePlaylistHistory();
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);

  const summary = useMemo(() => computeSummary(history), [history]);
  const topTracks = useMemo(
    () => computeTopTracks(history, TOP_TRACKS_LIMIT),
    [history],
  );
  const topArtists = useMemo(
    () => computeTopArtists(history, TOP_ARTISTS_LIMIT),
    [history],
  );
  const topGenres = useMemo(
    () => computeTopGenresByDuration(history, TOP_GENRES_LIMIT),
    [history],
  );
  const recentPlaylists = useMemo(
    () => history.slice(0, RECENT_PLAYLISTS_LIMIT),
    [history],
  );

  if (history.length === 0) {
    return (
      <div className="text-center text-gris-600 py-12 px-4 rounded-lg border border-dashed border-gris-300 bg-gris-50">
        <MaterialIcon name="insights" size="large" className="text-gris-400 mb-2" />
        <p className="text-sm font-semibold text-gris-700">
          Aún no hay datos para tus estadísticas
        </p>
        <p className="text-xs mt-2 text-gris-500 max-w-md mx-auto">
          Aquí verás tus temas, artistas y géneros más usados cuando crees tu
          primera lista en Spotify desde el último paso del asistente.
        </p>
      </div>
    );
  }

  // Distribucion de zonas como Record para reutilizar ZoneStackedBar.
  const zoneDurationsRecord: Record<HeartRateZone, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  };
  for (const z of summary.zoneDistribution) {
    zoneDurationsRecord[z.zone] = z.totalDurationSec;
  }

  return (
    <div className="space-y-4">
      <SummarySection
        totalPlaylists={summary.totalPlaylists}
        totalDurationSec={summary.totalDurationSec}
        replacementRate={summary.replacementRate}
        bySport={summary.bySport}
        zoneDurationsRecord={zoneDurationsRecord}
      />

      <CollapsibleSection title="Top 20 temas" icon="music_note" defaultOpen>
        <TopTracksTable rows={topTracks} />
      </CollapsibleSection>

      <CollapsibleSection title="Top 15 artistas" icon="person">
        <TopArtistsTable rows={topArtists} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Top 10 géneros (por tiempo total)"
        icon="category"
      >
        <TopGenresTable rows={topGenres} />
      </CollapsibleSection>

      <CollapsibleSection
        title={`Tus últimas ${recentPlaylists.length} listas creadas`}
        icon="history"
      >
        <ul className="space-y-2" role="list">
          {recentPlaylists.map((entry) => (
            <HistoryEntryRow key={entry.id} entry={entry} />
          ))}
        </ul>
      </CollapsibleSection>

      <div className="border-t border-gris-200 pt-4 mt-4 flex justify-end">
        <Button
          variant="critical"
          size="sm"
          iconLeft="delete_sweep"
          onClick={() => setConfirmClearAll(true)}
        >
          Limpiar todo el historial
        </Button>
      </div>

      <ConfirmDialog
        open={confirmClearAll}
        title="Limpiar todo el historial"
        icon="delete_sweep"
        confirmLabel="Sí, limpiar todo"
        cancelLabel="Cancelar"
        confirmVariant="critical"
        onConfirm={() => {
          clearAllPlaylistHistory();
          setConfirmClearAll(false);
        }}
        onCancel={() => setConfirmClearAll(false)}
        message={
          <div className="space-y-2">
            <p>
              Vas a borrar las <strong>{summary.totalPlaylists}</strong>{' '}
              {summary.totalPlaylists === 1 ? 'entrada' : 'entradas'} de tu
              historial. Esta acción no se puede deshacer.
            </p>
            <p className="text-xs text-gris-600">
              Las playlists en tu cuenta de Spotify no se ven afectadas.
            </p>
          </div>
        }
      />
    </div>
  );
}

interface SummarySectionProps {
  totalPlaylists: number;
  totalDurationSec: number;
  replacementRate: number;
  bySport: Record<'bike' | 'run', number>;
  zoneDurationsRecord: Record<HeartRateZone, number>;
}

function SummarySection({
  totalPlaylists,
  totalDurationSec,
  replacementRate,
  bySport,
  zoneDurationsRecord,
}: SummarySectionProps): JSX.Element {
  return (
    <section
      aria-label="Resumen del historial"
      className="rounded-lg border border-gris-200 bg-white p-4 space-y-3"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="Listas creadas"
          value={String(totalPlaylists)}
        />
        <SummaryCard
          label="Tiempo total"
          value={formatDuration(totalDurationSec)}
        />
        <SummaryCard
          label="Sustituidas a mano"
          value={formatPct(replacementRate)}
        />
        <SummaryCard
          label="Ciclismo · Carrera"
          value={`${bySport.bike} · ${bySport.run}`}
        />
      </div>
      <div>
        <p className="text-xs text-gris-600 mb-1">
          Distribución de tiempo por zona
        </p>
        <ZoneStackedBar
          zoneDurationsSec={zoneDurationsRecord}
          totalSec={totalDurationSec}
          zones={[1, 2, 3, 4, 5, 6]}
        />
      </div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md bg-gris-50 px-3 py-2">
      <p className="text-xs text-gris-600">{label}</p>
      <p className="text-base font-bold text-gris-900 tabular-nums">{value}</p>
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  icon: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps): JSX.Element {
  return (
    <details
      className="rounded-lg border border-gris-200 bg-white"
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-2 hover:bg-gris-50 rounded-lg">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-gris-800">
          <MaterialIcon name={icon} size="small" className="text-turquesa-600" />
          {title}
        </span>
        <MaterialIcon name="expand_more" size="small" className="text-gris-500" />
      </summary>
      <div className="px-4 pb-4 pt-1">{children}</div>
    </details>
  );
}

function TopTracksTable({
  rows,
}: {
  rows: ReturnType<typeof computeTopTracks>;
}): JSX.Element {
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-gris-600">
        <tr className="border-b border-gris-200">
          <th className="text-left font-medium py-2 w-8">#</th>
          <th className="text-left font-medium py-2">Tema</th>
          <th className="text-left font-medium py-2">Artista</th>
          <th
            className="text-right font-medium py-2 w-16"
            title="Cuántas veces ha aparecido en tus listas"
          >
            Veces
          </th>
          <th
            className="text-right font-medium py-2"
            title="De esas veces, cuántas las elegiste tú con «Otro tema»"
          >
            Tuyas
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.uri} className="border-b border-gris-100 last:border-b-0">
            <td className="py-1.5 text-gris-500 tabular-nums">{i + 1}</td>
            <td className="py-1.5 font-semibold text-gris-800 truncate max-w-[14rem]">
              {row.name}
            </td>
            <td className="py-1.5 text-gris-600 truncate max-w-[10rem]">
              {row.artist}
            </td>
            <td className="py-1.5 text-right tabular-nums">{row.appearances}</td>
            <td className="py-1.5 text-right tabular-nums text-tulipTree-700">
              {row.replacementsByUser > 0
                ? `${row.replacementsByUser} de ${row.appearances}`
                : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TopArtistsTable({
  rows,
}: {
  rows: ReturnType<typeof computeTopArtists>;
}): JSX.Element {
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-gris-600">
        <tr className="border-b border-gris-200">
          <th className="text-left font-medium py-2 w-8">#</th>
          <th className="text-left font-medium py-2">Artista</th>
          <th className="text-right font-medium py-2">Apariciones</th>
          <th
            className="text-right font-medium py-2"
            title="Temas distintos de este artista que han salido"
          >
            Temas únicos
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.artist} className="border-b border-gris-100 last:border-b-0">
            <td className="py-1.5 text-gris-500 tabular-nums">{i + 1}</td>
            <td className="py-1.5 font-semibold text-gris-800 truncate max-w-[16rem]">
              {row.artist}
            </td>
            <td className="py-1.5 text-right tabular-nums">{row.appearances}</td>
            <td className="py-1.5 text-right tabular-nums">{row.uniqueTracks}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TopGenresTable({
  rows,
}: {
  rows: ReturnType<typeof computeTopGenresByDuration>;
}): JSX.Element {
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-gris-600">
        <tr className="border-b border-gris-200">
          <th className="text-left font-medium py-2 w-8">#</th>
          <th className="text-left font-medium py-2">Género</th>
          <th
            className="text-right font-medium py-2"
            title="Tiempo total escuchando este género en tus listas (ordena la tabla)"
          >
            Tiempo total
          </th>
          <th className="text-right font-medium py-2">Apariciones</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.genre} className="border-b border-gris-100 last:border-b-0">
            <td className="py-1.5 text-gris-500 tabular-nums">{i + 1}</td>
            <td className="py-1.5 font-semibold text-gris-800 truncate max-w-[14rem]">
              {row.genre}
            </td>
            <td className="py-1.5 text-right tabular-nums">
              {formatDuration(row.totalDurationSec)}
            </td>
            <td className="py-1.5 text-right tabular-nums">{row.appearances}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
