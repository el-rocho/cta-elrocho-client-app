import React from 'react';
import type { AppSettings, BackupFrequency, PatientSex, LanguageOption } from '../types/bloodPressure';
import { Settings, X, ShieldAlert, Clock, Armchair, RotateCcw, Save, Folder, CalendarCheck, User, Trash2, Globe, Server } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { calculateAge } from '../utils/pdfGenerator';
import { FlagES, FlagGB } from './FlagIcons';
import { getSavedServerUrl } from '../services/serverConfigService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onResetDemoData: () => void;
  onClearAllData: () => void;
  onTriggerManualBackup: () => void;
  onOpenTotpModal?: () => void;
  onOpenServerModal?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetDemoData,
  onClearAllData,
  onTriggerManualBackup,
  onOpenTotpModal,
  onOpenServerModal,
}) => {
  const { t } = useLanguage();
  const currentServerUrl = getSavedServerUrl();

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
            <h2>{t('settings.modalTitle')}</h2>
          </div>
          <button onClick={onClose} className="btn-close" title={t('settings.closeTooltip')}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-body">
          {/* Opción Servidor Autoalojado */}
          {onOpenServerModal && (
            <div className="settings-section" style={{ background: 'var(--bg-secondary, #f8fafc)', padding: '14px', borderRadius: '12px', marginBottom: '16px' }}>
              <div className="field-label" style={{ marginBottom: '6px' }}>
                <Server size={20} className="text-blue settings-field-icon" />
                <span style={{ fontWeight: 700 }}>Servidor Autoalojado Conectado</span>
              </div>
              <p className="settings-desc" style={{ marginBottom: '12px', fontSize: '0.85rem' }}>
                Dirección actual: <code>{currentServerUrl || 'No configurado'}</code>
              </p>
              <button
                type="button"
                className="btn-primary-large"
                onClick={onOpenServerModal}
                style={{ width: '100%', justifyContent: 'center', padding: '9px', fontSize: '13px' }}
              >
                <Server size={16} />
                <span>Cambiar IP / URL del Servidor</span>
              </button>
            </div>
          )}

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

          {/* Opción 2: Perfil del paciente */}
          <div className="settings-section border-top">
            <div className="field-label">
              <User size={22} className="settings-field-icon" />
              <span>{t('settings.patientProfileTitle')}</span>
            </div>
            <p className="settings-desc">{t('settings.patientProfileDesc')}</p>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label>{t('settings.patientNameLabel')}</label>
              <input
                type="text"
                className="form-input"
                placeholder={t('settings.patientNamePlaceholder')}
                value={settings.patientName || ''}
                onChange={(e) => handlePatientNameChange(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>{t('settings.patientSexLabel')}</label>
                <select
                  className="form-input"
                  value={settings.patientSex || ''}
                  onChange={(e) => handlePatientSexChange(e.target.value as PatientSex)}
                >
                  <option value="">{t('settings.patientSexSelect')}</option>
                  <option value="masculino">{t('settings.patientSexMale')}</option>
                  <option value="femenino">{t('settings.patientSexFemale')}</option>
                </select>
              </div>

              <div className="form-group">
                <label>{t('settings.patientBirthDateLabel')}</label>
                <input
                  type="date"
                  className="form-input"
                  value={settings.patientBirthDate || ''}
                  onChange={(e) => handlePatientBirthDateChange(e.target.value)}
                />
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
                <ShieldAlert size={22} className="text-blue settings-field-icon" />
                <span>Seguridad de la Cuenta</span>
              </div>
              <p className="settings-desc" style={{ marginBottom: '10px' }}>
                Protege tu acceso con verificación en dos pasos (Google Authenticator, Aegis, Authy, etc.).
              </p>
              <button
                type="button"
                className="btn-primary-large"
                onClick={onOpenTotpModal}
                style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '13px' }}
              >
                <ShieldAlert size={18} />
                <span>Configurar 2FA (TOTP)</span>
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
