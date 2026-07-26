import React, { useState } from 'react';
import { Server, CheckCircle2, AlertTriangle, RefreshCw, X, Globe } from 'lucide-react';
import { testServerConnection, saveServerUrl, getSavedServerUrl } from '../services/serverConfigService';

interface ServerConfigModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onConnected: (serverUrl: string) => void;
  canDismiss?: boolean;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
  isOpen,
  onClose,
  onConnected,
  canDismiss = false,
}) => {
  const [serverIp, setServerIp] = useState<string>(getSavedServerUrl() || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverIp.trim()) {
      setErrorMsg('Por favor, introduce la IP o URL de tu servidor.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await testServerConnection(serverIp);
    setLoading(false);

    if (res.success && res.url) {
      const savedUrl = saveServerUrl(res.url);
      setSuccessMsg('¡Conexión establecida con éxito con el servidor!');
      setTimeout(() => {
        onConnected(savedUrl);
        if (onClose) onClose();
      }, 700);
    } else {
      setErrorMsg(res.error || 'Error al conectar con el servidor.');
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '480px', padding: '28px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              }}
            >
              <Server size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Servidor Autoalojado</h2>
              <p style={{ margin: 0, fontSize: '0.88rem', opacity: 0.75 }}>
                Conexión al servidor
              </p>
            </div>
          </div>
          {canDismiss && onClose && (
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              title="Cancelar"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <form onSubmit={handleTestAndSave}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px', fontSize: '0.9rem' }}>
              Dirección IP o URL del Servidor:
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="http://192.168.1.50:3000"
                value={serverIp}
                onChange={(e) => {
                  setServerIp(e.target.value);
                  setErrorMsg(null);
                }}
                disabled={loading}
                style={{ paddingLeft: '40px', fontSize: '0.95rem' }}
                autoFocus
              />
              <Globe
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  opacity: 0.5,
                }}
              />
            </div>
            <span className="field-help" style={{ marginTop: '8px', fontSize: '0.83rem', display: 'block', opacity: 0.8 }}>
              Introduce la dirección donde instalaste cta-elrocho-selfhosted
            </span>
          </div>

          {errorMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.88rem',
                marginBottom: '20px',
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10b981',
                fontSize: '0.88rem',
                marginBottom: '20px',
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div>{successMsg}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            {canDismiss && onClose && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
                style={{ padding: '10px 18px' }}
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !serverIp.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}
            >
              {loading ? (
                <>
                  <RefreshCw className="spin" size={18} />
                  Conectando...
                </>
              ) : (
                'Conectar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
