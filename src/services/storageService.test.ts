import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BloodPressureReading } from '../types/bloodPressure';
import {
  StorageServiceError,
  addReadingToServer,
  clearAllReadingsOnServer,
  deleteReadingFromServer,
  deleteSessionFromServer,
  fetchReadingsFromServer,
  fetchSettingsFromServer,
  importReadingsToServer,
  resetDemoDataOnServer,
  saveSettingsToServer,
  updateMedicationContextForAllReadings,
  updateReadingOnServer,
  DEFAULT_SETTINGS,
} from './storageService';

const reading: BloodPressureReading = {
  id: 'reading-1',
  timestamp: '2026-01-01T08:00:00.000Z',
  systolic: 120,
  diastolic: 80,
  heartRate: 70,
  arm: 'left',
};

const response = (data: unknown, init: { ok?: boolean; status?: number } = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  json: vi.fn().mockResolvedValue(data),
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => key === 'cta_server_url' ? 'https://server.test' : 'session-token'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
});

describe('storage service failures', () => {
  it('rejects network failures with a typed error and operation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(fetchReadingsFromServer()).rejects.toMatchObject({
      name: 'StorageServiceError',
      kind: 'network',
      operation: 'fetch-readings',
    });
  });

  it.each([
    ['fetch-readings', () => fetchReadingsFromServer()],
    ['add-reading', () => addReadingToServer(reading)],
    ['update-reading', () => updateReadingOnServer(reading)],
    ['update-medication-context', () => updateMedicationContextForAllReadings(true)],
    ['delete-reading', () => deleteReadingFromServer(reading.id)],
    ['delete-session', () => deleteSessionFromServer([reading.id])],
    ['clear-readings', () => clearAllReadingsOnServer()],
    ['reset-demo', () => resetDemoDataOnServer()],
    ['import-readings', () => importReadingsToServer([reading])],
    ['fetch-settings', () => fetchSettingsFromServer()],
    ['save-settings', () => saveSettingsToServer(DEFAULT_SETTINGS)],
  ])('rejects HTTP failures for %s instead of returning a fabricated success value', async (operation, call) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: 'failed' }, { ok: false, status: 500 })));

    await expect(call()).rejects.toMatchObject({
      name: 'StorageServiceError',
      kind: 'http',
      status: 500,
      operation,
    });
  });

  it('treats a 401 as a revoked/expired session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, { ok: false, status: 401 })));

    await expect(saveSettingsToServer(DEFAULT_SETTINGS)).rejects.toMatchObject({
      kind: 'unauthorized',
      status: 401,
      operation: 'save-settings',
    });
  });

  it('treats a 403 as forbidden — never as an expired session', async () => {
    // El servidor devuelve 403 cuando falta el token explícito que exige en
    // import/restaurar, o por permisos; la sesión puede seguir siendo válida.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: 'Token explícito requerido' }, { ok: false, status: 403 })));

    const error = await saveSettingsToServer(DEFAULT_SETTINGS).catch((caught) => caught);
    expect(error).toMatchObject({ kind: 'forbidden', status: 403, operation: 'save-settings' });
    expect(error.kind).not.toBe('unauthorized');
  });

  it('rejects malformed JSON bodies as invalid responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ addedCount: 0 })));

    await expect(importReadingsToServer([reading])).rejects.toMatchObject({
      kind: 'invalid-response',
      operation: 'import-readings',
    });
  });

  it.each([
    ['fetch-readings', () => fetchReadingsFromServer(), [{ ...reading, timestamp: 'not-a-date' }]],
    ['add-reading', () => addReadingToServer(reading), { ...reading, notes: 42 }],
    ['reset-demo', () => resetDemoDataOnServer(), [{ ...reading, arm: 'middle' }]],
    ['fetch-settings', () => fetchSettingsFromServer(), { patientName: 42 }],
  ])('rejects structurally invalid successful responses for %s', async (operation, call, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body)));

    await expect(call()).rejects.toMatchObject({ kind: 'invalid-response', operation });
  });

  it('exports a usable StorageServiceError type', () => {
    const error = new StorageServiceError('http', 'delete-reading', 503);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ kind: 'http', operation: 'delete-reading', status: 503 });
  });
});

describe('storage service real server contracts', () => {
  it('accepts notes:null returned by the server for readings without a note', async () => {
    const serverReadings = [
      { ...reading, notes: null },
      { ...reading, id: 'reading-2', notes: 'nota', arm: 'right' },
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(serverReadings)));

    await expect(fetchReadingsFromServer()).resolves.toEqual(serverReadings);
  });

  it('accepts notes:null when creating a reading', async () => {
    const created = { ...reading, notes: null };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(created)));

    await expect(addReadingToServer(reading)).resolves.toEqual(created);
  });

  it('sends the explicit session token required by the server on import', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ addedCount: 1, readings: [{ ...reading, notes: null }] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(importReadingsToServer([reading])).resolves.toEqual({ addedCount: 1, readings: [{ ...reading, notes: null }] });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toMatchObject({ 'x-session-token': 'session-token' });
    expect(init.method).toBe('POST');
  });

  it('surfaces the server 403 (missing explicit token) as forbidden, not a logout-triggering 401', async () => {
    // Sin token guardado el servidor responde 403; la sesión por cookie puede ser válida.
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => key === 'cta_server_url' ? 'https://server.test' : null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    const fetchMock = vi.fn().mockResolvedValue(response({ error: 'Token explícito requerido para importar o restaurar' }, { ok: false, status: 403 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(importReadingsToServer([reading])).rejects.toMatchObject({ kind: 'forbidden', status: 403, operation: 'import-readings' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).not.toHaveProperty('x-session-token');
  });
});
