import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BloodPressureReading } from '../types/bloodPressure';
import { createBackupSnapshot, parseBackupContent, serializeBackup, type AppBackupSnapshot } from '../utils/backupService';
import { isReading, isReadings } from '../utils/readingGuards';
import { DEFAULT_SETTINGS, isSettings } from './storageService';
import { restoreBackupMerge, restoreBackupReplace } from './backupMergeService';

// ---------------------------------------------------------------------------
// Fixtures derivadas del contrato real del servidor (server/restoreBackup.js):
//  - POST /api/backups/restore-replace -> { readings, settings }
//  - POST /api/backups/restore-merge   -> { addedCount, duplicateCount, conflictCount, readings }
// Las filas SQLite llegan con `notes: null` en las tomas sin nota, los booleanos
// explícitos (`pulsePressureWarningConfirmed`, `takesAntihypertensiveMedication`)
// y sin `sessionId`.
// ---------------------------------------------------------------------------
const serverReading = (overrides: Partial<BloodPressureReading> = {}): BloodPressureReading => ({
  id: 'c0ffee00-0000-4000-8000-000000000001',
  timestamp: '2026-01-01T08:00:00.000Z',
  systolic: 120,
  diastolic: 80,
  heartRate: 70,
  arm: 'left',
  notes: null,
  pulsePressureWarningConfirmed: false,
  takesAntihypertensiveMedication: false,
  ...overrides,
});

const serverBackupSettings = {
  ...DEFAULT_SETTINGS,
  lastBackupTimestamp: '2026-01-02T10:00:00.000Z',
  lastFullBackupTimestamp: '2026-01-02T10:00:00.000Z',
};

const serverReplaceResponse = {
  readings: [serverReading(), serverReading({ id: 'c0ffee00-0000-4000-8000-000000000002', notes: 'nota', arm: 'right' })],
  settings: serverBackupSettings,
};

const serverMergeResponse = {
  addedCount: 1, duplicateCount: 2, conflictCount: 0, readings: serverReplaceResponse.readings,
};

// Espejo de `validateSnapshot` en server/restoreBackup.js. Es un oráculo local:
// si el cliente llega a serializar una copia que el servidor rechazaría, este
// test falla y avisa de la deriva de contrato antes de desplegar.
function serverWouldAcceptSnapshot(value: unknown): boolean {
  const s = value as Record<string, any>;
  if (!s || s.format !== 'cta-elrocho-backup' || s.version !== 1) return false;
  if (typeof s.createdAt !== 'string' || !Number.isFinite(Date.parse(s.createdAt))) return false;
  if (!Array.isArray(s.readings)) return false;
  const st = s.settings;
  if (!st || typeof st !== 'object' || Array.isArray(st)) return false;
  if (!['es', 'en'].includes(st.language) || typeof st.enableWhiteCoatFilter !== 'boolean') return false;
  if (!['left', 'right'].includes(st.defaultArm) || !['keyboard', 'wheel'].includes(st.preferredInputMode)) return false;
  if (!['esc-2024', 'aha-acc-2025', 'ish-2020'].includes(st.guidelineProfile)) return false;
  if (typeof st.showInformationalLabels !== 'boolean') return false;
  if (!['guideline', 'custom'].includes(st.treatmentTargetMode)) return false;
  if (![st.customTargetSystolicMin, st.customTargetSystolicMax, st.customTargetDiastolicMin, st.customTargetDiastolicMax].every(Number.isFinite)) return false;
  if (typeof st.takesAntihypertensiveMedication !== 'boolean') return false;
  if (!['disabled', 'daily', 'weekly', 'monthly'].includes(st.backupFrequency)) return false;
  if (typeof st.backupFolder !== 'string') return false;
  if (st.patientName != null && typeof st.patientName !== 'string') return false;
  if (st.patientSex != null && !['', 'masculino', 'femenino'].includes(st.patientSex)) return false;
  if (st.patientAge != null && st.patientAge !== '' && !Number.isFinite(st.patientAge)) return false;
  if (st.patientBirthDate != null && typeof st.patientBirthDate !== 'string') return false;
  if ([st.lastBackupTimestamp, st.lastFullBackupTimestamp].some((v) => v != null && (typeof v !== 'string' || !Number.isFinite(Date.parse(v))))) return false;
  for (const r of s.readings) {
    if (!r || typeof r.id !== 'string' || !r.id) return false;
    if (typeof r.timestamp !== 'string' || !Number.isFinite(Date.parse(r.timestamp))) return false;
    if (!Number.isInteger(r.systolic) || r.systolic < 50 || r.systolic > 260) return false;
    if (!Number.isInteger(r.diastolic) || r.diastolic < 30 || r.diastolic > 160 || r.diastolic >= r.systolic) return false;
    if (!Number.isInteger(r.heartRate) || r.heartRate < 30 || r.heartRate > 220) return false;
    if (!['left', 'right'].includes(r.arm)) return false;
    if (r.notes != null && typeof r.notes !== 'string') return false;
    if (r.pulsePressureWarningConfirmed != null && typeof r.pulsePressureWarningConfirmed !== 'boolean') return false;
    if (r.takesAntihypertensiveMedication != null && typeof r.takesAntihypertensiveMedication !== 'boolean') return false;
  }
  return new Set(s.readings.map((r: { id: string }) => r.id)).size === s.readings.length;
}

