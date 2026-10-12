import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { BloodPressureReading, ArmPosition, DateRange, AppSettings, InputMode, AuthUser } from './types/bloodPressure';
import {
  fetchReadingsFromServer,
  addReadingToServer,
  updateReadingOnServer,
  updateMedicationContextForAllReadings,
  deleteReadingFromServer,
  deleteSessionFromServer,
  clearAllReadingsOnServer,
  resetDemoDataOnServer,
  importReadingsToServer,
  fetchSettingsFromServer,
  saveSettingsToServer,
  StorageServiceError,
  DEFAULT_SETTINGS,
} from './services/storageService';
import { getAuthStatus, logout } from './services/authService';
import { getSavedServerUrl, testServerConnection } from './services/serverConfigService';
import { processReadingsIntoSessions } from './utils/whiteCoatAlgorithm';
import { isBackupDue } from './utils/backupScheduler';
import { saveBackup, type AppBackupSnapshot } from './utils/backupService';
import { previewBackupMerge, restoreBackupMerge, restoreBackupReplace } from './services/backupMergeService';
import { Header } from './components/Header';
import { ReadingForm } from './components/ReadingForm';
import { TrendChart } from './components/TrendChart';
import { TrendInsights } from './components/TrendInsights';
import { ReadingList } from './components/ReadingList';
import { EditReadingModal } from './components/EditReadingModal';
import { ExportModal, type ToastNotification } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { LegalNoticeModal } from './components/LegalNoticeModal';
import { LoginModal } from './components/LoginModal';
import { TotpSetupModal } from './components/TotpSetupModal';
import { UserManagementModal } from './components/UserManagementModal';
import { ServerConfigModal } from './components/ServerConfigModal';
import { LanguageProvider } from './i18n/LanguageContext';
import { getTranslation } from './i18n/translations';

