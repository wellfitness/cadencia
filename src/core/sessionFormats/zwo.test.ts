import { describe, it, expect } from 'vitest';
import { SESSION_TEMPLATES } from '@core/segmentation/sessionTemplates';
import type { EditableSessionPlan } from '@core/segmentation/sessionPlan';
import { exportZwo, importZwo, __testing } from './zwo';

// Vitest ejecuta este test en environment jsdom (config global del proyecto),
// asi que DOMParser esta disponible globalmente sin import explicito.

describe('zwo: mapeo de zona ↔ %FTP', () => {
  it('powerToZone respeta los thresholds Coggan', () => {
    expect(__testing.powerToZone(0.4)).toBe(1);
    expect(__testing.powerToZone(0.54)).toBe(1);
    expect(__testing.powerToZone(0.55)).toBe(2);
    expect(__testing.powerToZone(0.74)).toBe(2);
    expect(__testing.powerToZone(0.75)).toBe(3);
    expect(__testing.powerToZone(0.89)).toBe(3);
    expect(__testing.powerToZone(0.9)).toBe(4);
    expect(__testing.powerToZone(1.04)).toBe(4);
    expect(__testing.powerToZone(1.05)).toBe(5);
    expect(__testing.powerToZone(1.19)).toBe(5);
    expect(__testing.powerToZone(1.2)).toBe(6);
    expect(__testing.powerToZone(1.5)).toBe(6);
  });

  it('ZONE_TO_POWER cae dentro de su banda Coggan al re-clasificar', () => {
    for (const z of [1, 2, 3, 4, 5, 6] as const) {
      const p = __testing.ZONE_TO_POWER[z];
      expect(__testing.powerToZone(p)).toBe(z);
    }
  });
});

describe('zwo: inferCadenceProfile', () => {
  it('cadencia explicita >=90 → sprint si la zona lo permite', () => {
    expect(__testing.inferCadenceProfile(6, 100)).toBe('sprint');
  });

  it('cadencia explicita <70 → climb si la zona lo permite', () => {
    expect(__testing.inferCadenceProfile(5, 65)).toBe('climb');
  });

  it('cadencia rango medio → flat (cuando es valido para la zona)', () => {
    expect(__testing.inferCadenceProfile(2, 80)).toBe('flat');
  });

  it('reconciliacion: cadencia 80 (flat) en Z5 → climb (Z5 solo permite climb)', () => {
    expect(__testing.inferCadenceProfile(5, 80)).toBe('climb');
  });

  it('reconciliacion: cadencia 100 (sprint) en Z2 → flat (Z2 solo permite flat)', () => {
    expect(__testing.inferCadenceProfile(2, 100)).toBe('flat');
  });

  it('sin cadencia: heuristica por zona', () => {
    expect(__testing.inferCadenceProfile(6, null)).toBe('sprint');
    expect(__testing.inferCadenceProfile(5, null)).toBe('climb');
    expect(__testing.inferCadenceProfile(3, null)).toBe('flat');
  });
});

describe('zwo: recommendedRpm', () => {
  it('flat: ~80 rpm en Z1-Z2, sube en Z3-Z4', () => {
    expect(__testing.recommendedRpm(1, 'flat')).toBe(80);
    expect(__testing.recommendedRpm(2, 'flat')).toBe(80);
    expect(__testing.recommendedRpm(3, 'flat')).toBe(82);
    expect(__testing.recommendedRpm(4, 'flat')).toBe(85);
  });

  it('climb: alto en Z3-Z4 (75 rpm), bajo solo en Z5 (muro de fuerza)', () => {
    // En Z3/Z4 la cadencia recomendada es ALTA dentro del rango 55-80, no
    // baja: lo eficiente en escalada moderada es pedaleo redondo, no fuerza.
    expect(__testing.recommendedRpm(3, 'climb')).toBe(75);
    expect(__testing.recommendedRpm(4, 'climb')).toBe(75);
    // Z5 es la excepcion: muro de fuerza con cadencia baja.
    expect(__testing.recommendedRpm(5, 'climb')).toBe(65);
  });

  it('sprint: 105 rpm en Z6', () => {
    expect(__testing.recommendedRpm(6, 'sprint')).toBe(105);
  });
});

