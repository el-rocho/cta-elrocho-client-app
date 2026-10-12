import { describe, expect, it } from 'vitest';
import type { BloodPressureReading } from '../types/bloodPressure';
import { isObject, isReading, isReadings } from './readingGuards';

// Fixture derivada del contrato real del servidor (server/restoreBackup.js y
// las consultas de restore/merge): las filas SQLite llegan con `notes: null`,
// los booleanos explícitos y sin `sessionId`.
const serverReading: BloodPressureReading = {
  id: '5f1f0f2e-0000-4000-8000-000000000000',
  timestamp: '2026-01-01T08:00:00.000Z',
  systolic: 120,
  diastolic: 80,
  heartRate: 70,
  arm: 'left',
  notes: null,
  pulsePressureWarningConfirmed: false,
  takesAntihypertensiveMedication: false,
};

describe('shared reading guards (single source of truth)', () => {
  it('accepts a reading exactly as the server returns it (notes: null, explicit booleans, no sessionId)', () => {
    expect(isReading(serverReading)).toBe(true);
  });

  it('accepts notes as undefined or string, and sessionId as an optional string', () => {
    expect(isReading({ ...serverReading, notes: undefined })).toBe(true);
    expect(isReading({ ...serverReading, notes: 'nota' })).toBe(true);
    expect(isReading({ ...serverReading, sessionId: 'session-1' })).toBe(true);
  });

  it.each([
    ['missing id', { ...serverReading, id: '' }],
    ['non-finite timestamp', { ...serverReading, timestamp: 'not-a-date' }],
    ['non-numeric systolic', { ...serverReading, systolic: '120' }],
    ['invalid arm', { ...serverReading, arm: 'middle' }],
    ['notes of the wrong type', { ...serverReading, notes: 42 }],
    ['non-string sessionId', { ...serverReading, sessionId: 7 }],
    ['non-boolean confirmation flag', { ...serverReading, pulsePressureWarningConfirmed: 'yes' }],
    ['non-boolean medication flag', { ...serverReading, takesAntihypertensiveMedication: 1 }],
    ['an array', [serverReading]],
    ['null', null],
  ])('rejects a structurally invalid reading: %s', (_label, value) => {
    expect(isReading(value)).toBe(false);
  });

  it('isReadings validates arrays of readings and rejects non-arrays or mixed content', () => {
    expect(isReadings([serverReading])).toBe(true);
    expect(isReadings([])).toBe(true);
    expect(isReadings([serverReading, { ...serverReading, id: 'r2', notes: 'ok' }])).toBe(true);
    expect(isReadings({})).toBe(false);
    expect(isReadings([serverReading, { id: 'bad' }])).toBe(false);
  });

  it('isObject accepts plain objects only', () => {
    expect(isObject({ a: 1 })).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject([1])).toBe(false);
    expect(isObject('x')).toBe(false);
  });
});
