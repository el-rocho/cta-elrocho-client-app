import type { BloodPressureReading, AppSettings } from '../types/bloodPressure';
import { getSavedServerUrl } from './serverConfigService';
import { isObject, isReading, isReadings } from '../utils/readingGuards';

let freshRequestSequence = 0;

function freshApiUrl(path: string): string {
  freshRequestSequence += 1;
  return `${path}?fresh=${Date.now()}-${freshRequestSequence}`;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'es',
  enableWhiteCoatFilter: false,
  whiteCoatIntervalMinutes: 5, // Valor fijo; se conserva en datos serializados por compatibilidad
  defaultArm: 'left',
  preferredInputMode: 'keyboard',
  guidelineProfile: 'esc-2024',
  showInformationalLabels: false,
  treatmentTargetMode: 'guideline',
  customTargetSystolicMin: 120,
  customTargetSystolicMax: 129,
  customTargetDiastolicMin: 70,
  customTargetDiastolicMax: 79,
  patientName: '',
  patientSex: '',
  patientAge: '',
  takesAntihypertensiveMedication: false,
  backupFrequency: 'disabled',
  backupFolder: 'Descargas/Copias_Tension_Arterial',
  lastBackupTimestamp: undefined,
  lastFullBackupTimestamp: undefined,
};

export type StorageServiceErrorKind = 'network' | 'unauthorized' | 'forbidden' | 'http' | 'invalid-response' | 'unsupported-server';
export type StorageOperation =
  | 'fetch-readings'
  | 'add-reading'
  | 'update-reading'
  | 'update-medication-context'
  | 'delete-reading'
  | 'delete-session'
  | 'clear-readings'
  | 'reset-demo'
  | 'import-readings'
  | 'fetch-settings'
  | 'save-settings'
  | 'preview-backup-merge'
  | 'restore-backup-merge'
  | 'restore-backup-replace';

export class StorageServiceError extends Error {
  readonly kind: StorageServiceErrorKind;
  readonly operation: StorageOperation;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(kind: StorageServiceErrorKind, operation: StorageOperation, status?: number, cause?: unknown) {
    super(`Storage operation ${operation} failed (${kind}${status ? ` ${status}` : ''})`);
    this.name = 'StorageServiceError';
    this.kind = kind;
    this.operation = operation;
    this.status = status;
    this.cause = cause;
  }
}

function getApiBase(): string {
  const serverUrl = getSavedServerUrl();
  return serverUrl ? `${serverUrl}/api` : '/api';
}

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  const token = localStorage.getItem('cta_session_token');
  if (token) headers['x-session-token'] = token;
  return headers;
}

export function isSettings(value: unknown): value is AppSettings {
  if (!isObject(value)) return false;
  const candidate = { ...DEFAULT_SETTINGS, ...value } as AppSettings;
  return (candidate.language === 'es' || candidate.language === 'en')
    && typeof candidate.enableWhiteCoatFilter === 'boolean'
    && (candidate.defaultArm === 'left' || candidate.defaultArm === 'right')
    && (candidate.preferredInputMode === 'keyboard' || candidate.preferredInputMode === 'wheel')
    && ['esc-2024', 'aha-acc-2025', 'ish-2020'].includes(candidate.guidelineProfile)
    && typeof candidate.showInformationalLabels === 'boolean'
    && (candidate.treatmentTargetMode === 'guideline' || candidate.treatmentTargetMode === 'custom')
    && [candidate.customTargetSystolicMin, candidate.customTargetSystolicMax, candidate.customTargetDiastolicMin, candidate.customTargetDiastolicMax].every(Number.isFinite)
    && typeof candidate.takesAntihypertensiveMedication === 'boolean'
    && ['disabled', 'daily', 'weekly', 'monthly'].includes(candidate.backupFrequency)
    && candidate.whiteCoatIntervalMinutes === 5
    && typeof candidate.backupFolder === 'string'
    && (candidate.patientName === undefined || typeof candidate.patientName === 'string')
    && (candidate.patientSex === undefined || candidate.patientSex === '' || candidate.patientSex === 'masculino' || candidate.patientSex === 'femenino')
    && (candidate.patientAge === undefined || candidate.patientAge === '' || (typeof candidate.patientAge === 'number' && Number.isFinite(candidate.patientAge)))
    && (candidate.patientBirthDate === undefined || typeof candidate.patientBirthDate === 'string')
    && (candidate.lastBackupTimestamp === undefined || typeof candidate.lastBackupTimestamp === 'string')
    && (candidate.lastFullBackupTimestamp === undefined || typeof candidate.lastFullBackupTimestamp === 'string');
}

