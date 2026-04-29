import type { HeartRateZone } from '@core/physiology/karvonen';
import { ZoneBadge } from '../ZoneBadge';
import { ZONE_LABEL_FULL } from '../zoneLabels';

interface IntervalRow {
  zone: HeartRateZone;
  label: string;
  /** Tiempo Mantenido por Intervalo (rango). */
  tmm: string;
  /** Recuperacion entre intervalos (duracion + zona). */
  recovery: string;
  /** Tiempo Total Acumulado en la zona (suma de todos los intervalos). */
  ttaNovice: string;
  ttaAdvanced: string;
  goal: string;
  sessionTypes: string;
}

/**
 * Tabla de prescripcion de intervalos por zona, extraida del XLSX
 * "CICLO INDOOR Y PROGRESIONES". Indica cuanto puede mantenerse cada
 * intervalo (TMM), cuanta recuperacion necesita despues, cuanto trabajo
 * acumulado total apuntar (TTA) segun nivel y que objetivo fisiologico
 * persigue. Solo se muestran las 4 zonas con prescripcion explicita
 * (Z1 y Z2 son recuperaciones, no zonas de trabajo).
 */
const INTERVAL_ROWS: readonly IntervalRow[] = [
  {
    zone: 3,
    label: ZONE_LABEL_FULL[3],
    tmm: '> 8 min, < 15 min',
    recovery: '3-5 min en Z2',
    ttaNovice: '≥ 30 min',
    ttaAdvanced: '≥ 35 min',
    goal: 'Capacidad aeróbica de base (MLSS)',
    sessionTypes: 'Non stop / Fartleks / Intervalos largos > 10 min',
  },
  {
    zone: 4,
    label: ZONE_LABEL_FULL[4],
    tmm: '> 3 min, < 8 min',
    recovery: '1,5-2 min en Z2',
    ttaNovice: '15 min',
    ttaAdvanced: '20 min',
    goal: 'Potencia umbral / VT2',
    sessionTypes: 'Intervalos largos / progresivos / micropausas / IIV',
  },
  {
    zone: 5,
    label: ZONE_LABEL_FULL[5],
    tmm: '≥ 1 min, < 3 min',
    recovery: '1-1,5 min en Z1',
    ttaNovice: '6 min',
    ttaAdvanced: '10 min',
    goal: 'Potencia aeróbica máxima (PAM)',
    sessionTypes: 'Intervalos cortos / intermitentes / IIV',
  },
  {
    zone: 6,
    label: ZONE_LABEL_FULL[6],
    tmm: '≥ 45 s, < 60 s',
    recovery: '45-60 s en Z1',
    ttaNovice: '3 min',
    ttaAdvanced: '5 min',
    goal: 'Capacidad anaeróbica',
    sessionTypes: 'Intervalos muy cortos / intermitentes',
  },
];

/**
 * Tabla de prescripcion de intervalos. Responsive igual que la tabla de
 * zonas: tabla en md+, cards apiladas en movil.
 */
export function IntervalPrescriptionTable(): JSX.Element {
  return (
    <>
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gris-200">
        <table className="w-full text-sm">
          <thead className="bg-gris-100 text-gris-700">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Zona</th>
              <th className="text-left px-3 py-2 font-semibold">TMM</th>
              <th className="text-left px-3 py-2 font-semibold">Recuperación</th>
              <th className="text-left px-3 py-2 font-semibold">TTA novato</th>
              <th className="text-left px-3 py-2 font-semibold">TTA avanzado</th>
              <th className="text-left px-3 py-2 font-semibold">Objetivo</th>
            </tr>
          </thead>
          <tbody>
            {INTERVAL_ROWS.map((row) => (
              <tr key={row.zone} className="border-t border-gris-200 hover:bg-gris-50 align-top">
                <td className="px-3 py-3">
                  <ZoneBadge zone={row.zone} label={row.label} size="sm" />
                </td>
                <td className="px-3 py-3 text-gris-700">{row.tmm}</td>
                <td className="px-3 py-3 text-gris-700">{row.recovery}</td>
                <td className="px-3 py-3 tabular-nums text-gris-700">{row.ttaNovice}</td>
                <td className="px-3 py-3 tabular-nums text-gris-700">{row.ttaAdvanced}</td>
                <td className="px-3 py-3 text-gris-700">
                  <div>{row.goal}</div>
                  <div className="text-xs text-gris-500 mt-1">{row.sessionTypes}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {INTERVAL_ROWS.map((row) => (
          <article key={row.zone} className="rounded-xl border border-gris-200 bg-white p-3">
            <header className="flex items-center justify-between gap-2 mb-2">
              <ZoneBadge zone={row.zone} label={row.label} size="sm" />
              <span className="text-xs text-gris-500">{row.goal}</span>
            </header>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-gris-500">TMM</dt>
              <dd className="text-gris-800">{row.tmm}</dd>
              <dt className="text-gris-500">Recup.</dt>
              <dd className="text-gris-800">{row.recovery}</dd>
              <dt className="text-gris-500">TTA novato</dt>
              <dd className="tabular-nums text-gris-800">{row.ttaNovice}</dd>
              <dt className="text-gris-500">TTA avanzado</dt>
              <dd className="tabular-nums text-gris-800">{row.ttaAdvanced}</dd>
            </dl>
            <p className="text-xs text-gris-500 mt-2 leading-snug">{row.sessionTypes}</p>
          </article>
        ))}
      </div>

      <p className="text-xs text-gris-500 mt-3 leading-snug">
        <strong>TMM</strong> = Tiempo Mantenido por Intervalo (cuánto dura cada bloque de
        trabajo). <strong>TTA</strong> = Tiempo Total Acumulado (suma de todos los intervalos
        de la sesión en esa zona). Recuperación cae a Z2 cuando el trabajo es submáximo
        (Z3-Z4) y a Z1 cuando es supramáximo (Z5-Z6) — necesitas recuperar del todo entre
        esfuerzos cortos muy intensos.
      </p>
    </>
  );
}