describe('zwo: exportZwo', () => {
  it('genera XML con cabecera, sportType bike y elementos', () => {
    const plan: EditableSessionPlan = {
      name: 'Test',
      items: [
        {
          type: 'block',
          block: {
            id: 'b1',
            phase: 'warmup',
            zone: 2,
            cadenceProfile: 'flat',
            durationSec: 300,
          },
        },
      ],
    };
    const xml = exportZwo(plan);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<workout_file>');
    expect(xml).toContain('<sportType>bike</sportType>');
    expect(xml).toContain('<Warmup');
    expect(xml).toContain('Duration="300"');
  });

  it('escapa caracteres XML en el nombre', () => {
    const plan: EditableSessionPlan = {
      name: 'Sesión & "test" <hostil>',
      items: [
        {
          type: 'block',
          block: {
            id: 'b1',
            phase: 'work',
            zone: 3,
            cadenceProfile: 'flat',
            durationSec: 60,
          },
        },
      ],
    };
    const xml = exportZwo(plan);
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;');
    expect(xml).toContain('&lt;hostil&gt;');
    expect(xml).not.toContain('"test"</name>');
  });

  it('grupo de 2 bloques (work+recovery) se emite como <IntervalsT>', () => {
    const plan: EditableSessionPlan = {
      name: 'Test',
      items: [
        {
          type: 'group',
          id: 'g1',
          repeat: 4,
          blocks: [
            { id: 'on', phase: 'work', zone: 4, cadenceProfile: 'flat', durationSec: 240 },
            {
              id: 'off',
              phase: 'recovery',
              zone: 2,
              cadenceProfile: 'flat',
              durationSec: 180,
            },
          ],
        },
      ],
    };
    const xml = exportZwo(plan);
    expect(xml).toContain('<IntervalsT');
    expect(xml).toContain('Repeat="4"');
    expect(xml).toContain('OnDuration="240"');
    expect(xml).toContain('OffDuration="180"');
  });

  it('SteadyState NO emite Cadence fijo y lleva textevent con rango orientativo', () => {
    const plan: EditableSessionPlan = {
      name: 'Test',
      items: [
        {
          type: 'block',
          block: {
            id: 'b1',
            phase: 'work',
            zone: 4,
            cadenceProfile: 'climb',
            durationSec: 240,
          },
        },
      ],
    };
    const xml = exportZwo(plan);
    // El SteadyState no debe llevar atributo Cadence (no obligamos cadencia).
    expect(xml).not.toMatch(/<SteadyState[^>]*\sCadence=/);
    // Pero sí un textevent con el rango y la recomendacion.
    expect(xml).toContain('<textevent');
    expect(xml).toContain('timeoffset="0"');
    expect(xml).toContain('Cadencia 55-80 rpm');
    expect(xml).toContain('recomendado 75'); // Z4+climb → 75
  });

  it('Warmup y Cooldown emiten rango nativo Cadence/CadenceHigh', () => {
    const plan: EditableSessionPlan = {
      name: 'Test',
      items: [
        {
          type: 'block',
          block: {
            id: 'wu',
            phase: 'warmup',
            zone: 2,
            cadenceProfile: 'flat',
            durationSec: 300,
          },
        },
        {
          type: 'block',
          block: {
            id: 'cd',
            phase: 'cooldown',
            zone: 1,
            cadenceProfile: 'flat',
            durationSec: 300,
          },
        },
      ],
    };
    const xml = exportZwo(plan);
    // Rango nativo en flat: 70-90 rpm.
    expect(xml).toMatch(/<Warmup[^>]*Cadence="70"[^>]*CadenceHigh="90"/);
    expect(xml).toMatch(/<Cooldown[^>]*Cadence="70"[^>]*CadenceHigh="90"/);
  });

  it('IntervalsT NO emite Cadence ni CadenceResting', () => {
    const plan: EditableSessionPlan = {
      name: 'Test',
      items: [
        {
          type: 'group',
          id: 'g1',
          repeat: 4,
          blocks: [
            { id: 'on', phase: 'work', zone: 4, cadenceProfile: 'flat', durationSec: 240 },
            {
              id: 'off',
              phase: 'recovery',
              zone: 2,
              cadenceProfile: 'flat',
              durationSec: 180,
            },
          ],
        },
      ],
    };
    const xml = exportZwo(plan);
    expect(xml).toContain('<IntervalsT');
    expect(xml).not.toMatch(/<IntervalsT[^>]*\sCadence=/);
    expect(xml).not.toMatch(/<IntervalsT[^>]*CadenceResting=/);
  });

  it('description incluye los rangos orientativos de los profiles presentes', () => {
    const plan: EditableSessionPlan = {
      name: 'Test',
      items: [
        {
          type: 'block',
          block: { id: 'a', phase: 'work', zone: 4, cadenceProfile: 'climb', durationSec: 60 },
        },
        {
          type: 'block',
          block: { id: 'b', phase: 'work', zone: 6, cadenceProfile: 'sprint', durationSec: 30 },
        },
      ],
    };
    const xml = exportZwo(plan);
    expect(xml).toContain('Cadencias orientativas');
    expect(xml).toContain('climb 55-80 rpm');
    expect(xml).toContain('sprint 90-115 rpm');
    // Solo los profiles presentes — flat no aparece.
    expect(xml).not.toContain('flat 70-90 rpm');
  });

  it('grupo de 3+ bloques se expande como bloques sueltos repetidos', () => {
    const plan: EditableSessionPlan = {
      name: 'Test',
      items: [
        {
          type: 'group',
          id: 'g1',
          repeat: 2,
          blocks: [
            { id: 'a', phase: 'work', zone: 3, cadenceProfile: 'flat', durationSec: 60 },
            { id: 'b', phase: 'work', zone: 4, cadenceProfile: 'flat', durationSec: 60 },
            { id: 'c', phase: 'recovery', zone: 1, cadenceProfile: 'flat', durationSec: 60 },
          ],
        },
      ],
    };
    const xml = exportZwo(plan);
    expect(xml).not.toContain('<IntervalsT');
    // 2 repeticiones × 3 bloques = 6 elementos SteadyState
    expect((xml.match(/<SteadyState/g) ?? []).length).toBe(6);
  });
});

