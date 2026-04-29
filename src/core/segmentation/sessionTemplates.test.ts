import { describe, expect, it } from 'vitest';
import { SESSION_TEMPLATES, findTemplate } from './sessionTemplates';
import {
  expandSessionPlan,
  getValidProfiles,
  validateSessionPlan,
  type EditableSessionPlan,
  type SessionBlock,
  type SessionItem,
} from './sessionPlan';

/**
 * Suma la duracion total de los bloques de un item resolviendo grupos.
 */
function itemDurationSec(item: SessionItem): number {
  if (item.type === 'block') return item.block.durationSec;
  return item.blocks.reduce((acc, b) => acc + b.durationSec, 0) * Math.max(1, Math.floor(item.repeat));
}

/**
 * Devuelve todos los bloques expandidos como SessionBlock[] (resolviendo grupos)
 * para poder iterarlos sin distinguir tipos.
 */
function expandToBlocks(items: readonly SessionItem[]): SessionBlock[] {
  const editable: EditableSessionPlan = { name: 'test', items: [...items] };
  return expandSessionPlan(editable).blocks;
}

/**
 * Suma los segundos de trabajo en una zona objetivo (solo phase === 'work' o
 * phase === 'main' con esa zona, ignorando warmups y recoveries).
 */
function workSecondsInZone(blocks: SessionBlock[], targetZone: number): number {
  return blocks
    .filter((b) => (b.phase === 'work' || b.phase === 'main') && b.zone === targetZone)
    .reduce((acc, b) => acc + b.durationSec, 0);
}

describe('SESSION_TEMPLATES — invariantes generales', () => {
  it.each(SESSION_TEMPLATES.map((t) => [t.id, t] as const))(
    '%s: id, items y validacion correctos',
    (_id, template) => {
      expect(template.id).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.description.length).toBeGreaterThan(20);
      expect(template.items.length).toBeGreaterThan(0);

      const editable: EditableSessionPlan = { name: template.name, items: [...template.items] };
      const validation = validateSessionPlan(editable);
      expect(validation.ok).toBe(true);

      const expanded = expandSessionPlan(editable);
      expect(expanded.blocks.length).toBeGreaterThan(0);
    },
  );

  it.each(SESSION_TEMPLATES.map((t) => [t.id, t] as const))(
    '%s: cadenceProfile valido para la zona en cada bloque',
    (_id, template) => {
      const blocks = expandToBlocks(template.items);
      for (const b of blocks) {
        const valid = getValidProfiles(b.zone);
        expect(valid).toContain(b.cadenceProfile);
      }
    },
  );

  it.each(SESSION_TEMPLATES.map((t) => [t.id, t] as const))(
    '%s: sin duraciones <= 0',
    (_id, template) => {
      const blocks = expandToBlocks(template.items);
      for (const b of blocks) {
        expect(b.durationSec).toBeGreaterThan(0);
      }
    },
  );
});

describe('findTemplate', () => {
  it('devuelve la plantilla correcta para un id valido', () => {
    const t = findTemplate('tempo-mlss');
    expect(t).toBeDefined();
    expect(t?.name).toBe('Tempo MLSS');
  });

  it('devuelve undefined para un id desconocido', () => {
    expect(findTemplate('inexistente')).toBeUndefined();
  });
});

