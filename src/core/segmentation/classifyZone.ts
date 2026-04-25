import type { HeartRateZone } from '../physiology/karvonen';
import type { ValidatedUserInputs } from '../user/userInputs';

/**
 * Estimacion de FTP cuando el usuario no la proporciona, en W/kg.
 * 2.5 W/kg corresponde aproximadamente a un ciclista recreativo medio
 * segun las categorias de Andrew Coggan.
 *
 * La UI flagueara al usuario que las zonas seran mas precisas si introduce
 * su FTP en el paso de Datos.
 */
const ESTIMATED_FTP_WATTS_PER_KG = 2.5;

/**
 * Zonas Coggan en porcentaje de FTP. Z6 (>120%) se colapsa a Z5 porque
 * nuestra paleta visual solo soporta 5 zonas (Z1-Z5).
 *
 *   Z1 < 55%
 *   Z2 55-75%
 *   Z3 75-90%
 *   Z4 90-105%
 *   Z5 >= 105% (incluye Z6 historica >120%)
 */
function ratioToCogganZone(ratio: number): HeartRateZone {
  if (ratio < 0.55) return 1;
  if (ratio < 0.75) return 2;
  if (ratio < 0.9) return 3;
  if (ratio < 1.05) return 4;
  return 5;
}

/**
 * Clasifica un valor de potencia media (W) en una zona Z1-Z5.
 *
 * - Si el usuario tiene FTP medida → Coggan estricto.
 * - Si no → estimamos FTP como 2.5 W/kg y aplicamos Coggan sobre esa estimacion.
 *   Las zonas seran menos precisas; la UI lo comunica al usuario.
 */
export function classifyZone(
  avgPowerWatts: number,
  validated: ValidatedUserInputs,
): HeartRateZone {
  const ftp =
    validated.hasFtp && validated.ftpWatts !== null
      ? validated.ftpWatts
      : ESTIMATED_FTP_WATTS_PER_KG * validated.weightKg;

  if (ftp <= 0) return 1; // proteccion: peso invalido (no deberia pasar la validacion)

  const ratio = avgPowerWatts / ftp;
  return ratioToCogganZone(ratio);
}
