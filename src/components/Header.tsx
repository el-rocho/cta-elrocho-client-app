import React from 'react';
import { ShieldCheck, Download, Moon, Sun, Settings, LogOut, Users, Server } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { AppLogo } from './AppLogo';
import type { AuthUser } from '../types/bloodPressure';

interface HeaderProps {
  currentUser: AuthUser | null;
  serverUrl?: string;
  onOpenServerModal?: () => void;
  onOpenExportModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenUserMgmtModal?: () => void;
  onLogout?: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  serverUrl,
  onOpenServerModal,
  onOpenExportModal,
  onOpenSettingsModal,
  onOpenUserMgmtModal,
  onLogout,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const { t } = useLanguage();
  const appVersion = import.meta.env.VITE_APP_VERSION || 'v1.5.4';

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-logo">
          <AppLogo className="brand-logo-img" />
        </div>
        <div>
          <h1 className="brand-title">{t('header.title')}</h1>
          <div className="brand-badge">
            <ShieldCheck size={13} className="shield-icon" />
            <span>
              {currentUser ? `Hola, ${currentUser.name}` : t('header.badgePrivate')} &bull; {appVersion}
            </span>
          </div>
        </div>
      </div>

      <div className="header-actions">
        {onOpenServerModal && (
          <button
            type="button"
            onClick={onOpenServerModal}
            className="btn-icon"
            title={serverUrl ? `Servidor: ${serverUrl}` : 'Configurar Servidor'}
            style={{ color: '#3b82f6' }}
          >
            <Server size={22} />
          </button>
        )}

        {currentUser && currentUser.role === 'admin' && onOpenUserMgmtModal && (
          <button
            type="button"
            onClick={onOpenUserMgmtModal}
            className="btn-icon"
            title="Gestión de usuarios"
          >
            <Users size={22} />
          </button>
        )}

        <button
          onClick={onToggleDarkMode}
          className="btn-icon"
          title={isDarkMode ? t('header.lightMode') : t('header.darkMode')}
        >
          {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
        </button>

        <button
          onClick={onOpenSettingsModal}
          className="btn-icon"
          title={t('header.settingsTooltip')}
        >
          <Settings size={22} />
        </button>

        <button onClick={onOpenExportModal} className="btn-primary-gradient" title={t('header.exportTooltip')}>
          <Download size={18} />
          <span>{t('header.exportBtn')}</span>
        </button>

        {currentUser && onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="btn-icon"
            style={{ color: '#ef4444' }}
            title="Cerrar Sesión"
          >
            <LogOut size={22} />
          </button>
        )}
      </div>
    </header>
  );
};
