import type { BloodPressureReading } from '../types/bloodPressure';
import type { AppBackupSnapshot } from '../utils/backupService';
import { getSavedServerUrl } from './serverConfigService';

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

async function postBackup<T>(path: string, body: unknown, validate: (value: unknown) => value is T): Promise<T> {
  const base = getSavedServerUrl();
  const token = localStorage.getItem('cta_session_token');
  const response = await fetch(`${base ? `${base}/api` : '/api'}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'x-session-token': token } : {}) },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Backup merge request failed (${response.status})`);
  const data: unknown = await response.json();
  if (!validate(data)) throw new Error('Invalid backup merge response');
  return data;
}

export function previewBackupMerge(snapshot: AppBackupSnapshot): Promise<BackupMergePreview> {
  return postBackup('/backups/merge-preview', snapshot, (value): value is BackupMergePreview =>
    isCounts(value) && typeof (value as BackupMergePreview).previewToken === 'string' &&
    (value as BackupMergePreview).previewToken.length > 0);
}

export function restoreBackupMerge(snapshot: AppBackupSnapshot, previewToken: string): Promise<BackupMergeResult> {
  if (!previewToken) return Promise.reject(new Error('Missing backup merge preview token'));
  return postBackup('/backups/restore-merge', { snapshot, previewToken }, (value): value is BackupMergeResult =>
    isCounts(value) && Array.isArray((value as BackupMergeResult).readings));
}
