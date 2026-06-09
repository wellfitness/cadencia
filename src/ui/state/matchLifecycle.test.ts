import { describe, it, expect } from 'vitest';
import { decideMatchListAction } from './matchLifecycle';

describe('decideMatchListAction', () => {
  describe('primer render (rehidratacion de sessionStorage)', () => {
    it('con lista rehidratada: la preserva (no recalcula → protege ediciones)', () => {
      // Caso del fix original: tras el reload del OAuth, la lista editada se
      // rehidrata y NO debe regenerarse aunque livePool cambie de referencia.
      expect(
        decideMatchListAction({
          isInitialRun: true,
          signatureChanged: true,
          hasMatchedList: true,
          hasRoute: true,
        }),
      ).toBe('skip');
    });

    it('sin lista pero con ruta: GENERA (invariante ruta ⟹ lista)', () => {
      // Caso de la regresion: si hay ruta pero la lista no vino rehidratada,
      // hay que generarla — si no, Resultado se queda en «Genera la lista antes»
      // para siempre.
      expect(
        decideMatchListAction({
          isInitialRun: true,
          signatureChanged: true,
          hasMatchedList: false,
          hasRoute: true,
        }),
      ).toBe('generate');
    });

    it('sin lista y sin ruta: no hace nada (no hay nada que generar)', () => {
      expect(
        decideMatchListAction({
          isInitialRun: true,
          signatureChanged: true,
          hasMatchedList: false,
          hasRoute: false,
        }),
      ).toBe('skip');
    });
  });

  describe('renders posteriores', () => {
    it('misma firma (cambio de referencia espurio): no toca la lista', () => {
      expect(
        decideMatchListAction({
          isInitialRun: false,
          signatureChanged: false,
          hasMatchedList: true,
          hasRoute: true,
        }),
      ).toBe('skip');
    });

    it('firma distinta con ruta: regenera (otro genero, nueva seed, otra fuente)', () => {
      expect(
        decideMatchListAction({
          isInitialRun: false,
          signatureChanged: true,
          hasMatchedList: true,
          hasRoute: true,
        }),
      ).toBe('generate');
    });

    it('firma distinta sin ruta: limpia la lista (se elimino la ruta)', () => {
      expect(
        decideMatchListAction({
          isInitialRun: false,
          signatureChanged: true,
          hasMatchedList: true,
          hasRoute: false,
        }),
      ).toBe('clear');
    });

    it('firma distinta con ruta y sin lista todavia: genera', () => {
      expect(
        decideMatchListAction({
          isInitialRun: false,
          signatureChanged: true,
          hasMatchedList: false,
          hasRoute: true,
        }),
      ).toBe('generate');
    });
  });
});
