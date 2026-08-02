import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getServerUrlCandidates,
  saveServerUrl,
  testServerConnection,
} from './serverConfigService';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('configuración flexible del servidor', () => {
  it('respeta las direcciones completas HTTP y HTTPS', () => {
    expect(getServerUrlCandidates('https://cta.example.org/')).toEqual(['https://cta.example.org']);
    expect(getServerUrlCandidates('http://192.168.1.50:3000/')).toEqual(['http://192.168.1.50:3000']);
  });

  it('prueba HTTPS primero para dominios y HTTP primero para direcciones locales', () => {
    expect(getServerUrlCandidates('cta.example.org')).toEqual([
      'https://cta.example.org',
      'http://cta.example.org',
    ]);
    expect(getServerUrlCandidates('192.168.1.50:3000')).toEqual([
      'http://192.168.1.50:3000',
      'https://192.168.1.50:3000',
    ]);
  });

  it('conserva la dirección que haya respondido correctamente', async () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem,
      removeItem: vi.fn(),
    });
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('HTTPS unavailable'))
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ hasAdmin: true, userCount: 1 }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await testServerConnection('cta.example.org');
    expect(result.success).toBe(true);
    expect(result.url).toBe('http://cta.example.org');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://cta.example.org/api/auth/status',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://cta.example.org/api/auth/status',
      expect.objectContaining({ cache: 'no-store' }),
    );

    expect(saveServerUrl(result.url || '')).toBe('http://cta.example.org');
    expect(setItem).toHaveBeenCalledWith('cta_server_url', 'http://cta.example.org');
  });
});
