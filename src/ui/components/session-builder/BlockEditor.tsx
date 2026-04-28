import { useEffect, useMemo, useRef, useState } from 'react';
import type { HeartRateZone } from '@core/physiology/karvonen';
import { getZoneCriteria } from '@core/matching';
import {
  defaultCadenceProfile,
  getValidProfiles,
  PHASES,
  reconcileCadenceProfile,
  type CadenceProfile,
  type Phase,
  type SessionBlock,
} from '@core/segmentation';
import { Button } from '../Button';
import { MaterialIcon } from '../MaterialIcon';
import { ZoneBadge } from '../ZoneBadge';

export interface BlockEditorProps {
  block: SessionBlock;
  onSave: (block: SessionBlock) => void;
  onCancel: () => void;
}

const PHASE_LABELS: Record<Phase, string> = {
  warmup: 'Calentamiento',
  work: 'Trabajo',
  recovery: 'Recuperación',
  rest: 'Descanso',
  cooldown: 'Vuelta a la calma',
  main: 'Principal',
};

const PHASE_ICONS: Record<Phase, string> = {
  warmup: 'whatshot',
  work: 'fitness_center',
  recovery: 'self_improvement',
  rest: 'pause_circle',
  cooldown: 'ac_unit',
  main: 'directions_bike',
};

const ZONE_LABELS: Record<HeartRateZone, string> = {
  1: 'Z1 — Recuperación',
  2: 'Z2 — Aeróbico base',
  3: 'Z3 — Tempo / MLSS',
  4: 'Z4 — Umbral',
  5: 'Z5 — Muros / escalada',
  6: 'Z6 — Sprint supramáximo',
};

const PROFILE_LABELS: Record<CadenceProfile, string> = {
  flat: 'Llano',
  climb: 'Escalada',
  sprint: 'Sprint',
};

/**
 * Editor inline de un unico bloque. Modifica zona, fase, cadenceProfile,
 * duracion (mm:ss) y descripcion opcional. Devuelve el bloque editado al
 * padre via onSave.
 *
 * El editor mantiene su propio state para que el usuario pueda cancelar
 * sin perder el bloque original.
 */