describe('zwo: importZwo', () => {
  it('rechaza XML mal formado', () => {
    const result = importZwo('<not xml');
    expect(result.ok).toBe(false);
  });

  it('rechaza XML que no es workout_file', () => {
    const result = importZwo('<?xml version="1.0"?><foo/>');
    expect(result.ok).toBe(false);
  });

  it('rechaza sportType distinto de bike', () => {
    const xml = `<?xml version="1.0"?>
<workout_file>
  <name>Run test</name>
  <sportType>run</sportType>
  <workout>
    <SteadyState Duration="60" Power="0.7"/>
  </workout>
</workout_file>`;
    const result = importZwo(xml);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('bike');
  });

  it('rechaza workout vacio', () => {
    const xml = `<?xml version="1.0"?>
<workout_file>
  <name>Vacio</name>
  <sportType>bike</sportType>
  <workout/>
</workout_file>`;
    const result = importZwo(xml);
    expect(result.ok).toBe(false);
  });

  it('parsea SteadyState con cadencia explicita', () => {
    const xml = `<?xml version="1.0"?>
<workout_file>
  <name>Test</name>
  <sportType>bike</sportType>
  <workout>
    <SteadyState Duration="120" Power="0.85" Cadence="65"/>
  </workout>
</workout_file>`;
    const result = importZwo(xml);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.items).toHaveLength(1);
      const item = result.plan.items[0]!;
      expect(item.type).toBe('block');
      if (item.type === 'block') {
        expect(item.block.zone).toBe(3);
        expect(item.block.cadenceProfile).toBe('climb');
        expect(item.block.durationSec).toBe(120);
      }
    }
  });

  it('parsea IntervalsT como grupo con on/off', () => {
    const xml = `<?xml version="1.0"?>
<workout_file>
  <name>Test</name>
  <sportType>bike</sportType>
  <workout>
    <IntervalsT Repeat="4" OnDuration="240" OffDuration="180" OnPower="0.95" OffPower="0.65"/>
  </workout>
</workout_file>`;
    const result = importZwo(xml);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.items).toHaveLength(1);
      const item = result.plan.items[0]!;
      expect(item.type).toBe('group');
      if (item.type === 'group') {
        expect(item.repeat).toBe(4);
        expect(item.blocks).toHaveLength(2);
        expect(item.blocks[0]!.zone).toBe(4); // 0.95 → Z4
        expect(item.blocks[1]!.zone).toBe(2); // 0.65 → Z2
      }
    }
  });

  it('Warmup recibe phase warmup, Cooldown phase cooldown', () => {
    const xml = `<?xml version="1.0"?>
<workout_file>
  <name>Test</name>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="300" PowerLow="0.5" PowerHigh="0.7"/>
    <SteadyState Duration="60" Power="0.95"/>
    <Cooldown Duration="300" PowerLow="0.6" PowerHigh="0.4"/>
  </workout>
</workout_file>`;
    const result = importZwo(xml);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const phases = result.plan.items
        .filter((i) => i.type === 'block')
        .map((i) => (i.type === 'block' ? i.block.phase : null));
      expect(phases).toEqual(['warmup', 'work', 'cooldown']);
    }
  });
});