describe('Plantillas nuevas — coherencia con la prescripcion del XLSX', () => {
  describe('tempo-mlss (Z3 alta MLSS)', () => {
    const template = findTemplate('tempo-mlss')!;

    it('tiene >=30 min de trabajo neto en Z3 (TTA novato)', () => {
      const blocks = expandToBlocks(template.items);
      const z3WorkSec = workSecondsInZone(blocks, 3);
      expect(z3WorkSec).toBeGreaterThanOrEqual(30 * 60);
    });

    it('cada bloque de trabajo Z3 dura entre 8 y 15 min (TMM)', () => {
      const blocks = expandToBlocks(template.items);
      const z3Work = blocks.filter((b) => b.phase === 'work' && b.zone === 3);
      expect(z3Work.length).toBeGreaterThan(0);
      for (const b of z3Work) {
        expect(b.durationSec).toBeGreaterThan(8 * 60);
        expect(b.durationSec).toBeLessThan(15 * 60);
      }
    });

    it('recuperacion entre intervalos cae a Z2 entre 3 y 5 min', () => {
      const blocks = expandToBlocks(template.items);
      const recoveries = blocks.filter((b) => b.phase === 'recovery');
      for (const b of recoveries) {
        expect(b.zone).toBe(2);
        expect(b.durationSec).toBeGreaterThanOrEqual(3 * 60);
        expect(b.durationSec).toBeLessThanOrEqual(5 * 60);
      }
    });
  });

  describe('umbral-progresivo (Z4 alta VT2)', () => {
    const template = findTemplate('umbral-progresivo')!;

    it('tiene >=20 min de trabajo neto en Z4 (TTA avanzado)', () => {
      const blocks = expandToBlocks(template.items);
      const z4WorkSec = workSecondsInZone(blocks, 4);
      expect(z4WorkSec).toBeGreaterThanOrEqual(20 * 60);
    });

    it('cada bloque de trabajo Z4 dura entre 3 y 8 min (TMM)', () => {
      const blocks = expandToBlocks(template.items);
      const z4Work = blocks.filter((b) => b.phase === 'work' && b.zone === 4);
      expect(z4Work.length).toBeGreaterThan(0);
      for (const b of z4Work) {
        expect(b.durationSec).toBeGreaterThan(3 * 60);
        expect(b.durationSec).toBeLessThan(8 * 60);
      }
    });

    it('recuperacion entre intervalos cae a Z2 entre 1.5 y 2 min', () => {
      const blocks = expandToBlocks(template.items);
      const recoveries = blocks.filter((b) => b.phase === 'recovery');
      for (const b of recoveries) {
        expect(b.zone).toBe(2);
        expect(b.durationSec).toBeGreaterThanOrEqual(90);
        expect(b.durationSec).toBeLessThanOrEqual(120);
      }
    });
  });

  describe('vo2max-cortos (Z5 alta PAM)', () => {
    const template = findTemplate('vo2max-cortos')!;

    it('tiene >=10 min de trabajo neto en Z5 (TTA avanzado)', () => {
      const blocks = expandToBlocks(template.items);
      const z5WorkSec = workSecondsInZone(blocks, 5);
      expect(z5WorkSec).toBeGreaterThanOrEqual(10 * 60);
    });

    it('cada bloque de trabajo Z5 dura entre 1 y 3 min (TMM)', () => {
      const blocks = expandToBlocks(template.items);
      const z5Work = blocks.filter((b) => b.phase === 'work' && b.zone === 5);
      expect(z5Work.length).toBeGreaterThan(0);
      for (const b of z5Work) {
        expect(b.durationSec).toBeGreaterThanOrEqual(60);
        expect(b.durationSec).toBeLessThan(3 * 60);
      }
    });

    it('Z5 fuerza cadenceProfile climb', () => {
      const blocks = expandToBlocks(template.items);
      const z5Blocks = blocks.filter((b) => b.zone === 5);
      for (const b of z5Blocks) {
        expect(b.cadenceProfile).toBe('climb');
      }
    });

    it('recuperacion entre intervalos cae a Z1 entre 1 y 1.5 min', () => {
      const blocks = expandToBlocks(template.items);
      const recoveries = blocks.filter((b) => b.phase === 'recovery');
      for (const b of recoveries) {
        expect(b.zone).toBe(1);
        expect(b.durationSec).toBeGreaterThanOrEqual(60);
        expect(b.durationSec).toBeLessThanOrEqual(90);
      }
    });
  });

  describe('recuperacion-activa (Z1-Z2 sin intervalos)', () => {
    const template = findTemplate('recuperacion-activa')!;

    it('duracion total entre 30 y 45 min', () => {
      const totalSec = template.items.reduce((acc, item) => acc + itemDurationSec(item), 0);
      expect(totalSec).toBeGreaterThanOrEqual(30 * 60);
      expect(totalSec).toBeLessThanOrEqual(45 * 60);
    });

    it('todos los bloques son Z1 o Z2 (sin intensidad)', () => {
      const blocks = expandToBlocks(template.items);
      for (const b of blocks) {
        expect([1, 2]).toContain(b.zone);
      }
    });

    it('no contiene grupos de intervalos', () => {
      for (const item of template.items) {
        expect(item.type).toBe('block');
      }
    });
  });
});