export function BlockEditor({ block, onSave, onCancel }: BlockEditorProps): JSX.Element {
  const [phase, setPhase] = useState<Phase>(block.phase);
  const [zone, setZone] = useState<HeartRateZone>(block.zone);
  const [cadenceProfile, setCadenceProfile] = useState<CadenceProfile>(
    reconcileCadenceProfile(block.zone, block.cadenceProfile),
  );
  const [minutes, setMinutes] = useState(() => Math.floor(block.durationSec / 60));
  const [seconds, setSeconds] = useState(() => block.durationSec % 60);
  const [description, setDescription] = useState<string>(block.description ?? '');
  const firstInputRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const validProfiles = useMemo(() => getValidProfiles(zone), [zone]);
  const profileLocked = validProfiles.length === 1;

  // Si la zona cambia y el profile actual no es valido, forzamos el default
  // de la nueva zona. Esto evita estados invalidos (ej. Z5 + flat).
  useEffect(() => {
    if (!validProfiles.includes(cadenceProfile)) {
      setCadenceProfile(defaultCadenceProfile(zone));
    }
  }, [zone, validProfiles, cadenceProfile]);

  const criteria = getZoneCriteria(zone, cadenceProfile);
  const cadenceHint = `${criteria.cadenceMin}-${criteria.cadenceMax} rpm`;

  const totalSec = Math.max(1, minutes * 60 + seconds);
  const isValid = totalSec > 0;

  const handleSave = (): void => {
    if (!isValid) return;
    const trimmedDesc = description.trim();
    const next: SessionBlock = {
      id: block.id,
      phase,
      zone,
      cadenceProfile,
      durationSec: totalSec,
      ...(trimmedDesc.length > 0 ? { description: trimmedDesc } : {}),
    };
    onSave(next);
  };

  return (
    <div className="rounded-lg border-2 border-turquesa-400 bg-turquesa-50/30 p-3 md:p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-gris-700 mb-1 block">Tipo de fase</span>
          <select
            ref={firstInputRef}
            value={phase}
            onChange={(e) => setPhase(e.target.value as Phase)}
            className="w-full rounded-md border-2 border-gris-300 bg-white px-2 py-2 text-sm focus:border-turquesa-500 focus:outline-none min-h-[40px]"
          >
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {PHASE_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gris-700 mb-1 block">Zona</span>
          <select
            value={zone}
            onChange={(e) => setZone(Number(e.target.value) as HeartRateZone)}
            className="w-full rounded-md border-2 border-gris-300 bg-white px-2 py-2 text-sm focus:border-turquesa-500 focus:outline-none min-h-[40px]"
          >
            {([1, 2, 3, 4, 5, 6] as const).map((z) => (
              <option key={z} value={z}>
                {ZONE_LABELS[z]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-gris-700 mb-1 block">
          Tipo de bloque{' '}
          {profileLocked && (
            <span className="text-gris-400 font-normal">(fijo para esta zona)</span>
          )}
        </span>
        <select
          value={cadenceProfile}
          onChange={(e) => setCadenceProfile(e.target.value as CadenceProfile)}
          disabled={profileLocked}
          className="w-full rounded-md border-2 border-gris-300 bg-white px-2 py-2 text-sm focus:border-turquesa-500 focus:outline-none min-h-[40px] disabled:bg-gris-100 disabled:text-gris-600"
        >
          {validProfiles.map((p) => (
            <option key={p} value={p}>
              {PROFILE_LABELS[p]}
            </option>
          ))}
        </select>
        <p className="text-xs text-gris-500 mt-1">Cadencia objetivo: {cadenceHint}</p>
      </label>

      <div>
        <span className="text-xs font-semibold text-gris-700 mb-1 block">Duración</span>
        <div className="flex items-center gap-2">
          <NumberInput
            value={minutes}
            onChange={setMinutes}
            min={0}
            max={120}
            label="minutos"
          />
          <span className="text-gris-500 font-bold">:</span>
          <NumberInput
            value={seconds}
            onChange={setSeconds}
            min={0}
            max={59}
            label="segundos"
            pad
          />
          <span className="text-xs text-gris-500 ml-1">mm:ss</span>
        </div>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-gris-700 mb-1 block">
          Descripción <span className="text-gris-400 font-normal">(opcional)</span>
        </span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej: 30 s a tope"
          maxLength={60}
          className="w-full rounded-md border-2 border-gris-300 bg-white px-3 py-2 text-sm focus:border-turquesa-500 focus:outline-none min-h-[40px]"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-1">
        <div className="flex items-center gap-2 text-xs text-gris-600 flex-wrap">
          <MaterialIcon name={PHASE_ICONS[phase]} size="small" className="text-gris-500" />
          <span>{PHASE_LABELS[phase]}</span>
          <ZoneBadge zone={zone} size="sm" />
          <span className="text-gris-500">· {PROFILE_LABELS[cadenceProfile]}</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!isValid}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}

interface NumberInputProps {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  label: string;
  pad?: boolean;
}

function NumberInput({ value, onChange, min, max, label, pad = false }: NumberInputProps): JSX.Element {
  const display = pad ? value.toString().padStart(2, '0') : value.toString();
  return (
    <input
      type="number"
      inputMode="numeric"
      pattern="[0-9]*"
      min={min}
      max={max}
      value={display}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10);
        if (Number.isFinite(n)) {
          onChange(Math.max(min, Math.min(max, n)));
        } else if (e.target.value === '') {
          onChange(min);
        }
      }}
      aria-label={label}
      className="w-16 text-center rounded-md border-2 border-gris-300 bg-white px-2 py-2 text-base font-semibold tabular-nums focus:border-turquesa-500 focus:outline-none min-h-[40px]"
    />
  );
}