describe('zwo: round-trip sobre plantillas cientificas', () => {
  // Pasar por ZWO conserva duracion total y secuencia de zonas, pero NO
  // necesariamente la estructura de grupos: ZWO solo soporta IntervalsT con
  // 2 fases. Grupos de 3+ bloques (HIIT 10-20-30) se expanden como bloques
  // sueltos al exportar, asi que el plan reimportado tendra mas items
  // individuales aunque el entrenamiento sea identico fisicamente.
  it.each(SESSION_TEMPLATES.map((t) => [t.id] as const))(
    'plantilla %s preserva duracion total y zonas',
    (templateId) => {
      const tpl = SESSION_TEMPLATES.find((t) => t.id === templateId)!;
      const plan: EditableSessionPlan = { name: tpl.name, items: tpl.items };
      const xml = exportZwo(plan);
      const result = importZwo(xml);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Duracion total preservada al segundo
      expect(countTotalDuration(result.plan)).toBe(countTotalDuration(plan));
      // Secuencia de zonas en orden cronologico preservada (cada bloque
      // ejecutado en la sesion expandida).
      expect(collectZones(result.plan)).toEqual(collectZones(plan));
      // El nombre del workout se preserva
      expect(result.plan.name).toBe(plan.name);
    },
  );

  it('grupo de 2 bloques (Noruego 4x4) sobrevive como group, no se desagrega', () => {
    const noruego = SESSION_TEMPLATES.find((t) => t.id === 'noruego-4x4')!;
    const plan: EditableSessionPlan = { name: noruego.name, items: noruego.items };
    const xml = exportZwo(plan);
    const result = importZwo(xml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Noruego: warmup + group(4× work+recovery) + cooldown -> al menos 1 group
    const hasGroup = result.plan.items.some((i) => i.type === 'group');
    expect(hasGroup).toBe(true);
  });
});

function countTotalDuration(plan: EditableSessionPlan): number {
  let total = 0;
  for (const item of plan.items) {
    if (item.type === 'block') total += item.block.durationSec;
    else {
      const groupDur = item.blocks.reduce((acc, b) => acc + b.durationSec, 0);
      total += groupDur * item.repeat;
    }
  }
  return total;
}

function collectZones(plan: EditableSessionPlan): number[] {
  const zones: number[] = [];
  for (const item of plan.items) {
    if (item.type === 'block') zones.push(item.block.zone);
    else for (let i = 0; i < item.repeat; i++) for (const b of item.blocks) zones.push(b.zone);
  }
  return zones;
}
