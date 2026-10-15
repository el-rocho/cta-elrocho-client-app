// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import type { BloodPressureReading } from './types/bloodPressure';

vi.mock('./services/storageService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/storageService')>();
  return {
    ...actual,
    fetchReadingsFromServer: vi.fn(),
    addReadingToServer: vi.fn(),
    updateReadingOnServer: vi.fn(),
    updateMedicationContextForAllReadings: vi.fn(),
    deleteReadingFromServer: vi.fn(),
    deleteSessionFromServer: vi.fn(),
    clearAllReadingsOnServer: vi.fn(),
    resetDemoDataOnServer: vi.fn(),
    importReadingsToServer: vi.fn(),
    fetchSettingsFromServer: vi.fn(),
    saveSettingsToServer: vi.fn(),
  };
});
vi.mock('./services/authService', () => ({ getAuthStatus: vi.fn(), logout: vi.fn() }));
vi.mock('./services/serverConfigService', () => ({ getSavedServerUrl: vi.fn(() => 'https://server.test'), testServerConnection: vi.fn() }));
vi.mock('./services/backupMergeService', () => ({ previewBackupMerge: vi.fn(), restoreBackupMerge: vi.fn(), restoreBackupReplace: vi.fn() }));
vi.mock('./components/Header', () => ({ Header: ({ onOpenSettingsModal, onOpenExportModal }: any) => <><button onClick={onOpenSettingsModal}>open settings</button><button onClick={onOpenExportModal}>open export</button></> }));
const readingFormProps = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock('./components/ReadingForm', () => ({
  ReadingForm: (props: any) => {
    readingFormProps.push(props);
    return <><span data-testid="reading-count">{props.readings.length}</span><button onClick={() => props.onAddReading({ systolic: 130, diastolic: 80, heartRate: 70, arm: 'left' })}>add reading</button></>;
  },
}));
vi.mock('./components/TrendChart', () => ({ TrendChart: () => null }));
vi.mock('./components/TrendInsights', () => ({ TrendInsights: () => null }));
vi.mock('./components/ReadingList', () => ({ ReadingList: () => null }));
vi.mock('./components/EditReadingModal', () => ({ EditReadingModal: () => null }));
vi.mock('./components/ExportModal', () => ({ ExportModal: ({ isOpen, settings, onImportReadings, onPreviewBackupMerge, onRestoreBackup, onTriggerManualBackup }: any) => isOpen ? <div data-testid="export-modal"><span data-testid="last-backup">{settings.lastFullBackupTimestamp ?? 'none'}</span><button onClick={onTriggerManualBackup}>create backup</button><button onClick={() => onImportReadings([{ timestamp: '2026-01-02T08:00:00.000Z', systolic: 121, diastolic: 81, heartRate: 71, arm: 'left' }])}>import readings</button><button onClick={() => { void onPreviewBackupMerge({ createdAt: '2026-01-02T00:00:00.000Z', readings: [], settings: {} }).catch(() => {}); }}>preview backup</button><button onClick={() => { void onRestoreBackup({ createdAt: '2026-01-02T00:00:00.000Z', readings: [{ id: 'b1', timestamp: '2026-01-02T08:00:00.000Z', systolic: 121, diastolic: 81, heartRate: 71, arm: 'left' }], settings: {} }, 'replace').catch(() => {}); }}>replace backup</button></div> : null }));
vi.mock('./components/SettingsModal', () => ({ SettingsModal: ({ isOpen, settings, onUpdateSettings, onResetDemoData, onClearAllData }: any) => isOpen ? <div data-testid="settings-modal"><span data-testid="settings-language">{settings.language}</span><button onClick={() => onUpdateSettings({ ...settings, language: 'en' })}>save settings</button><button onClick={onResetDemoData}>reset demo</button><button onClick={onClearAllData}>clear all</button></div> : null }));
vi.mock('./components/LegalNoticeModal', () => ({ LegalNoticeModal: () => null }));
vi.mock('./components/LoginModal', () => ({ LoginModal: () => <div data-testid="login-modal">login</div> }));
vi.mock('./components/TotpSetupModal', () => ({ TotpSetupModal: () => null }));
vi.mock('./components/UserManagementModal', () => ({ UserManagementModal: () => null }));
vi.mock('./components/ServerConfigModal', () => ({ ServerConfigModal: () => null }));

