import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackupSnapshot } from '../utils/backupService';
import { DEFAULT_SETTINGS } from './storageService';
import { previewBackupMerge, restoreBackupMerge } from './backupMergeService';

const snapshot = createBackupSnapshot([{
  id: 'backup-1', timestamp: '2026-01-01T08:00:00.000Z', systolic: 120,
  diastolic: 80, heartRate: 70, arm: 'left',
}], DEFAULT_SETTINGS, '2026-01-02T10:00:00.000Z');

afterEach(() => { vi.unstubAllGlobals(); });

describe('server-backed backup merge', () => {
  it('previews without changing readings or settings and returns the server token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      addedCount: 1, duplicateCount: 2, conflictCount: 3, previewToken: 'opaque-token',
    }) });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'cta_session_token' ? 'session-123' : null });
    const result = await previewBackupMerge(snapshot);
    expect(result).toEqual({ addedCount: 1, duplicateCount: 2, conflictCount: 3, previewToken: 'opaque-token' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('/api/backups/merge-preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-token': 'session-123' },
      credentials: 'include', body: JSON.stringify(snapshot),
    });
  });

  it('commits only with the preview token and returns authoritative counts and readings', async () => {
    const response = { addedCount: 1, duplicateCount: 2, conflictCount: 3, readings: snapshot.readings };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(await restoreBackupMerge(snapshot, 'opaque-token')).toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith('/api/backups/restore-merge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ snapshot, previewToken: 'opaque-token' }),
    });
  });

  it('rejects a stale token/server failure without fallback writes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 409 });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { getItem: () => null });
    await expect(restoreBackupMerge(snapshot, 'expired')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
