import React from 'react';
import type { AppSettings, BackupFrequency, PatientSex, LanguageOption } from '../types/bloodPressure';
import { Settings, X, ShieldAlert, ShieldCheck, Clock, Armchair, RotateCcw, Save, Folder, CalendarCheck, User, Trash2, Globe, Server } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { calculateAge } from '../utils/pdfGenerator';
import { FlagES, FlagGB } from './FlagIcons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onResetDemoData: () => void;
  onClearAllData: () => void;
  onTriggerManualBackup: () => void;
  serverUrl?: string;
  onOpenServerModal?: () => void;
  onOpenTotpModal?: () => void;
  isTotpEnabled?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetDemoData,
  onClearAllData,
  onTriggerManualBackup,
  serverUrl,
  onOpenServerModal,
  onOpenTotpModal,
  isTotpEnabled = false,
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const currentWhiteCoatInterval = [3, 5, 10].includes(settings.whiteCoatIntervalMinutes)
    ? settings.whiteCoatIntervalMinutes
    : 5;

  const handleLanguageChange = (lang: LanguageOption) => {
    onUpdateSettings({ ...settings, language: lang });
  };

  const handlePatientNameChange = (name: string) => {
    onUpdateSettings({ ...settings, patientName: name });
  };

  const handlePatientSexChange = (sex: PatientSex) => {
    onUpdateSettings({ ...settings, patientSex: sex });
  };

  const handlePatientBirthDateChange = (val: string) => {
    const computedAge = val ? calculateAge(val) : '';
    onUpdateSettings({
      ...settings,
      patientBirthDate: val,
      patientAge: computedAge,
    });
  };

  const handleToggleWhiteCoat = () => {
    onUpdateSettings({
      ...settings,
      enableWhiteCoatFilter: !settings.enableWhiteCoatFilter,
      whiteCoatIntervalMinutes: currentWhiteCoatInterval,
    });
  };

  const handleChangeInterval = (minutes: number) => {
    onUpdateSettings({
      ...settings,
      whiteCoatIntervalMinutes: minutes,
    });
  };

  const handleChangeDefaultArm = (arm: 'left' | 'right') => {
    onUpdateSettings({
      ...settings,
      defaultArm: arm,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-box">
            <Settings className="text-blue" size={24} />
            <h2>{t('settings.title')}</h2>
          </div>
          <button onClick={onClose} className="btn-close" title={t('settings.close')}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-body">
          {/* Opción 1: Idioma */}
          <div className="settings-section">
            <div className="field-label">
              <Globe size={22} className="settings-field-icon" />
              <span>{t('settings.languageTitle')}</span>
            </div>
            <div className="chip-options-row">
              <button
                type="button"
                className={`chip-select ${settings.language === 'es' ? 'active' : ''}`}
                onClick={() => handleLanguageChange('es')}
              >
                <FlagES className="flag-icon" />
                <span>{t('settings.langSpanish')}</span>
              </button>
              <button
                type="button"
                className={`chip-select ${settings.language === 'en' ? 'active' : ''}`}
                onClick={() => handleLanguageChange('en')}
              >
                <FlagGB className="flag-icon" />
                <span>{t('settings.langEnglish')}</span>
              </button>
            </div>
          </div>

          {/* Opción 2: Servidor autoalojado */}
          {onOpenServerModal && (
            <div className="settings-section border-top">
              <div className="field-label">
                <Server size={22} className="text-blue settings-field-icon" />
                <span>{t('settings.serverTitle')}</span>
              </div>
              <p className="settings-desc" style={{ marginBottom: '10px' }}>
                {serverUrl
                  ? t('settings.serverCurrent', { url: serverUrl })
                  : t('settings.serverDesc')}
              </p>
              <button
                type="button"
                className="btn-primary-large"
                onClick={onOpenServerModal}
                style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '13px' }}
              >
                <Server size={18} />
                <span>{t('settings.serverChange')}</span>
              </button>
            </div>
          )}

          {/* Opción 3: Perfil del paciente */}
          <div className="settings-section border-top">
            <div className="field-label">
              <User size={22} className="settings-field-icon" />
              <span>{t('settings.patientProfile')}</span>
            </div>
            <p className="settings-desc patient-profile-desc">{t('settings.patientProfileDesc')}</p>

            <div className="patient-profile-fields">
              <div className="patient-profile-field">
                <label className="settings-desc">{t('settings.fullName')}</label>
                <input
                  type="text"
                  className="modal-input patient-profile-input"
                  placeholder={t('settings.fullNamePlaceholder')}
                  value={settings.patientName || ''}
                  onChange={(e) => handlePatientNameChange(e.target.value)}
                />
              </div>

              <div className="patient-profile-field">
                <label className="settings-desc">{t('settings.birthDate')}</label>
                <input
                  type="date"
                  className="modal-input patient-profile-input"
                  value={settings.patientBirthDate || ''}
                  onChange={(e) => handlePatientBirthDateChange(e.target.value)}
                />
              </div>

              <div className="patient-profile-field">
                <label className="settings-desc">{t('settings.sexLabel')}</label>
                <div className="chip-options-row patient-sex-options">
                  <button
                    type="button"
                    className={`chip-select ${settings.patientSex === 'masculino' ? 'active' : ''}`}
                    onClick={() => handlePatientSexChange('masculino')}
                  >
                    {t('settings.sexMale')}
                  </button>
                  <button
                    type="button"
                    className={`chip-select ${settings.patientSex === 'femenino' ? 'active' : ''}`}
                    onClick={() => handlePatientSexChange('femenino')}
                  >
                    {t('settings.sexFemale')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Opción 3: Filtro de Bata Blanca */}
          <div className="settings-section border-top">
            <div className="settings-row">
              <div>
                <div className="field-label">
                  <Clock size={22} className="settings-field-icon text-blue" />
                  <span>{t('settings.whiteCoatTitle')}</span>
                </div>
                <p className="settings-desc">{t('settings.whiteCoatDesc')}</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.enableWhiteCoatFilter}
                  onChange={handleToggleWhiteCoat}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {settings.enableWhiteCoatFilter && (
              <div className="whitecoat-options">
                <div className="subfield-label">
                  <span>{t('settings.intervalLabel')}</span>
                </div>
                <div className="chip-options-row">
                  {[3, 5, 10].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className={`chip-select ${currentWhiteCoatInterval === mins ? 'active' : ''}`}
                      onClick={() => handleChangeInterval(mins)}
                    >
                      {t('settings.minutesText', { mins })}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Opción 4: Brazo por defecto */}
          <div className="settings-section border-top">
            <div className="field-label">
              <Armchair size={22} className="settings-field-icon" />
              <span>{t('settings.defaultArmTitle')}</span>
            </div>
            <div className="chip-options-row">
              <button
                type="button"
                className={`chip-select ${settings.defaultArm === 'left' ? 'active' : ''}`}
                onClick={() => handleChangeDefaultArm('left')}
              >
                {t('settings.defaultArmLeft')}
              </button>
              <button
                type="button"
                className={`chip-select ${settings.defaultArm === 'right' ? 'active' : ''}`}
                onClick={() => handleChangeDefaultArm('right')}
              >
                {t('settings.defaultArmRight')}
              </button>
            </div>
          </div>

          {/* Opción 5: Seguridad y 2FA TOTP */}
          {onOpenTotpModal && (
            <div className="settings-section border-top">
              <div className="field-label">
                {isTotpEnabled
                  ? <ShieldCheck size={22} className="text-green settings-field-icon" />
                  : <ShieldAlert size={22} className="text-blue settings-field-icon" />}
                <span>Seguridad de la Cuenta</span>
              </div>
              <p className="settings-desc" style={{ marginBottom: '10px' }}>
                {isTotpEnabled
                  ? 'La autenticación en dos pasos está activa. Puedes desactivarla o vincular una nueva aplicación de autenticación.'
                  : 'Protege tu acceso con verificación en dos pasos (Google Authenticator, Aegis, Authy, etc.).'}
              </p>
              <button
                type="button"
                className="btn-primary-large"
                onClick={onOpenTotpModal}
                style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '13px' }}
              >
                {isTotpEnabled ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                <span>{isTotpEnabled ? 'Administrar 2FA (activo)' : 'Configurar 2FA (TOTP)'}</span>
              </button>
            </div>
          )}

          {/* Opción 6: Botones de Gestión */}
          <div className="settings-section border-top">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                type="button"
                className="btn-subtle-reset"
                onClick={onResetDemoData}
                style={{ justifyContent: 'center', padding: '10px' }}
              >
                <RotateCcw size={16} />
                <span>{t('settings.resetDemo')}</span>
              </button>

              <button
                type="button"
                className="btn-danger-reset"
                onClick={onClearAllData}
                style={{ justifyContent: 'center', padding: '10px' }}
              >
                <Trash2 size={16} />
                <span>{t('settings.clearAll')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
