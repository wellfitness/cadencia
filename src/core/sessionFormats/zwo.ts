import type { HeartRateZone } from '../physiology/karvonen';
import {
  defaultCadenceProfile,
  reconcileCadenceProfile,
  type CadenceProfile,
  type EditableSessionPlan,
  type Phase,
  type SessionBlock,
  type SessionItem,
} from '../segmentation/sessionPlan';

/**
 * Lectura/escritura del formato ZWO (Zwift Workout). Es XML plano, espec
 * abierta y aceptado por Zwift, TrainerRoad, Wahoo SYSTM, MyWhoosh y
 * TrainingPeaks Virtual. Se trabaja en cliente sin dependencias externas.
 *
 * Mapeos clave (ver tabla del CLAUDE.md):
 * - zone Z1..Z6 ↔ Power (% FTP) usando los thresholds Coggan.
 * - cadenceProfile flat/climb/sprint ↔ atributo Cadence.
 * - phase warmup/cooldown ↔ <Warmup>/<Cooldown> con rampa.
 * - resto de phases ↔ <SteadyState>.
 * - RepeatGroup de exactamente 2 bloques ↔ <IntervalsT> nativo. Si tiene 3+,
 *   se expanden como bloques individuales repetidos.
 *
 * Pérdida en round-trip: ZWO no preserva el cadenceProfile como concepto
 * (solo la cadencia rpm), así que al reimportar se infiere por heurística.
 */

/** Centros de banda Coggan en %FTP. Determinista. */
const ZONE_TO_POWER: Record<HeartRateZone, number> = {
  1: 0.5,
  2: 0.65,
  3: 0.825,
  4: 0.975,
  5: 1.125,
  6: 1.3,
};

/** rpm representativa de cada cadenceProfile (centro del rango aceptado). */
const PROFILE_TO_RPM: Record<CadenceProfile, number> = {
  flat: 80,
  climb: 65,
  sprint: 100,
};

/**
 * Inverso de ZONE_TO_POWER: mapea %FTP a la zona Coggan correspondiente.
 * Se usa en import para reconstruir la zona desde el atributo Power.
 */
function powerToZone(power: number): HeartRateZone {
  if (power < 0.55) return 1;
  if (power < 0.75) return 2;
  if (power < 0.9) return 3;
  if (power < 1.05) return 4;
  if (power < 1.2) return 5;
  return 6;
}

/**
 * Infiere cadenceProfile a partir de la cadencia explicita (si existe) y la
 * zona. Sin Cadence en el ZWO se cae a heuristica por zona: Z6 sprint, Z5
 * climb, resto flat. Siempre se reconcilia para que el profile sea valido
 * para la zona (ej. evita Z2+climb).
 */
function inferCadenceProfile(zone: HeartRateZone, cadence: number | null): CadenceProfile {
  let raw: CadenceProfile;
  if (cadence !== null && Number.isFinite(cadence) && cadence > 0) {
    if (cadence >= 90) raw = 'sprint';
    else if (cadence < 70) raw = 'climb';
    else raw = 'flat';
  } else {
    if (zone === 6) raw = 'sprint';
    else if (zone === 5) raw = 'climb';
    else raw = 'flat';
  }
  return reconcileCadenceProfile(zone, raw);
}

/**
 * Heuristica para rellenar phase al importar un SteadyState que no trae
 * pista. Z1-Z2 se interpretan como recovery, Z3-Z4 como work principal,
 * Z5-Z6 como work intenso. La phase no afecta a la fisica pero sí a iconos
 * y labels de la UI.
 */
