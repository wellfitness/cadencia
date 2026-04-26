import { describe, expect, it } from 'vitest';
import {
  calculateTotalDurationSec,
  expandSessionPlan,
  validateSessionPlan,
  type EditableSessionPlan,
  type SessionItem,
} from './sessionPlan';

const warmup: SessionItem = {
  type: 'block',
  block: { id: 'w', phase: 'warmup', zone: 2, durationSec: 300 },
};
const cooldown: SessionItem = {
  type: 'block',
  block: { id: 'c', phase: 'cooldown', zone: 1, durationSec: 300 },
};
const intervalGroup: SessionItem = {
  type: 'group',
  id: 'g',
  repeat: 4,
  blocks: [
    { id: 'work', phase: 'work', zone: 4, durationSec: 240 },
    { id: 'rec', phase: 'recovery', zone: 2, durationSec: 180 },
  ],
};

describe('expandSessionPlan', () => {
  it('expande un grupo × 4 a 8 bloques con IDs unicos', () => {
    const plan: EditableSessionPlan = {
      name: 'test',
      items: [warmup, intervalGroup, cooldown],
    };
    const expanded = expandSessionPlan(plan);
    // 1 warmup + 4 × (work + rec) + 1 cooldown = 10 bloques
    expect(expanded.blocks).toHaveLength(10);
    const ids = expanded.blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('w');
    expect(ids[1]).toBe('work-r0');
    expect(ids[2]).toBe('rec-r0');
    expect(ids[3]).toBe('work-r1');
    expect(ids[8]).toBe('rec-r3');
    expect(ids[9]).toBe('c');
  });

  it('preserva el orden y los datos del bloque al expandir', () => {
    const plan: EditableSessionPlan = { name: 'x', items: [intervalGroup] };
    const expanded = expandSessionPlan(plan);
    expect(expanded.blocks[0]?.zone).toBe(4);
    expect(expanded.blocks[0]?.durationSec).toBe(240);
    expect(expanded.blocks[1]?.zone).toBe(2);
    expect(expanded.blocks[1]?.durationSec).toBe(180);
  });

  it('respeta repeat=1 (un grupo no es lo mismo que un bloque suelto pero suma igual)', () => {
    const single: SessionItem = {
      type: 'group',
      id: 'g1',
      repeat: 1,
      blocks: [{ id: 'b', phase: 'work', zone: 4, durationSec: 60 }],
    };
    const expanded = expandSessionPlan({ name: 'x', items: [single] });
    expect(expanded.blocks).toHaveLength(1);
    expect(expanded.blocks[0]?.id).toBe('b-r0');
  });

  it('repeat <= 0 se trata como 1 (defensa)', () => {
    const broken: SessionItem = {
      type: 'group',
      id: 'g',
      repeat: 0,
      blocks: [{ id: 'b', phase: 'work', zone: 3, durationSec: 60 }],
    };
    const expanded = expandSessionPlan({ name: 'x', items: [broken] });
    expect(expanded.blocks).toHaveLength(1);
  });

  it('es determinista: misma entrada → misma salida', () => {
    const plan: EditableSessionPlan = {
      name: 'test',
      items: [warmup, intervalGroup, cooldown],
    };
    const a = expandSessionPlan(plan);
    const b = expandSessionPlan(plan);
    expect(a).toEqual(b);
  });
});

describe('calculateTotalDurationSec', () => {
  it('suma bloques sueltos y grupos × N', () => {
    const plan: EditableSessionPlan = {
      name: 'x',
      items: [warmup, intervalGroup, cooldown],
    };
    // 300 + 4 × (240 + 180) + 300 = 300 + 1680 + 300 = 2280
    expect(calculateTotalDurationSec(plan)).toBe(2280);
  });

  it('plan vacio devuelve 0', () => {
    expect(calculateTotalDurationSec({ name: 'x', items: [] })).toBe(0);
  });
});

describe('validateSessionPlan', () => {
  it('plan vacio no es valido', () => {
    const result = validateSessionPlan({ name: 'x', items: [] });
    expect(result.ok).toBe(false);
  });

  it('bloque con duracion 0 no es valido', () => {
    const result = validateSessionPlan({
      name: 'x',
      items: [{ type: 'block', block: { id: 'b', phase: 'work', zone: 4, durationSec: 0 } }],
    });
    expect(result.ok).toBe(false);
  });

  it('grupo vacio no es valido', () => {
    const result = validateSessionPlan({
      name: 'x',
      items: [{ type: 'group', id: 'g', repeat: 3, blocks: [] }],
    });
    expect(result.ok).toBe(false);
  });

  it('grupo con repeat < 1 no es valido', () => {
    const result = validateSessionPlan({
      name: 'x',
      items: [
        {
          type: 'group',
          id: 'g',
          repeat: 0,
          blocks: [{ id: 'b', phase: 'work', zone: 4, durationSec: 60 }],
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it('plan minimo (un bloque) es valido', () => {
    const result = validateSessionPlan({
      name: 'x',
      items: [{ type: 'block', block: { id: 'b', phase: 'main', zone: 2, durationSec: 600 } }],
    });
    expect(result.ok).toBe(true);
  });
});
