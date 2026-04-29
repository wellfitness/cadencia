import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSavedSession,
  listSavedSessions,
  getSavedSession,
  updateSavedSession,
  deleteSavedSession,
} from './saved';
import { clearCadenciaData } from '@ui/state/cadenciaStore';
import type { EditableSessionPlan } from '@core/segmentation';

const planA: EditableSessionPlan = { name: 'A', items: [] };

describe('savedSessions CRUD', () => {
  beforeEach(() => {
    clearCadenciaData();
  });

  it('createSavedSession devuelve un id valido y lo persiste', () => {
    const created = createSavedSession({ name: 'Mi Noruego', plan: planA });
    expect(created.id.length).toBeGreaterThan(0);
    expect(listSavedSessions()).toHaveLength(1);
  });

  it('listSavedSessions oculta tombstones', () => {
    const a = createSavedSession({ name: 'A', plan: planA });
    deleteSavedSession(a.id);
    expect(listSavedSessions()).toHaveLength(0);
  });

  it('getSavedSession devuelve null para tombstones', () => {
    const a = createSavedSession({ name: 'A', plan: planA });
    deleteSavedSession(a.id);
    expect(getSavedSession(a.id)).toBeNull();
  });

  it('updateSavedSession bumpea updatedAt', async () => {
    const a = createSavedSession({ name: 'A', plan: planA });
    await new Promise((r) => setTimeout(r, 10));
    const after = updateSavedSession(a.id, { name: 'A2' });
    expect(after?.name).toBe('A2');
    expect(new Date(after!.updatedAt).getTime()).toBeGreaterThan(
      new Date(a.updatedAt).getTime(),
    );
  });

  it('updateSavedSession devuelve null para id inexistente', () => {
    expect(updateSavedSession('no-existe', { name: 'X' })).toBeNull();
  });

  it('deleteSavedSession deja tombstone en lugar de borrar el item', () => {
    const a = createSavedSession({ name: 'A', plan: planA });
    deleteSavedSession(a.id);
    const raw = localStorage.getItem('cadencia:data:v1');
    expect(raw).toContain('deletedAt');
  });

  it('listSavedSessions ordena por updatedAt descendente', async () => {
    const a = createSavedSession({ name: 'A', plan: planA });
    await new Promise((r) => setTimeout(r, 10));
    const b = createSavedSession({ name: 'B', plan: planA });
    const list = listSavedSessions();
    expect(list[0]?.id).toBe(b.id);
    expect(list[1]?.id).toBe(a.id);
  });

  it('createSavedSession con description la persiste', () => {
    const created = createSavedSession({
      name: 'A',
      description: 'Mi sesion de los martes',
      plan: planA,
    });
    expect(getSavedSession(created.id)?.description).toBe('Mi sesion de los martes');
  });
});