function inferPhase(zone: HeartRateZone, indexInPlan: number, totalItems: number): Phase {
  if (indexInPlan === 0) return 'warmup';
  if (indexInPlan === totalItems - 1 && zone <= 2) return 'cooldown';
  if (zone <= 2) return 'recovery';
  return 'work';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtPower(p: number): string {
  return p.toFixed(3).replace(/\.?0+$/, (match) => (match.startsWith('.') ? '' : match));
}

function blockToZwoElement(block: SessionBlock): string {
  const power = fmtPower(ZONE_TO_POWER[block.zone]);
  const cadence = PROFILE_TO_RPM[block.cadenceProfile];
  const dur = Math.max(1, Math.round(block.durationSec));
  switch (block.phase) {
    case 'warmup':
      // CadenceHigh igual al Cadence para que parsers que leen la rampa
      // (TrainingPeaks, p.ej.) no muestren "X-undefined rpm". Como nuestro
      // modelo no varia la cadencia dentro del warmup, ambos coinciden.
      return `    <Warmup Duration="${dur}" PowerLow="0.5" PowerHigh="${power}" Cadence="${cadence}" CadenceHigh="${cadence}"/>`;
    case 'cooldown':
      return `    <Cooldown Duration="${dur}" PowerLow="${power}" PowerHigh="0.4" Cadence="${cadence}" CadenceHigh="${cadence}"/>`;
    default:
      return `    <SteadyState Duration="${dur}" Power="${power}" Cadence="${cadence}"/>`;
  }
}

/**
 * Comprueba si un grupo se puede emitir como <IntervalsT> nativo (2 bloques,
 * sin warmup/cooldown). Cualquier otro caso se expande como bloques sueltos.
 */
function canUseIntervalsT(blocks: SessionBlock[]): boolean {
  if (blocks.length !== 2) return false;
  return blocks.every((b) => b.phase !== 'warmup' && b.phase !== 'cooldown');
}

function groupToIntervalsT(repeat: number, on: SessionBlock, off: SessionBlock): string {
  const onPower = fmtPower(ZONE_TO_POWER[on.zone]);
  const offPower = fmtPower(ZONE_TO_POWER[off.zone]);
  const onCad = PROFILE_TO_RPM[on.cadenceProfile];
  const offCad = PROFILE_TO_RPM[off.cadenceProfile];
  const r = Math.max(1, Math.floor(repeat));
  return `    <IntervalsT Repeat="${r}" OnDuration="${Math.max(1, Math.round(on.durationSec))}" OffDuration="${Math.max(1, Math.round(off.durationSec))}" OnPower="${onPower}" OffPower="${offPower}" Cadence="${onCad}" CadenceResting="${offCad}"/>`;
}

export interface ZwoExportOptions {
  /** Autor del workout. Default "Cadencia". */
  author?: string;
}

/**
 * Serializa un EditableSessionPlan a XML ZWO. Salida valida segun la espec
 * de Zwift. La descripcion identifica al generador (Cadencia) por su dominio
 * publico para que cualquiera que reciba el archivo en TrainingPeaks/Zwift
 * pueda llegar a la app.
 */
export function exportZwo(plan: EditableSessionPlan, options: ZwoExportOptions = {}): string {
  const author = options.author ?? 'Cadencia';
  const description = 'Generado por cadencia.movimientofuncional.app';
  const lines: string[] = [];
  for (const item of plan.items) {
    if (item.type === 'block') {
      lines.push(blockToZwoElement(item.block));
      continue;
    }
    if (canUseIntervalsT(item.blocks)) {
      lines.push(groupToIntervalsT(item.repeat, item.blocks[0]!, item.blocks[1]!));
      continue;
    }
    // Grupo con 1 o 3+ bloques: expandir
    const reps = Math.max(1, Math.floor(item.repeat));
    for (let i = 0; i < reps; i++) {
      for (const block of item.blocks) {
        lines.push(blockToZwoElement(block));
      }
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>${escapeXml(author)}</author>
  <name>${escapeXml(plan.name)}</name>
  <description>${escapeXml(description)}</description>
  <sportType>bike</sportType>
  <tags/>
  <workout>
${lines.join('\n')}
  </workout>
</workout_file>
`;
}

export type ZwoImportResult =
  | { ok: true; plan: EditableSessionPlan }
  | { ok: false; error: string };

/**
 * Lee un atributo numerico positivo. Devuelve null si no existe o no parsea.
 */
function readNumberAttr(el: Element, name: string): number | null {
  const raw = el.getAttribute(name);
  if (raw === null) return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Convierte un elemento simple del ZWO (Warmup, SteadyState, Cooldown, Ramp,
 * FreeRide) en un SessionBlock. Algunos atributos son opcionales segun la
 * espec; se aplican defaults razonables.
 */
function elementToBlock(
  el: Element,
  id: string,
  positionHint: { index: number; total: number },
): SessionBlock | null {
  const tag = el.tagName;
  const duration = readNumberAttr(el, 'Duration');
  if (duration === null || duration <= 0) return null;

  let zone: HeartRateZone;
  let phase: Phase;

  switch (tag) {
    case 'Warmup': {
      const high = readNumberAttr(el, 'PowerHigh') ?? 0.65;
      zone = powerToZone(high);
      phase = 'warmup';
      break;
    }
    case 'Cooldown': {
      const low = readNumberAttr(el, 'PowerLow') ?? 0.65;
      zone = powerToZone(low);
      phase = 'cooldown';
      break;
    }
    case 'Ramp': {
      // Una rampa ZWO es un bloque con power ascendente. La aproximamos como
      // un SteadyState a la potencia media de la rampa, manteniendo phase
      // segun heuristica de posicion.
      const low = readNumberAttr(el, 'PowerLow') ?? 0.5;
      const high = readNumberAttr(el, 'PowerHigh') ?? low;
      zone = powerToZone((low + high) / 2);
      phase = inferPhase(zone, positionHint.index, positionHint.total);
      break;
    }
    case 'FreeRide': {
      // FreeRide no tiene potencia objetivo; asumimos Z2 (rodaje).
      zone = 2;
      phase = inferPhase(zone, positionHint.index, positionHint.total);
      break;
    }
    case 'SteadyState':
    default: {
      const power = readNumberAttr(el, 'Power') ?? 0.65;
      zone = powerToZone(power);
      phase = inferPhase(zone, positionHint.index, positionHint.total);
      break;
    }
  }

  const cadence = readNumberAttr(el, 'Cadence');
  const cadenceProfile = inferCadenceProfile(zone, cadence);

  const block: SessionBlock = {
    id,
    phase,
    zone,
    cadenceProfile,
    durationSec: Math.round(duration),
  };
  return block;
}

/**
 * Convierte un <IntervalsT> en un SessionItem de tipo group con dos bloques
 * (on/off). Si los atributos no son completos, devuelve null.
 */
function intervalsToGroup(el: Element, baseId: string): SessionItem | null {
  const repeat = readNumberAttr(el, 'Repeat');
  const onDur = readNumberAttr(el, 'OnDuration');
  const offDur = readNumberAttr(el, 'OffDuration');
  const onPower = readNumberAttr(el, 'OnPower');
  const offPower = readNumberAttr(el, 'OffPower');
  if (
    repeat === null ||
    onDur === null ||
    offDur === null ||
    onPower === null ||
    offPower === null
  )
    return null;
  if (repeat < 1 || onDur <= 0 || offDur <= 0) return null;

  const onCadence = readNumberAttr(el, 'Cadence');
  const offCadence = readNumberAttr(el, 'CadenceResting');

  const onZone = powerToZone(onPower);
  const offZone = powerToZone(offPower);
  const onProfile = inferCadenceProfile(onZone, onCadence);
  const offProfile = inferCadenceProfile(offZone, offCadence);

  const onBlock: SessionBlock = {
    id: `${baseId}-on`,
    phase: 'work',
    zone: onZone,
    cadenceProfile: onProfile,
    durationSec: Math.round(onDur),
  };
  const offBlock: SessionBlock = {
    id: `${baseId}-off`,
    phase: 'recovery',
    zone: offZone,
    cadenceProfile: offProfile,
    durationSec: Math.round(offDur),
  };
  return {
    type: 'group',
    id: baseId,
    repeat: Math.max(1, Math.floor(repeat)),
    blocks: [onBlock, offBlock],
  };
}

/**
 * Parsea un XML ZWO y devuelve un EditableSessionPlan listo para cargar en
 * el SessionBuilder. Falla con `{ ok: false, error }` si el XML no es valido,
 * no es un workout_file o no es de tipo bike.
 */
export function importZwo(xml: string): ZwoImportResult {
  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xml, 'application/xml');
  } catch {
    return { ok: false, error: 'XML mal formado.' };
  }
  if (doc.querySelector('parsererror') !== null) {
    return { ok: false, error: 'XML mal formado.' };
  }
  const root = doc.querySelector('workout_file');
  if (root === null) {
    return { ok: false, error: 'No es un archivo ZWO valido (falta <workout_file>).' };
  }
  const sportType = root.querySelector('sportType')?.textContent?.trim();
  if (sportType !== undefined && sportType !== '' && sportType !== 'bike') {
    return { ok: false, error: `Solo se soporta sportType "bike" (este es "${sportType}").` };
  }
  const name = root.querySelector('name')?.textContent?.trim();
  const workout = root.querySelector('workout');
  if (workout === null) {
    return { ok: false, error: 'El ZWO no contiene <workout>.' };
  }

  const elementChildren = Array.from(workout.children).filter((c) => c.tagName !== 'textevent');
  const totalItems = elementChildren.length;
  const items: SessionItem[] = [];
  let nextId = 1;

  elementChildren.forEach((child, index) => {
    const tag = child.tagName;
    if (
      tag === 'Warmup' ||
      tag === 'SteadyState' ||
      tag === 'Cooldown' ||
      tag === 'Ramp' ||
      tag === 'FreeRide'
    ) {
      const block = elementToBlock(child, `b${nextId}`, { index, total: totalItems });
      nextId += 1;
      if (block !== null) {
        items.push({ type: 'block', block });
      }
      return;
    }
    if (tag === 'IntervalsT') {
      const group = intervalsToGroup(child, `g${nextId}`);
      nextId += 1;
      if (group !== null) {
        items.push(group);
      }
      return;
    }
    // Otros tags ZWO (MaxEffort, RestDay, etc.) se ignoran silenciosamente.
  });

  if (items.length === 0) {
    return { ok: false, error: 'El ZWO no contiene bloques validos.' };
  }

  return {
    ok: true,
    plan: {
      name: name !== undefined && name.length > 0 ? name : 'Workout importado',
      items,
    },
  };
}

// Exports utilitarios para tests y consumidores especificos. Los mapeos son
// deterministas y se documentan aqui para que los tests puedan asertar
// contra los mismos valores que usa el encoder/decoder.
export const __testing = {
  ZONE_TO_POWER,
  PROFILE_TO_RPM,
  powerToZone,
  inferCadenceProfile,
  defaultCadenceProfile,
};
