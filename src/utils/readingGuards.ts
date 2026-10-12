import type { BloodPressureReading } from '../types/bloodPressure';

/**
 * Validadores de mediciones compartidos.
 *
 * Único origen de verdad para la forma de una `BloodPressureReading` recibida
 * del servidor. Lo consumen `storageService` (lecturas, importaciones) y
 * `backupMergeService` (combinar/restaurar copias) para evitar que las dos
 * validaciones deriven con el tiempo.
 *
 * El contrato real (server/restoreBackup.js y las consultas SQLite) devuelve
 * `notes: null` en las tomas sin nota y los booleanos explícitos, sin `sessionId`.
 */

export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isReading(value: unknown): value is BloodPressureReading {
  if (!isObject(value)) return false;
  return typeof value.id === 'string' && value.id.length > 0
    && typeof value.timestamp === 'string' && Number.isFinite(Date.parse(value.timestamp))
    && Number.isFinite(value.systolic)
    && Number.isFinite(value.diastolic)
    && Number.isFinite(value.heartRate)
    && (value.arm === 'left' || value.arm === 'right')
    // El backend real (SQLite) devuelve `null` para tomas sin nota; hay que aceptarlo igual que undefined|string.
    && (value.notes === undefined || value.notes === null || typeof value.notes === 'string')
    && (value.sessionId === undefined || typeof value.sessionId === 'string')
    && (value.pulsePressureWarningConfirmed === undefined || typeof value.pulsePressureWarningConfirmed === 'boolean')
    && (value.takesAntihypertensiveMedication === undefined || typeof value.takesAntihypertensiveMedication === 'boolean');
}

export function isReadings(value: unknown): value is BloodPressureReading[] {
  return Array.isArray(value) && value.every(isReading);
}