import { App } from './App';
import * as storage from './services/storageService';
import { getAuthStatus, logout } from './services/authService';
import { testServerConnection } from './services/serverConfigService';
import { previewBackupMerge, restoreBackupReplace } from './services/backupMergeService';
import * as backup from './utils/backupService';

const reading: BloodPressureReading = {
  id: 'r1', timestamp: '2026-01-01T08:00:00.000Z', systolic: 120,
  diastolic: 80, heartRate: 70, arm: 'left',
};
let root: Root;
let host: HTMLDivElement;

async function flush() {
  for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve(); });
}

async function renderApp() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<App />));
  await flush();
}

async function click(text: string) {
  const button = [...host.querySelectorAll('button')].find((item) => item.textContent === text);
  expect(button).toBeDefined();
  await act(async () => { button!.click(); await Promise.resolve(); });
  await flush();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'token'), setItem: vi.fn(), removeItem: vi.fn() });
  vi.mocked(testServerConnection).mockResolvedValue({ success: true });
  vi.mocked(getAuthStatus).mockResolvedValue({ hasAdmin: true, userCount: 1, user: { id: 'u1', username: 'user', name: 'User', role: 'user', totp_enabled: false, created_at: '2026-01-01T00:00:00.000Z' } });
  vi.mocked(storage.fetchReadingsFromServer).mockResolvedValue([reading]);
  vi.mocked(storage.fetchSettingsFromServer).mockResolvedValue(storage.DEFAULT_SETTINGS);
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
  vi.unstubAllGlobals();
});

