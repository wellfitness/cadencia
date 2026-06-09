import type { ClassifiedSegment } from '../segmentation/types';
import type { Track } from '../tracks/types';
import type { CrossZoneMode } from './match';
import type { MatchPreferences } from './types';

/** Separador de control entre tracks (ASCII Record Separator, 0x1e). Un byte
 *  que no aparece en uris ni generos, para marcar la frontera de cada registro
 *  y evitar colisiones por solapamiento de limites (dos pools cuyos campos
 *  concatenados coincidirian sin frontera). */
const RECORD_SEPARATOR = '\x1e';

const FNV_OFFSET_BASIS = 0x811c9dc5;

/**
 * Actualiza un hash FNV-1a de 32 bits con el contenido de `str`. FNV-1a es
 * determinista y sin dependencias; lo usamos de forma incremental para
 * resumir un pool de miles de tracks sin materializar una cadena gigante en
 * memoria. `Math.imul` mantiene la multiplicacion en 32 bits.
 */
function fnv1aUpdate(hash: number, str: string): number {
  let h = hash >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Firma determinista, por VALOR, de los inputs que definen el resultado del
 * matching: misma ruta + mismo pool (por contenido y orden) + mismas
 * preferencias + mismo crossZoneMode -> misma firma.
 *
 * Existe para distinguir un cambio REAL de los inputs de un mero cambio de
 * REFERENCIA. Tras el full-reload del OAuth de Spotify, `loadCadenciaData()`
 * devuelve objetos nuevos (parse JSON) con contenido identico: el `livePool`
 * memoizado en App.tsx cambia de referencia sin cambiar de contenido. El
 * efecto de recalculo compara esta firma en vez de las referencias, de modo
 * que no regenera la base ni descarta las ediciones manuales del usuario
 * cuando el contenido no ha cambiado.
 *
 * El orden del pool es significativo: influye en el desempate del scoring, asi
 * que un pool reordenado produce una firma distinta (recalculo deseado).
 *
 * Solo se incluyen los campos del track que el motor consume (uri, tempoBpm,
 * energy, valence, danceability, genres): editar el BPM de una cancion en el
 * editor de catalogo cambia el matching aunque el uri sea el mismo.
 */
export function computeMatchSignature(
  routeSegments: readonly ClassifiedSegment[] | null,
  livePool: readonly Track[],
  prefs: MatchPreferences,
  crossZoneMode: CrossZoneMode,
): string {
  if (routeSegments === null) return 'route:null';

  let poolHash = FNV_OFFSET_BASIS;
  for (const t of livePool) {
    const fields =
      `${t.uri}|${t.tempoBpm}|${t.energy}|${t.valence}|${t.danceability}|` +
      `${t.genres.join(',')}${RECORD_SEPARATOR}`;
    poolHash = fnv1aUpdate(poolHash, fields);
  }
  const poolPart = `${livePool.length}:${poolHash.toString(16)}`;

  const segPart = routeSegments
    .map((s) => `${s.sport}:${s.zone}:${s.cadenceProfile}:${Math.round(s.durationSec)}`)
    .join('>');

  const prefsPart = JSON.stringify({
    preferredGenres: prefs.preferredGenres,
    allEnergetic: prefs.allEnergetic,
    seed: prefs.seed ?? null,
  });

  return `${segPart}#${poolPart}#${prefsPart}#${crossZoneMode}`;
}
