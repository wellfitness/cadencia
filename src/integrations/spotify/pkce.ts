/**
 * PKCE helpers para Spotify OAuth (RFC 7636).
 *
 * Por que PKCE en lugar de Authorization Code clasico:
 *  - Una app cliente-only NO puede guardar un client_secret de forma segura
 *    (cualquiera puede inspeccionar el bundle JS).
 *  - PKCE sustituye el secret por un par code_verifier/code_challenge
 *    generado en el momento del flow. El servidor verifica que el code_verifier
 *    coincida con el challenge enviado al inicio.
 */

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CHARSET[bytes[i]! % CHARSET.length];
  }
  return out;
}

/**
 * code_verifier: cadena de 43-128 caracteres del charset PKCE
 * (ALPHA / DIGIT / "-" / "." / "_" / "~"). Usamos 64 alfanumericos
 * (entropia mas que suficiente, simplifica el charset).
 */
export function generateCodeVerifier(): string {
  return randomString(64);
}

/**
 * code_challenge = base64url( SHA256( code_verifier ) ).
 * Spotify exige el metodo "S256" (no soporta el plain).
 */
export async function computeCodeChallenge(codeVerifier: string): Promise<string> {
  const data = new TextEncoder().encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

/**
 * state: token aleatorio anti-CSRF que enviamos a Spotify y debemos recibir
 * de vuelta inalterado en el callback. Si no coincide, abortamos el flow.
 */
export function generateState(): string {
  return randomString(32);
}

function base64UrlEncode(bytes: Uint8Array): string {
  // btoa necesita una string binaria. Construirla a mano evita problemas con
  // caracteres no-Latin1.
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // base64 estandar -> base64url (sin padding, sin +/, con -_)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
