import { describe, it, expect } from 'vitest';
import type { SessionBlock } from '@core/segmentation';
import {
  COMPLETION_ANNOUNCEMENT,
  buildPhaseAnnouncement,
  formatRpeForTTS,
  humanizeDuration,
} from './ttsMessages';
import { getZoneFeeling } from '@core/physiology';

function block(overrides: Partial<SessionBlock>): SessionBlock {
  return {
    id: 'b1',
    phase: 'work',
    zone: 4,
    cadenceProfile: 'flat',
    durationSec: 240,
    ...overrides,
  };
}

describe('humanizeDuration', () => {
  it('lee segundos cuando duracion < 60', () => {
    expect(humanizeDuration(30)).toBe('30 segundos');
    expect(humanizeDuration(45)).toBe('45 segundos');
    expect(humanizeDuration(0)).toBe('0 segundos');
  });

  it('singular vs plural en minutos', () => {
    expect(humanizeDuration(60)).toBe('1 minuto');
    expect(humanizeDuration(120)).toBe('2 minutos');
    expect(humanizeDuration(240)).toBe('4 minutos');
  });

  it('mezcla minutos y segundos cuando hay resto', () => {
    expect(humanizeDuration(90)).toBe('1 minuto y 30 segundos');
    expect(humanizeDuration(210)).toBe('3 minutos y 30 segundos');
    expect(humanizeDuration(75)).toBe('1 minuto y 15 segundos');
  });

  it('redondea segundos no enteros', () => {
    expect(humanizeDuration(30.4)).toBe('30 segundos');
    expect(humanizeDuration(30.6)).toBe('31 segundos');
  });

  it('clampa duraciones negativas a 0', () => {
    expect(humanizeDuration(-5)).toBe('0 segundos');
  });
});

describe('formatRpeForTTS', () => {
  it('rango con "a" en vez de guion para que el TTS lo lea natural', () => {
    expect(formatRpeForTTS(getZoneFeeling(1))).toBe('RPE 2 a 3'); // Z1 = 2-3
    expect(formatRpeForTTS(getZoneFeeling(5))).toBe('RPE 8 a 9'); // Z5 = 8-9
  });

  it('valor singular cuando rpeMin === rpeMax', () => {
    expect(formatRpeForTTS(getZoneFeeling(4))).toBe('RPE 7'); // Z4 = 7
    expect(formatRpeForTTS(getZoneFeeling(6))).toBe('RPE 10'); // Z6 = 10
  });
});

describe('buildPhaseAnnouncement — bike', () => {
  it('plantilla estandar para work en Z4', () => {
    const msg = buildPhaseAnnouncement(
      block({ phase: 'work', zone: 4, durationSec: 240, cadenceProfile: 'flat' }),
      'bike',
    );
    // Formato: "Zona 4, umbral, {cadencia} rpm, 4 minutos. RPE 7."
    expect(msg).toContain('Zona 4');
    expect(msg).toContain('umbral');
    expect(msg).toContain('rpm');
    expect(msg).toContain('4 minutos');
    expect(msg).toContain('RPE 7');
  });

  it('plantilla calentamiento usa el adjetivo "Calentamiento"', () => {
    const msg = buildPhaseAnnouncement(
      block({ phase: 'warmup', zone: 1, durationSec: 300, cadenceProfile: 'flat' }),
      'bike',
    );
    expect(msg).toMatch(/^Calentamiento\./);
    expect(msg).toContain('Zona 1');
    expect(msg).toContain('5 minutos');
    // No incluye RPE en plantillas especiales para no abrumar.
    expect(msg).not.toContain('RPE');
  });

  it('plantilla cooldown usa "Vuelta a la calma"', () => {
    const msg = buildPhaseAnnouncement(
      block({ phase: 'cooldown', zone: 1, durationSec: 300, cadenceProfile: 'flat' }),
      'bike',
    );
    expect(msg).toMatch(/^Vuelta a la calma\./);
  });

  it('plantilla rest es minima — solo duracion', () => {
    const msg = buildPhaseAnnouncement(
      block({ phase: 'rest', zone: 1, durationSec: 30, cadenceProfile: 'flat' }),
      'bike',
    );
    expect(msg).toBe('Descanso. 30 segundos.');
  });

  it('plantilla recovery menciona zona y cadencia', () => {
    const msg = buildPhaseAnnouncement(
      block({ phase: 'recovery', zone: 1, durationSec: 60, cadenceProfile: 'flat' }),
      'bike',
    );
    expect(msg).toMatch(/^Recuperación\./);
    expect(msg).toContain('Zona 1');
    expect(msg).toContain('1 minuto');
  });

  it('en sprint Z6 usa rpm con cadencia alta', () => {
    const msg = buildPhaseAnnouncement(
      block({ phase: 'work', zone: 6, durationSec: 30, cadenceProfile: 'sprint' }),
      'bike',
    );
    expect(msg).toContain('Zona 6');
    expect(msg).toContain('máximo');
    expect(msg).toContain('rpm');
    expect(msg).toContain('30 segundos');
  });
});

describe('buildPhaseAnnouncement — run', () => {
  it('usa spm en lugar de rpm para running', () => {
    const msg = buildPhaseAnnouncement(
      block({ phase: 'work', zone: 4, durationSec: 180, cadenceProfile: 'flat' }),
      'run',
    );
    expect(msg).toContain('spm');
    expect(msg).not.toContain('rpm');
  });

  it('mantiene la sensacion simplificada igual que en bike', () => {
    const msg = buildPhaseAnnouncement(
      block({ phase: 'work', zone: 5, durationSec: 60, cadenceProfile: 'flat' }),
      'run',
    );
    expect(msg).toContain('Zona 5');
    expect(msg).toContain('muy duro');
    expect(msg).toContain('1 minuto');
    expect(msg).toContain('RPE 8 a 9');
  });

  it('plantilla rest no depende del deporte (no menciona cadencia)', () => {
    const msg = buildPhaseAnnouncement(
      block({ phase: 'rest', zone: 1, durationSec: 30, cadenceProfile: 'flat' }),
      'run',
    );
    expect(msg).toBe('Descanso. 30 segundos.');
    expect(msg).not.toMatch(/spm|rpm/);
  });
});

describe('COMPLETION_ANNOUNCEMENT', () => {
  it('es un mensaje corto y cerrado', () => {
    expect(COMPLETION_ANNOUNCEMENT).toBe('Sesión completada.');
  });
});

describe('cobertura de sensaciones simplificadas', () => {
  // Verifica que las 6 zonas tienen plantilla y que la sensacion
  // simplificada esta presente en el output (regresion: si alguien anade
  // Z7 o renombra una zona, el test cazara la falta de mapping).
  const expectedSensations: Record<number, string> = {
    1: 'muy suave',
    2: 'cómodo',
    3: 'moderado',
    4: 'umbral',
    5: 'muy duro',
    6: 'máximo',
  };

  for (const zone of [1, 2, 3, 4, 5, 6] as const) {
    it(`Z${zone} usa "${expectedSensations[zone]}"`, () => {
      const msg = buildPhaseAnnouncement(
        block({ phase: 'work', zone, durationSec: 60, cadenceProfile: 'flat' }),
        'bike',
      );
      expect(msg).toContain(expectedSensations[zone]);
    });
  }
});
