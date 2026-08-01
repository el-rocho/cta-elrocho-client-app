import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthStatus, listUsers } from './authService';
import { fetchReadingsFromServer, fetchSettingsFromServer } from './storageService';

const SERVER_URL = 'https://server.test';
const jsonResponse = (data: unknown) => ({
  ok: true,
  json: vi.fn().mockResolvedValue(data),
});

describe('consultas autenticadas sin caché', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => key === 'cta_server_url' ? SERVER_URL : 'session-test'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it('solicita mediciones y ajustes directamente al servidor', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    await fetchReadingsFromServer();
    await fetchSettingsFromServer();

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringMatching(/^https:\/\/server\.test\/api\/readings\?fresh=/), expect.objectContaining({ cache: 'no-store' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringMatching(/^https:\/\/server\.test\/api\/settings\?fresh=/), expect.objectContaining({ cache: 'no-store' }));
  });

  it('solicita el estado y la lista de usuarios sin reutilizar respuestas', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ hasAdmin: true, userCount: 1, user: null }))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await getAuthStatus();
    await listUsers();

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringMatching(/^https:\/\/server\.test\/api\/auth\/status\?fresh=/), expect.objectContaining({ cache: 'no-store' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringMatching(/^https:\/\/server\.test\/api\/users\?fresh=/), expect.objectContaining({ cache: 'no-store' }));
  });
});
