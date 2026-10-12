import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackupSnapshot } from '../utils/backupService';
import { DEFAULT_SETTINGS } from './storageService';
import { previewBackupMerge, restoreBackupMerge, restoreBackupReplace } from './backupMergeService';

const snapshot = createBackupSnapshot([{
  id: 'backup-1', timestamp: '2026-01-01T08:00:00.000Z', systolic: 120,
  diastolic: 80, heartRate: 70, arm: 'left',
}], DEFAULT_SETTINGS, '2026-01-02T10:00:00.000Z');

afterEach(() => { vi.unstubAllGlobals(); });

describe('server-backed backup merge', () => {
  it('requires the explicit session token before previewing and never sends a doomed request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { getItem: () => null });

    await expect(previewBackupMerge(snapshot)).rejects.toMatchObject({
      kind: 'session-token-required', operation: 'preview-backup-merge',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

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

  it('requires the explicit session token before committing a merge and never sends a doomed request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { getItem: () => null });

    await expect(restoreBackupMerge(snapshot, 'opaque-token')).rejects.toMatchObject({
      kind: 'session-token-required', operation: 'restore-backup-merge',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('commits only with the preview token and returns authoritative counts and readings', async () => {
    const response = { addedCount: 1, duplicateCount: 2, conflictCount: 3, readings: snapshot.readings };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'cta_session_token' ? 'session-123' : null });
    expect(await restoreBackupMerge(snapshot, 'opaque-token')).toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith('/api/backups/restore-merge', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-token': 'session-123' }, credentials: 'include',
      body: JSON.stringify({ snapshot, previewToken: 'opaque-token' }),
    });
  });

  it('accepts merge result readings whose notes are null (as the real server returns)', async () => {
    const response = {
      addedCount: 1, duplicateCount: 0, conflictCount: 0,
      readings: [{ id: 'r1', timestamp: '2026-01-01T08:00:00.000Z', systolic: 118, diastolic: 76, heartRate: 68, arm: 'left', notes: null }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => response }));
    vi.stubGlobal('localStorage', { getItem: () => 'session' });

    await expect(restoreBackupMerge(snapshot, 'token')).resolves.toEqual(response);
  });

  it('rejects a stale token/server failure without fallback writes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 409 });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { getItem: () => 'session' });
    await expect(restoreBackupMerge(snapshot, 'expired')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('maps a 401 to an expired session but a 403 to forbidden, not a logout', async () => {
    vi.stubGlobal('localStorage', { getItem: () => 'session' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(previewBackupMerge(snapshot)).rejects.toMatchObject({
      name: 'StorageServiceError', kind: 'unauthorized', status: 401, operation: 'preview-backup-merge',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const error = await previewBackupMerge(snapshot).catch((caught) => caught);
    expect(error).toMatchObject({ name: 'StorageServiceError', kind: 'forbidden', status: 403, operation: 'preview-backup-merge' });
    expect(error.kind).not.toBe('unauthorized');
  });

  it('rejects a merge result with malformed readings', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ addedCount: 1, duplicateCount: 0, conflictCount: 0, readings: [{ id: 'bad' }] }),
    }));
    vi.stubGlobal('localStorage', { getItem: () => 'session' });

    await expect(restoreBackupMerge(snapshot, 'token')).rejects.toMatchObject({
      kind: 'invalid-response', operation: 'restore-backup-merge',
    });
  });
});

describe('atomic backup replacement', () => {
  it('requires the explicit session token before replacing and never sends a doomed request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { getItem: () => null });

    await expect(restoreBackupReplace(snapshot)).rejects.toMatchObject({
      kind: 'session-token-required', operation: 'restore-backup-replace',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the whole snapshot to the single atomic replace endpoint with the explicit token', async () => {
    const response = { readings: [{ ...snapshot.readings[0], notes: null }], settings: DEFAULT_SETTINGS };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => response });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'cta_session_token' ? 'session-123' : null });

    await expect(restoreBackupReplace(snapshot)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('/api/backups/restore-replace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-token': 'session-123' },
      credentials: 'include',
      body: JSON.stringify(snapshot),
    });
  });

  it('rejects a server-side 403 as forbidden when an explicit token was sent', async () => {
    vi.stubGlobal('localStorage', { getItem: () => 'session' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    await expect(restoreBackupReplace(snapshot)).rejects.toMatchObject({
      kind: 'forbidden', status: 403, operation: 'restore-backup-replace',
    });
  });

  it('rejects a malformed replacement payload instead of reporting success', async () => {
    vi.stubGlobal('localStorage', { getItem: () => 'session' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ readings: snapshot.readings, settings: { language: 'de' } }),
    }));

    await expect(restoreBackupReplace(snapshot)).rejects.toMatchObject({
      kind: 'invalid-response', operation: 'restore-backup-replace',
    });
  });
});

describe('outdated / incompatible server (missing backup routes)', () => {
  it.each([
    ['preview-backup-merge', () => previewBackupMerge(snapshot)],
    ['restore-backup-merge', () => restoreBackupMerge(snapshot, 'token')],
    ['restore-backup-replace', () => restoreBackupReplace(snapshot)],
  ] as const)('maps a 404 on %s to an actionable unsupported-server error, not a generic http one', async (operation, call) => {
    vi.stubGlobal('localStorage', { getItem: () => 'session' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(call()).rejects.toMatchObject({
      name: 'StorageServiceError', kind: 'unsupported-server', status: 404, operation,
    });
  });

  it('maps a 405 (route present, method not allowed) to unsupported-server as well', async () => {
    vi.stubGlobal('localStorage', { getItem: () => 'session' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 405 }));

    await expect(restoreBackupReplace(snapshot)).rejects.toMatchObject({ kind: 'unsupported-server' });
  });

  it('still maps 500/409 to a generic http failure, not the outdated-server signal', async () => {
    vi.stubGlobal('localStorage', { getItem: () => 'session' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const error = await restoreBackupReplace(snapshot).catch((caught) => caught);
    expect(error).toMatchObject({ kind: 'http', status: 500, operation: 'restore-backup-replace' });
    expect(error.kind).not.toBe('unsupported-server');
  });
});

describe('non-JSON responses', () => {
  it.each([
    ['preview-backup-merge', () => previewBackupMerge(snapshot)],
    ['restore-backup-replace', () => restoreBackupReplace(snapshot)],
  ] as const)('reports a 200 on %s with a non-JSON body as invalid-response instead of crashing', async (operation, call) => {
    vi.stubGlobal('localStorage', { getItem: () => 'session' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0'); },
    }));

    await expect(call()).rejects.toMatchObject({ kind: 'invalid-response', operation });
  });
});