function stubSession() {
  vi.stubGlobal('localStorage', { getItem: () => 'session', setItem: () => {}, removeItem: () => {} });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('snapshot serialization stays compatible with the real server contract', () => {
  it('serializes a snapshot built from server readings (notes: null) that the server would accept', () => {
    const snapshot: AppBackupSnapshot = createBackupSnapshot(
      serverReplaceResponse.readings, serverReplaceResponse.settings, '2026-01-02T10:00:00.000Z',
    );

    const serialized = serializeBackup(snapshot);
    const parsed = JSON.parse(serialized);

    // notes: null must survive serialization so an exported file round-trips.
    expect(parsed.readings[0].notes).toBeNull();
    expect(serverWouldAcceptSnapshot(parsed)).toBe(true);
  });

  it('uses the shared reading/settings validators on every serialized element', () => {
    const snapshot = createBackupSnapshot(serverReplaceResponse.readings, serverReplaceResponse.settings, '2026-01-02T10:00:00.000Z');
    const parsed = JSON.parse(serializeBackup(snapshot));

    expect(isReadings(parsed.readings)).toBe(true);
    expect(parsed.readings.every((r: unknown) => isReading(r))).toBe(true);
    expect(isSettings(parsed.settings)).toBe(true);
  });

  it('re-imports a backup exported from server-shaped readings (notes: null round-trip)', () => {
    const snapshot = createBackupSnapshot(serverReplaceResponse.readings, serverReplaceResponse.settings, '2026-01-02T10:00:00.000Z');
    const reparsed = parseBackupContent(serializeBackup(snapshot));

    expect(reparsed.status).toBe('valid');
    if (reparsed.status === 'valid') {
      expect(reparsed.snapshot.readings[0].notes).toBeNull();
    }
  });
});

describe('client validators accept the exact server response shapes', () => {
  it('accepts the restore-replace response as the real server returns it', async () => {
    stubSession();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => serverReplaceResponse });
    vi.stubGlobal('fetch', fetchMock);
    const snapshot = createBackupSnapshot(serverReplaceResponse.readings, serverReplaceResponse.settings, '2026-01-02T10:00:00.000Z');

    const result = await restoreBackupReplace(snapshot);
    expect(result.readings[0].notes).toBeNull();
    expect(isSettings(result.settings)).toBe(true);
  });

  it('accepts the restore-merge response as the real server returns it', async () => {
    stubSession();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => serverMergeResponse }));
    const snapshot = createBackupSnapshot(serverReplaceResponse.readings, serverReplaceResponse.settings, '2026-01-02T10:00:00.000Z');

    const result = await restoreBackupMerge(snapshot, 'token');
    expect(result).toEqual(serverMergeResponse);
    expect(isReadings(result.readings)).toBe(true);
  });
});