describe('App storage error UX', () => {
  it('keeps settings unchanged and reports an error when saving settings fails', async () => {
    vi.mocked(storage.saveSettingsToServer).mockRejectedValue(new storage.StorageServiceError('network', 'save-settings'));
    await renderApp();
    await click('open settings');
    await click('save settings');

    expect(host.querySelector('[data-testid="settings-language"]')!.textContent).toBe('es');
    expect(host.textContent).toContain('Tus cambios no se han aplicado');
  });

  it.each([
    ['reset demo', 'resetDemoDataOnServer'],
    ['clear all', 'clearAllReadingsOnServer'],
  ] as const)('keeps data and the settings modal open when %s fails', async (button, method) => {
    vi.mocked(storage[method]).mockRejectedValue(new storage.StorageServiceError('http', method === 'resetDemoDataOnServer' ? 'reset-demo' : 'clear-readings', 500));
    await renderApp();
    await click('open settings');
    await click(button);

    expect(host.querySelector('[data-testid="settings-modal"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="reading-count"]')!.textContent).toBe('1');
    expect(host.textContent).toContain('Tus cambios no se han aplicado');
    expect(host.textContent).not.toContain('Se han restaurado los datos de ejemplo');
    expect(host.textContent).not.toContain('Se han eliminado todos los datos');
  });

  it('revokes the session coherently on a real 401 (expired session)', async () => {
    vi.mocked(storage.saveSettingsToServer).mockRejectedValue(new storage.StorageServiceError('unauthorized', 'save-settings', 401));
    await renderApp();
    await click('open settings');
    await click('save settings');

    expect(localStorage.removeItem).toHaveBeenCalledWith('cta_session_token');
    expect(logout).toHaveBeenCalled();
    expect(host.querySelector('[data-testid="login-modal"]')).not.toBeNull();
    expect(host.textContent).toContain('sesión ha caducado');
  });

  it('does not log out or add a duplicate generic toast when the explicit restore token is missing', async () => {
    vi.mocked(previewBackupMerge).mockRejectedValue(new storage.StorageServiceError('session-token-required', 'preview-backup-merge'));
    await renderApp();
    await click('open export');
    await click('preview backup');

    expect(localStorage.removeItem).not.toHaveBeenCalledWith('cta_session_token');
    expect(logout).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="login-modal"]')).toBeNull();
    expect(host.textContent).not.toContain('Tus cambios no se han aplicado');
    expect(host.textContent).not.toContain('sesión ha caducado');
  });

  it('resets the reading form of the previous session when the session ends', async () => {
    vi.mocked(storage.saveSettingsToServer).mockRejectedValue(new storage.StorageServiceError('unauthorized', 'save-settings', 401));
    await renderApp();
    const initialToken = readingFormProps.at(-1)?.sessionResetToken;
    expect(typeof initialToken).toBe('number');

    await click('open settings');
    await click('save settings');

    expect(readingFormProps.at(-1)?.sessionResetToken).not.toBe(initialToken);
  });

  it('shows a specific, actionable message when the server lacks the backup restore route (404 / outdated server)', async () => {
    vi.mocked(restoreBackupReplace).mockRejectedValue(new storage.StorageServiceError('unsupported-server', 'restore-backup-replace', 404));
    await renderApp();
    await click('open export');
    await click('replace backup');

    // The active session is still valid; only the endpoint is missing.
    expect(localStorage.removeItem).not.toHaveBeenCalledWith('cta_session_token');
    expect(logout).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="login-modal"]')).toBeNull();
    // Specific and actionable: tells the user to update the self-hosted server.
    expect(host.textContent).toContain('no admite esta operación');
    expect(host.textContent).toContain('Actualiza el servidor');
    // Never the generic fallback.
    expect(host.textContent).not.toContain('Tus cambios no se han aplicado');
  });

  it('replaces through the single atomic endpoint and does not report success when it fails', async () => {
    vi.mocked(restoreBackupReplace).mockRejectedValue(new storage.StorageServiceError('http', 'restore-backup-replace', 500));
    await renderApp();
    await click('open export');
    await click('replace backup');

    // The previous readings are untouched and nothing destructive ran against the current history.
    expect(host.querySelector('[data-testid="reading-count"]')!.textContent).toBe('1');
    expect(storage.clearAllReadingsOnServer).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Tus cambios no se han aplicado');
    expect(host.textContent).not.toContain('Restauradas');
  });

  it('applies an atomic replacement to the local state only when the server confirms it', async () => {
    vi.mocked(restoreBackupReplace).mockResolvedValue({
      readings: [
        { id: 'b1', timestamp: '2026-01-02T08:00:00.000Z', systolic: 121, diastolic: 81, heartRate: 71, arm: 'left', notes: null },
        { id: 'b2', timestamp: '2026-01-03T08:00:00.000Z', systolic: 119, diastolic: 79, heartRate: 69, arm: 'right' },
      ],
      settings: { ...storage.DEFAULT_SETTINGS, language: 'en' },
    });
    await renderApp();
    await click('open export');
    await click('replace backup');

    expect(restoreBackupReplace).toHaveBeenCalledOnce();
    expect(host.querySelector('[data-testid="reading-count"]')!.textContent).toBe('2');
    expect(host.textContent).not.toContain('Tus cambios no se han aplicado');
  });

  it('persists and displays the confirmed backup timestamp without showing a second success toast', async () => {
    vi.spyOn(backup, 'saveBackup').mockResolvedValue({ mode: 'web', filename: 'copy.json', saved: true });
    vi.mocked(storage.saveSettingsToServer).mockResolvedValue();
    await renderApp();
    await click('open export');
    await click('create backup');

    expect(host.textContent).toContain('Confirmar copia guardada');
    await click('Confirmar copia guardada');

    expect(storage.saveSettingsToServer).toHaveBeenCalledOnce();
    const persisted = vi.mocked(storage.saveSettingsToServer).mock.calls[0][0];
    expect(persisted.lastBackupTimestamp).toBeTruthy();
    expect(persisted.lastFullBackupTimestamp).toBe(persisted.lastBackupTimestamp);
    expect(host.querySelector('[data-testid="last-backup"]')!.textContent).toBe(persisted.lastFullBackupTimestamp);
    expect(host.textContent).not.toContain('Copia confirmada. Se ha actualizado la fecha del recordatorio.');
  });

  it('finishes loading with an error instead of treating a failed fetch as empty data', async () => {
    vi.mocked(storage.fetchReadingsFromServer).mockRejectedValue(new storage.StorageServiceError('network', 'fetch-readings'));
    await renderApp();

    expect(host.textContent).not.toContain('Conectando con servidor local');
    expect(host.textContent).toContain('Tus cambios no se han aplicado');
  });
});
