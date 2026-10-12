import { afterEach, describe, expect, it, vi } from 'vitest';
import { login } from './authService';

const user = {
  id: 'user-1',
  username: 'patient',
  name: 'Patient',
  role: 'user' as const,
  totp_enabled: false,
  created_at: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('normal login session token', () => {
  it('stores the explicit session token returned by a successful login', async () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => key === 'cta_server_url' ? 'https://server.test' : null),
      setItem,
      removeItem: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ user, token: 'fresh-session-token' }),
    }));

    await expect(login({ username: 'patient', password: 'secret' })).resolves.toEqual({ success: true, user });
    expect(setItem).toHaveBeenCalledWith('cta_session_token', 'fresh-session-token');
  });
});
