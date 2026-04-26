import { describe, it, expect } from 'vitest';
import { computeCodeChallenge, generateCodeVerifier, generateState } from './pkce';

describe('generateCodeVerifier', () => {
  it('devuelve 64 caracteres', () => {
    expect(generateCodeVerifier()).toHaveLength(64);
  });

  it('solo contiene caracteres del charset PKCE alfanumericos', () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('dos llamadas consecutivas devuelven valores distintos', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });
});

describe('computeCodeChallenge', () => {
  it('vector RFC 7636 Appendix B', async () => {
    // RFC 7636 Appendix B: el verifier "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    // produce el challenge "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = await computeCodeChallenge(verifier);
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('verifier conocido produce challenge determinista', async () => {
    const v = 'a'.repeat(64);
    const c1 = await computeCodeChallenge(v);
    const c2 = await computeCodeChallenge(v);
    expect(c1).toBe(c2);
  });

  it('challenge es base64url sin padding ni + /', async () => {
    const v = generateCodeVerifier();
    const c = await computeCodeChallenge(v);
    expect(c).not.toContain('=');
    expect(c).not.toContain('+');
    expect(c).not.toContain('/');
    expect(c).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('generateState', () => {
  it('devuelve 32 caracteres alfanumericos', () => {
    const s = generateState();
    expect(s).toHaveLength(32);
    expect(s).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('valores distintos entre llamadas', () => {
    expect(generateState()).not.toBe(generateState());
  });
});
