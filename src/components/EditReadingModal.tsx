import React, { useState, useEffect } from 'react';
import type { BloodPressureReading, AppSettings, InputMode } from '../types/bloodPressure';
import { Edit3, X, Save, Clock, AlertCircle, Keyboard, Sliders } from 'lucide-react';
import { WheelPicker } from './WheelPicker';
import { useLanguage } from '../i18n/LanguageContext';

interface EditReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  reading: BloodPressureReading | null;
  settings: AppSettings;
  onUpdateInputMode?: (mode: InputMode) => void;
  onSaveReading: (updatedReading: BloodPressureReading) => void;
}

export const EditReadingModal: React.FC<EditReadingModalProps> = ({
  isOpen,
  onClose,
  reading,
  settings,
  onUpdateInputMode,
  onSaveReading,
}) => {
  const { t, language } = useLanguage();

  const [inputMode, setInputMode] = useState<InputMode>(settings.preferredInputMode || 'keyboard');
  const [systolic, setSystolic] = useState<number | ''>('');
  const [diastolic, setDiastolic] = useState<number | ''>('');
  const [heartRate, setHeartRate] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeInputMode = settings.preferredInputMode || inputMode;

  useEffect(() => {
    if (reading) {
      setSystolic(reading.systolic);
      setDiastolic(reading.diastolic);
      setHeartRate(reading.heartRate);
      setNotes(reading.notes || '');
      setErrorMsg(null);
    }
  }, [reading]);

  useEffect(() => {
    if (settings.preferredInputMode) {
      setInputMode(settings.preferredInputMode);
    }
  }, [settings.preferredInputMode]);

  if (!isOpen || !reading) return null;

  const locale = language === 'en' ? 'en-US' : 'es-ES';
  const dateObj = new Date(reading.timestamp);
  const formattedDate = dateObj.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleToggleInputMode = (newMode: InputMode) => {
    setInputMode(newMode);
    if (onUpdateInputMode) {
      onUpdateInputMode(newMode);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const sysNum = Number(systolic);
    const diaNum = Number(diastolic);
    const hrNum = Number(heartRate);

    if (
      !sysNum ||
      !diaNum ||
      !hrNum ||
      sysNum < 40 ||
      sysNum > 300 ||
      diaNum < 30 ||
      diaNum > 200 ||
      hrNum < 30 ||
      hrNum > 250
    ) {
      setErrorMsg(t('form.validationAlert'));
      return;
    }

    const updated: BloodPressureReading = {
      ...reading,
      systolic: sysNum,
      diastolic: diaNum,
      heartRate: hrNum,
      notes: notes.trim() ? notes.trim() : undefined,
    };

    onSaveReading(updated);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-reading-modal" onClick={(e) => e.stopPropagation()}>
        {/* Encabezado del Modal */}
        <div className="modal-header edit-modal-header">
          <div className="modal-title-row">
            <Edit3 size={24} className="modal-header-icon" />
            <h2>{t('editModal.title')}</h2>
          </div>

          <div className="input-mode-toggle edit-header-toggle">
            <button
              type="button"
              className={`btn-mode-chip ${activeInputMode === 'keyboard' ? 'active' : ''}`}
              onClick={() => handleToggleInputMode('keyboard')}
            >
              <Keyboard size={16} />
              <span>{t('form.modeKeyboard')}</span>
            </button>
            <button
              type="button"
              className={`btn-mode-chip ${activeInputMode === 'wheel' ? 'active' : ''}`}
              onClick={() => handleToggleInputMode('wheel')}
            >
              <Sliders size={16} />
              <span>{t('form.modeWheel')}</span>
            </button>
          </div>

          <button
            type="button"
            className="btn-icon-close"
            onClick={onClose}
            aria-label={t('settings.close')}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-modal-body">
          {/* Recuadro Informativo de Fecha y Hora Originales */}
          <div className="readonly-timestamp-banner">
            <div className="timestamp-value">
              <Clock size={16} />
              <span>
                <strong>{formattedDate} - {formattedTime}</strong>
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="form-error-banner">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Formulario de Campos Editables */}
          {activeInputMode === 'keyboard' ? (
            <div className="edit-fields-grid">
              {/* Sistólica */}
              <div className="edit-field-group">
                <label htmlFor="edit-systolic">
                  <span className="dot dot-sys"></span>
                  {t('editModal.systolic')} <span className="unit-label">(mmHg)</span>
                </label>
                <input
                  id="edit-systolic"
                  type="number"
                  inputMode="numeric"
                  min="40"
                  max="300"
                  value={systolic}
                  onChange={(e) => setSystolic(e.target.value === '' ? '' : Number(e.target.value))}
                  onFocus={handleFocus}
                  className="edit-input num-input"
                  required
                />
              </div>

              {/* Diastólica */}
              <div className="edit-field-group">
                <label htmlFor="edit-diastolic">
                  <span className="dot dot-dia"></span>
                  {t('editModal.diastolic')} <span className="unit-label">(mmHg)</span>
                </label>
                <input
                  id="edit-diastolic"
                  type="number"
                  inputMode="numeric"
                  min="30"
                  max="200"
                  value={diastolic}
                  onChange={(e) => setDiastolic(e.target.value === '' ? '' : Number(e.target.value))}
                  onFocus={handleFocus}
                  className="edit-input num-input"
                  required
                />
              </div>

              {/* Pulsaciones */}
              <div className="edit-field-group">
                <label htmlFor="edit-heartRate">
                  <span className="dot dot-bpm"></span>
                  {t('editModal.heartRate')} <span className="unit-label">({language === 'en' ? 'BPM' : 'ppm'})</span>
                </label>
                <input
                  id="edit-heartRate"
                  type="number"
                  inputMode="numeric"
                  min="30"
                  max="250"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value === '' ? '' : Number(e.target.value))}
                  onFocus={handleFocus}
                  className="edit-input num-input"
                  required
                />
              </div>
            </div>
          ) : (
            <div className="wheel-mode-container" style={{ marginBottom: '16px' }}>
              <WheelPicker
                systolic={typeof systolic === 'number' ? systolic : 120}
                diastolic={typeof diastolic === 'number' ? diastolic : 80}
                heartRate={typeof heartRate === 'number' ? heartRate : 72}
                onChangeSystolic={setSystolic}
                onChangeDiastolic={setDiastolic}
                onChangeHeartRate={setHeartRate}
              />
            </div>
          )}

          {/* Notas */}
          <div className="edit-field-group notes-group">
            <textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('editModal.notesPlaceholder')}
              rows={3}
              className="edit-input notes-textarea"
            />
          </div>

          {/* Acciones */}
          <div className="modal-actions-row">
            <button type="button" className="btn-secondary-large" onClick={onClose}>
              <X size={20} />
              <span>{t('editModal.cancel')}</span>
            </button>
            <button type="submit" className="btn-primary-large">
              <Save size={20} />
              <span>{t('editModal.save')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