export function App() {
  const [serverUrl, setServerUrl] = useState<string>(getSavedServerUrl() || '');
  const [isServerModalOpen, setIsServerModalOpen] = useState<boolean>(!getSavedServerUrl());

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [hasAdmin, setHasAdmin] = useState<boolean>(true);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  const [readings, setReadings] = useState<BloodPressureReading[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isLegalNoticeOpen, setIsLegalNoticeOpen] = useState<boolean>(false);
  const [isTotpModalOpen, setIsTotpModalOpen] = useState<boolean>(false);
  const [isUserMgmtModalOpen, setIsUserMgmtModalOpen] = useState<boolean>(false);

  const [dateRange, setDateRange] = useState<DateRange>({ preset: '1month' });
  const [readingToEdit, setReadingToEdit] = useState<BloodPressureReading | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | ToastNotification | null>(null);
  const backupReminderKeyRef = useRef<string | null>(null);
  const dataLoadVersionRef = useRef(0);

  const showStorageError = useCallback((error: unknown) => {
    // Solo un 401 real (sesión caducada/revocada) revoca la sesión. Un 403
    // (p. ej. petición de import/restaurar sin token explícito) NO es una sesión
    // caducada y nunca debe provocar un cierre de sesión falso. Un 404/405 en las
    // rutas de copias significa un servidor desactualizado: tampoco es la sesión.
    const sessionExpired = error instanceof StorageServiceError && error.kind === 'unauthorized';
    // Servidor anterior sin las rutas de combinación/restauración de copias: se
    // avisa de forma específica y accionable en lugar del error genérico.
    const serverUnsupported = error instanceof StorageServiceError && error.kind === 'unsupported-server';
    if (sessionExpired) {
      ++dataLoadVersionRef.current;
      localStorage.removeItem('cta_session_token');
      setCurrentUser(null);
      setReadings([]);
      setSettings(DEFAULT_SETTINGS);
      void logout();
    }
    setNotificationMsg(getTranslation(settings.language, sessionExpired
      ? 'toast.sessionExpired'
      : serverUnsupported
        ? 'toast.serverUnsupported'
        : 'toast.storageError'));
  }, [settings.language]);

  const persistSettings = useCallback(async (newSettings: AppSettings) => {
    await saveSettingsToServer(newSettings);
    setSettings(newSettings);
  }, []);

  const handleUpdateSettings = useCallback(async (newSettings: AppSettings): Promise<boolean> => {
    try {
      await persistSettings(newSettings);
      return true;
    } catch (error) {
      showStorageError(error);
      return false;
    }
  }, [persistSettings, showStorageError]);

  const handleMedicationContextChange = async (
    takesMedication: boolean,
    recalculateHistory: boolean
  ): Promise<boolean> => {
    const updatedSettings = {
      ...settings,
      takesAntihypertensiveMedication: takesMedication,
    };
    try {
      if (recalculateHistory) {
        await updateMedicationContextForAllReadings(takesMedication);
        setSettings(updatedSettings);
        setReadings((current) =>
          current.map((reading) => ({
            ...reading,
            takesAntihypertensiveMedication: takesMedication,
          }))
        );
        return true;
      }
      await persistSettings(updatedSettings);
      return true;
    } catch (error) {
      showStorageError(error);
      return false;
    }
  };

  const { sessions } = useMemo(
    () => processReadingsIntoSessions(readings, settings),
    [readings, settings]
  );

  // 1. Verificar sesión del servidor al arrancar o al cambiar de URL de servidor
  useEffect(() => {
    async function checkAuth() {
      const currentUrl = getSavedServerUrl();
      if (!currentUrl) {
        setIsServerModalOpen(true);
        setAuthChecking(false);
        return;
      }

      setAuthChecking(true);
      const conn = await testServerConnection(currentUrl);
      if (!conn.success) {
        setIsServerModalOpen(true);
        setAuthChecking(false);
        return;
      }

      const status = await getAuthStatus();
      setHasAdmin(status.hasAdmin);
      if (status.user) {
        const loadVersion = ++dataLoadVersionRef.current;
        setCurrentUser(status.user);
        try {
          await loadUserData(loadVersion);
        } catch (error) {
          showStorageError(error);
        }
      } else {
        ++dataLoadVersionRef.current;
        setCurrentUser(null);
        setReadings([]);
        setSettings(DEFAULT_SETTINGS);
      }
      setAuthChecking(false);
    }
    checkAuth();
  }, [serverUrl]);

  async function loadUserData(loadVersion: number) {
    const [fetchedReadings, fetchedSettings] = await Promise.all([
      fetchReadingsFromServer(),
      fetchSettingsFromServer(),
    ]);
    if (loadVersion !== dataLoadVersionRef.current) return;
    setReadings(fetchedReadings);
    setSettings(fetchedSettings);
  }

  const handleServerConnected = async (newUrl: string) => {
    setServerUrl(newUrl);
    setIsServerModalOpen(false);
    setAuthChecking(true);

    const status = await getAuthStatus();
    setHasAdmin(status.hasAdmin);
    if (status.user) {
      const loadVersion = ++dataLoadVersionRef.current;
      setCurrentUser(status.user);
      try {
        await loadUserData(loadVersion);
      } catch (error) {
        showStorageError(error);
      }
    } else {
      ++dataLoadVersionRef.current;
      setCurrentUser(null);
      setReadings([]);
      setSettings(DEFAULT_SETTINGS);
    }
    setAuthChecking(false);
  };

  const handleLoginSuccess = async (user: AuthUser) => {
    const loadVersion = ++dataLoadVersionRef.current;
    setCurrentUser(user);
    setHasAdmin(true);
    try {
      await loadUserData(loadVersion);
    } catch (error) {
      showStorageError(error);
    }
  };

  const handleLogout = async () => {
    ++dataLoadVersionRef.current;
    setReadings([]);
    setSettings(DEFAULT_SETTINGS);
    await logout();
    setCurrentUser(null);
  };

  useEffect(() => {
    const showBackupReminderIfDue = () => {
      if (!currentUser || !isBackupDue(readings, settings)) return;
      const reminderKey = `${settings.backupFrequency}:${settings.lastFullBackupTimestamp ?? 'never'}:${new Date().toDateString()}`;
      if (backupReminderKeyRef.current === reminderKey) return;
      backupReminderKeyRef.current = reminderKey;
      setNotificationMsg({
        message: getTranslation(settings.language, 'toast.backupDue'),
        actionLabel: getTranslation(settings.language, 'toast.openBackups'),
        variant: 'soft-blue',
        onAction: () => setIsExportModalOpen(true),
      });
    };

    showBackupReminderIfDue();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') showBackupReminderIfDue();
    };
    const intervalId = window.setInterval(showBackupReminderIfDue, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, readings, settings]);

  const handleUpdateInputMode = (mode: InputMode) => {
    const updated = { ...settings, preferredInputMode: mode };
    handleUpdateSettings(updated);
  };

  const handleImportReadings = async (imported: Omit<BloodPressureReading, 'id'>[]) => {
    try {
      const result = await importReadingsToServer(imported);
      setReadings(result.readings);
      return result.addedCount;
    } catch (error) {
      showStorageError(error);
      throw error;
    }
  };

  const handleTriggerManualBackup = async () => {
    if (readings.length === 0) {
      alert(getTranslation(settings.language, 'toast.noDataToExport'));
      return;
    }
    const now = new Date();
    try {
      const result = await saveBackup(readings, settings, now);
      if (result.mode === 'native') {
        if (!result.saved) {
          setNotificationMsg(getTranslation(settings.language, 'toast.manualBackupCancelled'));
          setTimeout(() => setNotificationMsg(null), 5000);
          return;
        }

        const saved = await handleUpdateSettings({
          ...settings,
          lastBackupTimestamp: now.toISOString(),
          lastFullBackupTimestamp: now.toISOString(),
        });
        if (!saved) return;
        const downloadsFolder = settings.language === 'en' ? 'Downloads' : 'Descargas';
        setNotificationMsg({
          message: getTranslation(settings.language, 'toast.manualBackupSavedAt', { path: downloadsFolder }),
          detail: result.filename,
          variant: 'soft-blue',
        });
        return;
      }
      setNotificationMsg({
        actionLabel: getTranslation(settings.language, 'toast.confirmBackupSaved'),
        cancelLabel: getTranslation(settings.language, 'toast.backupCancelledAction'),
        variant: 'neutral',
        onAction: async () => {
          const updatedSettings = {
            ...settings,
            lastBackupTimestamp: now.toISOString(),
            lastFullBackupTimestamp: now.toISOString(),
          };
          const saved = await handleUpdateSettings(updatedSettings);
          if (!saved) return;
          setNotificationMsg(getTranslation(settings.language, 'toast.manualBackupSuccess'));
          setTimeout(() => setNotificationMsg(null), 5000);
        },
      });
    } catch (error) {
      console.error('Error al guardar la copia:', error);
      setNotificationMsg(getTranslation(settings.language, 'toast.manualBackupError'));
      setTimeout(() => setNotificationMsg(null), 5000);
    }
  };

  const handleRestoreBackup = async (snapshot: AppBackupSnapshot, mode: 'merge' | 'replace', previewToken?: string) => {
    if (mode === 'replace') {
      if (snapshot.readings.length === 0) throw new Error('Cannot report an empty replacement as restored');
      try {
        // Una única llamada atómica: el servidor valida la copia y solo entonces
        // reemplaza el historial dentro de una transacción. Así nunca se destruyen
        // las lecturas actuales antes de tener validada la importación.
        const result = await restoreBackupReplace(snapshot);
        if (result.readings.length === 0) throw new Error('Replacement returned no restored readings');
        setSettings(result.settings);
        setReadings(result.readings);
        return result.readings.length;
      } catch (error) {
        showStorageError(error);
        throw error;
      }
    }

    if (!previewToken) throw new Error('Missing merge preview token');
    try {
      const result = await restoreBackupMerge(snapshot, previewToken);
      setReadings(result.readings);
      return { addedCount: result.addedCount, duplicateCount: result.duplicateCount, conflictCount: result.conflictCount };
    } catch (error) {
      showStorageError(error);
      throw error;
    }
  };

  const handlePreviewBackupMerge = async (snapshot: AppBackupSnapshot) => {
    try {
      return await previewBackupMerge(snapshot);
    } catch (error) {
      showStorageError(error);
      throw error;
    }
  };

  const handleResetDemoData = async () => {
    if (window.confirm(getTranslation(settings.language, 'toast.resetDemoConfirm'))) {
      try {
        const demoReadings = await resetDemoDataOnServer();
        setReadings(demoReadings);
        setIsSettingsModalOpen(false);
        setNotificationMsg(getTranslation(settings.language, 'toast.resetDemoSuccess'));
        setTimeout(() => setNotificationMsg(null), 4000);
      } catch (error) {
        showStorageError(error);
      }
    }
  };

  const handleClearAllData = async () => {
    if (window.confirm(getTranslation(settings.language, 'toast.clearAllConfirm'))) {
      try {
        await clearAllReadingsOnServer();
        setReadings([]);
        setIsSettingsModalOpen(false);
        setNotificationMsg(getTranslation(settings.language, 'toast.clearAllSuccess'));
        setTimeout(() => setNotificationMsg(null), 4000);
      } catch (error) {
        showStorageError(error);
      }
    }
  };

  const handleToggleDarkMode = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const handleAddReading = async (data: {
    systolic: number;
    diastolic: number;
    heartRate: number;
    arm: ArmPosition;
    notes?: string;
    pulsePressureWarningConfirmed?: boolean;
  }) => {
    try {
      const created = await addReadingToServer({
        timestamp: new Date().toISOString(),
        systolic: data.systolic,
        diastolic: data.diastolic,
        heartRate: data.heartRate,
        arm: data.arm,
        notes: data.notes,
        pulsePressureWarningConfirmed: data.pulsePressureWarningConfirmed,
        takesAntihypertensiveMedication: settings.takesAntihypertensiveMedication,
      });
      setReadings((prev) => [created, ...prev]);
    } catch (error) {
      showStorageError(error);
      throw error;
    }
  };

  const handleDeleteSession = async (sessionToDelete: any) => {
    if (window.confirm(getTranslation(settings.language, 'list.deleteSessionConfirm'))) {
      const ids = sessionToDelete.readings.map((r: any) => r.id);
      try {
        await deleteSessionFromServer(ids);
        setReadings((prev) => prev.filter((r) => !ids.includes(r.id)));
      } catch (error) {
        showStorageError(error);
      }
    }
  };

  const deleteSingleReading = async (readingId: string) => {
    try {
      await deleteReadingFromServer(readingId);
      setReadings((prev) => prev.filter((r) => r.id !== readingId));
    } catch (error) {
      showStorageError(error);
      throw error;
    }
  };

  const handleDeleteSingleReading = async (readingId: string) => {
    if (window.confirm(getTranslation(settings.language, 'list.deleteReadingConfirm'))) {
      try {
        await deleteSingleReading(readingId);
      } catch {
        // The list stays unchanged; deleteSingleReading already reported the failure.
      }
    }
  };

  const handleSaveReadingEdit = async (updatedReading: BloodPressureReading) => {
    try {
      await updateReadingOnServer(updatedReading);
      setReadings((prev) => prev.map((r) => (r.id === updatedReading.id ? updatedReading : r)));
    } catch (error) {
      showStorageError(error);
      throw error;
    }
  };

  if (authChecking) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
        <p>Conectando con servidor local...</p>
      </div>
    );
  }

  // Si la pantalla de configuración del servidor está activa, renderizarla de forma individual aislada
  if (isServerModalOpen) {
    return (
      <LanguageProvider
        language={settings.language}
        onLanguageChange={(lang) => handleUpdateSettings({ ...settings, language: lang })}
      >
        <div style={{ display: 'flex', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-app)', color: 'var(--text-primary)', padding: '20px' }}>
          <ServerConfigModal
            isOpen={true}
            canDismiss={Boolean(serverUrl)}
            onClose={() => setIsServerModalOpen(false)}
            onConnected={handleServerConnected}
          />
        </div>
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider
      language={settings.language}
      onLanguageChange={(lang) => handleUpdateSettings({ ...settings, language: lang })}
    >
      <div className="app-container">
        {/* Modal de Login / Registro Admin si no hay usuario autenticado */}
        {!currentUser && (
          <LoginModal
            hasAdmin={hasAdmin}
            onLoginSuccess={handleLoginSuccess}
          />
        )}

        {notificationMsg && (
          <div className={`toast-modal-overlay ${typeof notificationMsg === 'object' ? notificationMsg.variant ?? '' : ''}`} onClick={() => setNotificationMsg(null)}>
            <div className={`toast-notification ${typeof notificationMsg === 'object' ? notificationMsg.variant ?? '' : ''}`} onClick={(e) => e.stopPropagation()}>
              <div className="toast-top-row">
                {(typeof notificationMsg === 'string' || notificationMsg.message) && (
                  <span className="toast-message-text">
                    {typeof notificationMsg === 'string' ? notificationMsg : notificationMsg.message}
                  </span>
                )}
                {(typeof notificationMsg === 'string' || !notificationMsg.cancelLabel) && (
                  <button
                    type="button"
                    className="toast-close-btn"
                    onClick={() => setNotificationMsg(null)}
                    aria-label="Cerrar notificación"
                  >
                    ×
                  </button>
                )}
              </div>

              {typeof notificationMsg === 'object' && notificationMsg.detail && (
                <span className="toast-detail-text">{notificationMsg.detail}</span>
              )}

              {typeof notificationMsg === 'object' && notificationMsg.actionLabel && notificationMsg.onAction && (
                <div className="toast-bottom-row">
                  <button
                    type="button"
                    className="toast-action-btn"
                    onClick={() => {
                      setNotificationMsg(null);
                      notificationMsg.onAction?.();
                    }}
                  >
                    {notificationMsg.actionLabel}
                  </button>
                  {notificationMsg.cancelLabel && (
                    <button type="button" className="toast-cancel-btn" onClick={() => setNotificationMsg(null)}>
                      {notificationMsg.cancelLabel}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <Header
          currentUser={currentUser}
          onOpenExportModal={() => setIsExportModalOpen(true)}
          onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
          onOpenUserMgmtModal={() => setIsUserMgmtModalOpen(true)}
          onLogout={handleLogout}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
          serverHealthUrl={serverUrl ? `${serverUrl}/api/health` : ''}
        />

        <ReadingForm
          onAddReading={handleAddReading}
          settings={settings}
          onUpdateInputMode={handleUpdateInputMode}
          readings={readings}
        />

        <TrendChart
          sessions={sessions}
          settings={settings}
        />

        <TrendInsights
          sessions={sessions}
          guidelineProfile={settings.guidelineProfile}
          settings={settings}
        />

        <ReadingList
          sessions={sessions}
          onDeleteSession={handleDeleteSession}
          onDeleteSingleReading={handleDeleteSingleReading}
          onEditReading={(reading) => setReadingToEdit(reading)}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          settings={settings}
        />

        <footer className="app-footer">
          <span>{getTranslation(settings.language, 'header.title')}</span>
          <span> &bull; </span>
          <button
            type="button"
            className="btn-footer-link"
            onClick={() => setIsLegalNoticeOpen(true)}
          >
            {getTranslation(settings.language, 'legal.footerLink')}
          </button>
        </footer>

        <EditReadingModal
          isOpen={Boolean(readingToEdit)}
          reading={readingToEdit}
          settings={settings}
          onUpdateInputMode={handleUpdateInputMode}
          onClose={() => setReadingToEdit(null)}
          onSaveReading={handleSaveReadingEdit}
          onDeleteReading={deleteSingleReading}
          readings={readings}
        />

        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          sessions={sessions}
          readings={readings}
          settings={settings}
          currentUser={currentUser}
          onImportReadings={handleImportReadings}
          onPreviewBackupMerge={handlePreviewBackupMerge}
          onRestoreBackup={handleRestoreBackup}
          onUpdateSettings={handleUpdateSettings}
          onTriggerManualBackup={handleTriggerManualBackup}
          onNotify={(msg) => setNotificationMsg(msg)}
        />

        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onMedicationContextChange={handleMedicationContextChange}
          onResetDemoData={handleResetDemoData}
          onClearAllData={handleClearAllData}
          serverUrl={serverUrl}
          onOpenServerModal={() => {
            setIsSettingsModalOpen(false);
            setIsServerModalOpen(true);
          }}
          onOpenTotpModal={() => {
            setIsSettingsModalOpen(false);
            setIsTotpModalOpen(true);
          }}
          isTotpEnabled={Boolean(currentUser?.totp_enabled)}
        />

        <TotpSetupModal
          isOpen={isTotpModalOpen}
          onClose={() => setIsTotpModalOpen(false)}
          isTotpEnabled={Boolean(currentUser?.totp_enabled)}
          onTotpStatusChanged={(enabled) => {
            if (currentUser) {
              setCurrentUser({ ...currentUser, totp_enabled: enabled });
            }
          }}
        />

        {currentUser && currentUser.role === 'admin' && (
          <UserManagementModal
            isOpen={isUserMgmtModalOpen}
            onClose={() => setIsUserMgmtModalOpen(false)}
            currentUser={currentUser}
          />
        )}

        <LegalNoticeModal
          isOpen={isLegalNoticeOpen}
          onClose={() => setIsLegalNoticeOpen(false)}
          guidelineProfile={settings.guidelineProfile}
        />
      </div>
    </LanguageProvider>
  );
}

export default App;
