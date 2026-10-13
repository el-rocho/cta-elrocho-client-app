import type { BloodPressureReading } from '../types/bloodPressure';
import type { AppBackupSnapshot } from '../utils/backupService';
import { getSavedServerUrl } from './serverConfigService';
import { isReading } from '../utils/readingGuards';
import { StorageServiceError, getSessionToken, isSettings, type StorageOperation, type StorageServiceErrorKind } from './storageService';

export interface BackupMergeCounts {
  addedCount: number;
  duplicateCount: number;
  conflictCount: number;
}

export interface BackupMergePreview extends BackupMergeCounts {
  previewToken: string;
}

export interface BackupMergeResult extends BackupMergeCounts {
  readings: BloodPressureReading[];
}

function isCounts(value: unknown): value is BackupMergeCounts {
  if (!value || typeof value !== 'object') return false;
  const counts = value as Record<string, unknown>;
  return ['addedCount', 'duplicateCount', 'conflictCount'].every((key) =>
    Number.isSafeInteger(counts[key]) && (counts[key] as number) >= 0);
}

async function postBackup<T>(operation: StorageOperation, path: string, body: unknown, validate: (value: unknown) => value is T): Promise<T> {
  const base = getSavedServerUrl();
  const token = getSessionToken(operation);
  let response: Response;
  try {
    response = await fetch(`${base ? `${base}/api` : '/api'}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-token': token },
      credentials: 'include',
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new StorageServiceError('network', operation, undefined, cause);
  }
  if (!response.ok) {
    // 401 = sesión caducada (revocar). 403 = prohibido (p. ej. falta el token explícito
    // que el servidor exige en import/restaurar): NO es una sesión caducada.
    // 404/405/501 = la ruta de combinación/restauración no existe en este servidor.
    // Como estas rutas son fijas, una respuesta así significa que el servidor es una
    // versión anterior sin estas operaciones; se distingue del genérico 'http' para
    // poder mostrar un aviso accionable ("actualiza el servidor").
    const kind: StorageServiceErrorKind = response.status === 401
      ? 'unauthorized'
      : response.status === 403
        ? 'forbidden'
        : response.status === 404 || response.status === 405 || response.status === 501
          ? 'unsupported-server'
          : 'http';
    throw new StorageServiceError(kind, operation, response.status);
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch (cause) {
    throw new StorageServiceError('invalid-response', operation, response.status, cause);
  }
  if (!validate(data)) throw new StorageServiceError('invalid-response', operation, response.status);
  return data;
}

export function previewBackupMerge(snapshot: AppBackupSnapshot): Promise<BackupMergePreview> {
  return postBackup('preview-backup-merge', '/backups/merge-preview', snapshot, (value): value is BackupMergePreview =>
    isCounts(value) && typeof (value as BackupMergePreview).previewToken === 'string' &&
    (value as BackupMergePreview).previewToken.length > 0);
}

export function restoreBackupMerge(snapshot: AppBackupSnapshot, previewToken: string): Promise<BackupMergeResult> {
  if (!previewToken) return Promise.reject(new Error('Missing backup merge preview token'));
  return postBackup('restore-backup-merge', '/backups/restore-merge', { snapshot, previewToken }, (value): value is BackupMergeResult =>
    isCounts(value) && Array.isArray((value as BackupMergeResult).readings)
    && (value as BackupMergeResult).readings.every(isReading));
}

export interface BackupReplaceResult {
  readings: BloodPressureReading[];
  settings: AppBackupSnapshot['settings'];
}

// Restauración destructiva ("reemplazar"): una única llamada atómica al servidor.
// El servidor valida la copia y solo entonces borra e inserta dentro de una
// transacción, de modo que un fallo nunca deja el historial vacío o a medias.
export function restoreBackupReplace(snapshot: AppBackupSnapshot): Promise<BackupReplaceResult> {
  return postBackup('restore-backup-replace', '/backups/restore-replace', snapshot, (value): value is BackupReplaceResult =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && Array.isArray((value as BackupReplaceResult).readings)
    && (value as BackupReplaceResult).readings.every(isReading)
    && isSettings((value as BackupReplaceResult).settings));
}
