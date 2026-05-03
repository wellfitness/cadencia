import { describe, it, expect } from 'vitest';
import {
  categorizeTag,
  expandMacroToTags,
  getMacroById,
  isValidMacroId,
  MACRO_GENRES,
  migrateLegacyGenres,
  type MacroGenreId,
} from './genreCategories';

describe('genreCategories', () => {
  it('expone exactamente 10 macros', () => {
    expect(MACRO_GENRES).toHaveLength(10);
  });

  it('cada macro tiene id, label y al menos un tag', () => {
    for (const m of MACRO_GENRES) {
      expect(m.id).toBeTruthy();
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
      expect(m.tags.length).toBeGreaterThan(0);
    }
  });

  it('los ids son unicos', () => {
    const ids = MACRO_GENRES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ningun tag pertenece a dos macros distintos (mapeo disjunto)', () => {
    const seen = new Map<string, MacroGenreId>();
    for (const m of MACRO_GENRES) {
      for (const t of m.tags) {
        const prev = seen.get(t);
        if (prev !== undefined && prev !== m.id) {
          throw new Error(
            `Tag '${t}' aparece en ${prev} y en ${m.id} — debe ser disjunto`,
          );
        }
        seen.set(t, m.id);
      }
    }
  });

  describe('categorizeTag', () => {
    it('clasifica tags conocidos', () => {
      expect(categorizeTag('edm')).toBe('electronic');
      expect(categorizeTag('slap house')).toBe('house');
      expect(categorizeTag('synthpop')).toBe('pop');
      expect(categorizeTag('rock clásico')).toBe('rock');
      expect(categorizeTag('motown')).toBe('soul_funk');
      expect(categorizeTag('flamenco pop')).toBe('spanish');
      expect(categorizeTag('heavy metal')).toBe('metal');
      expect(categorizeTag('eurodance')).toBe('eurodance');
      expect(categorizeTag('disco')).toBe('disco');
      expect(categorizeTag('trance progresivo')).toBe('trance');
    });

    it('devuelve null para tags desconocidos', () => {
      expect(categorizeTag('reggaetón')).toBeNull();
      expect(categorizeTag('jazz')).toBeNull();
      expect(categorizeTag('clásica')).toBeNull();
      expect(categorizeTag('xxxxxx')).toBeNull();
    });
  });

  describe('expandMacroToTags', () => {
    it('expande un macro a sus tags', () => {
      const tags = expandMacroToTags('house');
      expect(tags).toContain('house');
      expect(tags).toContain('slap house');
      expect(tags).toContain('tropical house');
      expect(tags.length).toBeGreaterThan(10);
    });

    it('synthpop y new wave estan dentro de pop', () => {
      const tags = expandMacroToTags('pop');
      expect(tags).toContain('synthpop');
      expect(tags).toContain('new wave');
    });

    it('country/folk/blues estan dentro de rock', () => {
      const tags = expandMacroToTags('rock');
      expect(tags).toContain('country');
      expect(tags).toContain('folk');
      expect(tags).toContain('blues');
      expect(tags).toContain('country rock');
      expect(tags).toContain('folk rock');
    });
  });

  describe('getMacroById e isValidMacroId', () => {
    it('getMacroById devuelve el macro por id', () => {
      const macro = getMacroById('house');
      expect(macro?.label).toBe('House');
    });

    it('getMacroById devuelve null para id desconocido', () => {
      expect(getMacroById('jazz')).toBeNull();
      expect(getMacroById('xxxx')).toBeNull();
    });

    it('isValidMacroId reconoce los 10 macros', () => {
      for (const m of MACRO_GENRES) {
        expect(isValidMacroId(m.id)).toBe(true);
      }
    });

    it('isValidMacroId rechaza tags de Spotify (que no son macros)', () => {
      expect(isValidMacroId('edm')).toBe(false);
      expect(isValidMacroId('rock clásico')).toBe(false);
    });
  });

  describe('migrateLegacyGenres', () => {
    it('convierte tags Spotify antiguos a macros y deduplica', () => {
      const result = migrateLegacyGenres(['edm', 'rock clásico', 'eurodance']);
      expect(result.sort()).toEqual(['electronic', 'eurodance', 'rock'].sort());
    });

    it('preserva macros validos que ya estaban', () => {
      const result = migrateLegacyGenres(['house', 'rock']);
      expect(result.sort()).toEqual(['house', 'rock'].sort());
    });

    it('descarta tags no clasificables', () => {
      const result = migrateLegacyGenres(['jazz', 'reggaetón', 'xxxx']);
      expect(result).toEqual([]);
    });

    it('mezcla macros y tags antiguos sin duplicar', () => {
      // 'edm' → electronic; 'electronic' ya es macro. Resultado: ['electronic'].
      const result = migrateLegacyGenres(['edm', 'electronic']);
      expect(result).toEqual(['electronic']);
    });
  });
});