async function request(operation: StorageOperation, path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (cause) {
    throw new StorageServiceError('network', operation, undefined, cause);
  }
  if (!response.ok) {
    // 401 = sesión revocada/caducada (hay que volver al acceso).
    // 403 = prohibido (p. ej. falta el token explícito en import/restaurar, o permisos);
    // NO implica que la sesión haya caducado, así que nunca debe provocar un cierre de sesión.
    const kind: StorageServiceErrorKind = response.status === 401
      ? 'unauthorized'
      : response.status === 403
        ? 'forbidden'
        : 'http';
    throw new StorageServiceError(kind, operation, response.status);
  }
  return response;
}

async function requestJson<T>(
  operation: StorageOperation,
  path: string,
  init: RequestInit | undefined,
  validate: (value: unknown) => value is T
): Promise<T> {
  const response = await request(operation, path, init);
  let data: unknown;
  try {
    data = await response.json();
  } catch (cause) {
    throw new StorageServiceError('invalid-response', operation, response.status, cause);
  }
  if (!validate(data)) throw new StorageServiceError('invalid-response', operation, response.status);
  return data;
}

export function fetchReadingsFromServer(): Promise<BloodPressureReading[]> {
  const apiBase = getApiBase();
  return requestJson('fetch-readings', freshApiUrl(`${apiBase}/readings`), {
    headers: getAuthHeaders(), credentials: 'include', cache: 'no-store',
  }, isReadings);
}

export function addReadingToServer(newReading: Omit<BloodPressureReading, 'id'>): Promise<BloodPressureReading> {
  const apiBase = getApiBase();
  return requestJson('add-reading', `${apiBase}/readings`, {
    method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include', body: JSON.stringify(newReading),
  }, isReading);
}

export async function updateReadingOnServer(updatedReading: BloodPressureReading): Promise<void> {
  const apiBase = getApiBase();
  await request('update-reading', `${apiBase}/readings/${updatedReading.id}`, {
    method: 'PUT', headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include', body: JSON.stringify(updatedReading),
  });
}

export async function updateMedicationContextForAllReadings(takesAntihypertensiveMedication: boolean): Promise<void> {
  const apiBase = getApiBase();
  await request('update-medication-context', `${apiBase}/readings/medication-context`, {
    method: 'PUT', headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include', body: JSON.stringify({ takesAntihypertensiveMedication }),
  });
}

export async function deleteReadingFromServer(id: string): Promise<void> {
  const apiBase = getApiBase();
  await request('delete-reading', `${apiBase}/readings/${id}`, {
    method: 'DELETE', headers: getAuthHeaders(), credentials: 'include',
  });
}

export async function deleteSessionFromServer(readingIds: string[]): Promise<void> {
  const apiBase = getApiBase();
  await request('delete-session', `${apiBase}/sessions/delete`, {
    method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include', body: JSON.stringify({ readingIds }),
  });
}

export async function clearAllReadingsOnServer(): Promise<void> {
  const apiBase = getApiBase();
  await request('clear-readings', `${apiBase}/readings/all/confirm`, {
    method: 'DELETE', headers: getAuthHeaders(), credentials: 'include',
  });
}

export function resetDemoDataOnServer(): Promise<BloodPressureReading[]> {
  const apiBase = getApiBase();
  return requestJson('reset-demo', `${apiBase}/readings/reset-demo`, {
    method: 'POST', headers: getAuthHeaders(), credentials: 'include',
  }, isReadings);
}

interface ImportResult { addedCount: number; readings: BloodPressureReading[] }
function isImportResult(value: unknown): value is ImportResult {
  return isObject(value)
    && Number.isSafeInteger(value.addedCount)
    && (value.addedCount as number) >= 0
    && isReadings(value.readings);
}

export function importReadingsToServer(imported: Omit<BloodPressureReading, 'id'>[]): Promise<ImportResult> {
  const apiBase = getApiBase();
  return requestJson('import-readings', `${apiBase}/readings/import`, {
    method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include', body: JSON.stringify(imported),
  }, isImportResult);
}

export async function fetchSettingsFromServer(): Promise<AppSettings> {
  const apiBase = getApiBase();
  const data = await requestJson('fetch-settings', freshApiUrl(`${apiBase}/settings`), {
    headers: getAuthHeaders(), credentials: 'include', cache: 'no-store',
  }, isSettings);
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    showInformationalLabels: typeof data.showInformationalLabels === 'boolean' ? data.showInformationalLabels : true,
  };
}

export async function saveSettingsToServer(settings: AppSettings): Promise<void> {
  const apiBase = getApiBase();
  await request('save-settings', `${apiBase}/settings`, {
    method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include', body: JSON.stringify(settings),
  });
}
