import type { HeartRateZone } from '@core/physiology/karvonen';
import { ZoneBadge } from '../ZoneBadge';
import { ZONE_LABEL_FULL } from '../zoneLabels';
import { ZONE_BG_BAR } from './intensityBars';

interface ZoneRow {
  zone: HeartRateZone;
  label: string;
  ftp: string;
  p5: string;
  fcmax: string;
  rpe: string;
  /** Nombre del color con el que la paleta de Cadencia identifica la zona en
   *  badges, charts y barras de intensidad. */
  colorName: string;
  description: string;
}

/**
 * Tabla maestra de zonas adaptada al modelo de 6 zonas lineales de Cadencia.
 * La columna "Color en la app" refleja la paleta propia (zoneColors), no una
 * referencia externa: misma paleta que usan ZoneBadge, ElevationChart y la
 * barra de intensidad de las plantillas, asi el usuario aprende a leer la
 * UI a la vez que aprende las zonas.
 *
 * Datos textuales (educativos), no logica. Por eso viven aqui y no en @core.
 */
const ZONE_ROWS: readonly ZoneRow[] = [
  {
    zone: 1,
    label: ZONE_LABEL_FULL[1],
    ftp: '< 55%',
    p5: '< 45%',
    fcmax: '≤ 60%',
    rpe: '1-2 / Muy suave',
    colorName: 'Azul',
    description:
      'Pedaleo muy suave, sin esfuerzo perceptible. Útil para la vuelta a la calma o la recuperación entre intervalos duros.',
  },
  {
    zone: 2,
    label: ZONE_LABEL_FULL[2],
    ftp: '55-75%',
    p5: '45-60%',
    fcmax: '~70%',
    rpe: '3-4 / Suave',
    colorName: 'Verde',
    description:
      'Aeróbico cómodo, conversación posible. Es la zona de la base aeróbica y de las micropausas en sesiones de umbral.',
  },
  {
    zone: 3,
    label: ZONE_LABEL_FULL[3],
    ftp: '75-90%',
    p5: '60-70%',
    fcmax: '~80%',
    rpe: '5-6 / Moderado',
    colorName: 'Amarillo',
    description:
      'Tempo sostenible, justo en el umbral del lactato (MLSS). Estimula la capacidad aeróbica de base. Habla entrecortada.',
  },
  {
    zone: 4,
    label: ZONE_LABEL_FULL[4],
    ftp: '90-105%',
    p5: '70-85%',
    fcmax: '~90%',
    rpe: '7-8 / Fuerte',
    colorName: 'Naranja',
    description:
      'Justo por encima del umbral. Mejora la potencia que puedes sostener sin acumular lactato. Frases cortas de 2-3 palabras.',
  },
  {
    zone: 5,
    label: ZONE_LABEL_FULL[5],
    ftp: '105-120%',
    p5: '85-100%',
    fcmax: '~100%',
    rpe: '9-10 / Máximo',
    colorName: 'Rojo',
    description:
      'Potencia aeróbica máxima. Sostenible solo unos minutos. Es el techo cardiovascular. Imposible hablar.',
  },
  {
    zone: 6,
    label: ZONE_LABEL_FULL[6],
    ftp: '> 120%',
    p5: '> 100%',
    fcmax: 'saturada',
    rpe: '10 / Máximo',
    colorName: 'Morado',
    description:
      'Anaeróbico puro. Sprints de pocos segundos a máxima intensidad. La FC ya no sube más, se satura.',
  },
];

/**
 * Pequeño circulo coloreado con la paleta real de la app (la misma que usan
 * ZoneBadge y los charts). Ayuda al usuario a hacer el puente visual entre
 * la tabla y el resto de la UI.
 */
function ZoneColorSwatch({ zone, name }: { zone: HeartRateZone; name: string }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={`inline-block w-3.5 h-3.5 rounded-full border border-gris-300 ${ZONE_BG_BAR[zone]}`}
      />
      <span>{name}</span>
    </span>
  );
}

/**
 * Tabla maestra Z1-Z6 con cargas relativas (%FTP, %P5, %FCmáx), RPE y color
 * Technogym. Responsive: tabla normal en md+, lista de cards apiladas en
 * movil para que se lea sin scroll horizontal.
 */
export function ZoneReferenceTable(): JSX.Element {
  return (
    <>
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gris-200">
        <table className="w-full text-sm">
          <thead className="bg-gris-100 text-gris-700">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Zona</th>
              <th className="text-left px-3 py-2 font-semibold">% FTP</th>
              <th className="text-left px-3 py-2 font-semibold">% P5</th>
              <th className="text-left px-3 py-2 font-semibold">% FCmáx</th>
              <th className="text-left px-3 py-2 font-semibold">RPE</th>
              <th className="text-left px-3 py-2 font-semibold">Color en la app</th>
            </tr>
          </thead>
          <tbody>
            {ZONE_ROWS.map((row) => (
              <tr key={row.zone} className="border-t border-gris-200 hover:bg-gris-50">
                <td className="px-3 py-3">
                  <ZoneBadge zone={row.zone} label={row.label} size="sm" />
                </td>
                <td className="px-3 py-3 tabular-nums text-gris-700">{row.ftp}</td>
                <td className="px-3 py-3 tabular-nums text-gris-700">{row.p5}</td>
                <td className="px-3 py-3 tabular-nums text-gris-700">{row.fcmax}</td>
                <td className="px-3 py-3 text-gris-700">{row.rpe}</td>
                <td className="px-3 py-3 text-gris-700">
                  <ZoneColorSwatch zone={row.zone} name={row.colorName} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {ZONE_ROWS.map((row) => (
          <article
            key={row.zone}
            className="rounded-xl border border-gris-200 bg-white p-3"
          >
            <header className="flex items-center justify-between gap-2 mb-2">
              <ZoneBadge zone={row.zone} label={row.label} size="sm" />
              <span className="text-xs text-gris-500">
                <ZoneColorSwatch zone={row.zone} name={row.colorName} />
              </span>
            </header>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-gris-500">% FTP</dt>
              <dd className="tabular-nums text-gris-800 text-right">{row.ftp}</dd>
              <dt className="text-gris-500">% P5</dt>
              <dd className="tabular-nums text-gris-800 text-right">{row.p5}</dd>
              <dt className="text-gris-500">% FCmáx</dt>
              <dd className="tabular-nums text-gris-800 text-right">{row.fcmax}</dd>
              <dt className="text-gris-500">RPE</dt>
              <dd className="text-gris-800 text-right">{row.rpe}</dd>
            </dl>
            <p className="text-sm text-gris-600 mt-2 leading-snug">{row.description}</p>
          </article>
        ))}
      </div>
    </>
  );
}
