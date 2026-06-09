import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// jsdom no implementa la API de <dialog>; el ByocTutorialDialog llama a
// showModal()/close() al abrirse. Polyfill minimo para que no reviente.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (): void {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (): void {
    this.open = false;
  };
});

vi.mock('@integrations/spotify', () => ({
  beginSpotifyAuthorization: vi.fn(),
  clearTokens: vi.fn(),
  clearAuthFlow: vi.fn(),
  getSpotifyClientId: vi.fn(() => null),
  loadTokens: vi.fn(() => null),
}));

import { SpotifyConnectCard } from './SpotifyConnectCard';
import {
  beginSpotifyAuthorization,
  getSpotifyClientId,
  loadTokens,
} from '@integrations/spotify';

const mockLoadTokens = vi.mocked(loadTokens);
const mockGetClientId = vi.mocked(getSpotifyClientId);
const mockBegin = vi.mocked(beginSpotifyAuthorization);

describe('SpotifyConnectCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadTokens.mockReturnValue(null);
    mockGetClientId.mockReturnValue(null);
  });

  it('sin sesion muestra el boton para conectar y ningun estado conectado', () => {
    render(<SpotifyConnectCard />);
    expect(screen.getByRole('button', { name: /conectar spotify/i })).toBeInTheDocument();
    expect(screen.queryByText(/conectada/i)).not.toBeInTheDocument();
  });

  it('con sesion muestra el estado conectado', () => {
    mockLoadTokens.mockReturnValue({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAtMs: 9_999_999_999_999,
      scope: 'playlist-modify-private',
    });
    render(<SpotifyConnectCard />);
    expect(screen.getByText(/conectada/i)).toBeInTheDocument();
  });

  it('con Client ID configurado, pulsar conectar arranca el login directamente', () => {
    mockGetClientId.mockReturnValue('mi-client-id');
    render(<SpotifyConnectCard />);
    fireEvent.click(screen.getByRole('button', { name: /conectar spotify/i }));
    expect(mockBegin).toHaveBeenCalledWith('mi-client-id');
  });

  it('sin Client ID, pulsar conectar NO arranca el login (abre el tutorial BYOC)', () => {
    mockGetClientId.mockReturnValue(null);
    render(<SpotifyConnectCard />);
    fireEvent.click(screen.getByRole('button', { name: /conectar spotify/i }));
    expect(mockBegin).not.toHaveBeenCalled();
  });
});
