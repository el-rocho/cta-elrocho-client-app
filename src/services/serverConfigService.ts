/**
 * Servicio para gestionar la URL y conectividad del servidor autoalojado
 */

import { Capacitor } from '@capacitor/core';

const SERVER_URL_KEY = 'cta_server_url';

export function getSavedServerUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) || '';
}

export function saveServerUrl(url: string): string {
  let cleanUrl = url.trim();
  // Si no tiene esquema, añadir http://
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `http://${cleanUrl}`;
  }
  // Eliminar barras finales
  cleanUrl = cleanUrl.replace(/\/+$/, '');
  localStorage.setItem(SERVER_URL_KEY, cleanUrl);
  return cleanUrl;
}

export function clearServerUrl(): void {
  localStorage.removeItem(SERVER_URL_KEY);
}

export interface ServerConnectionResult {
  success: boolean;
  hasAdmin?: boolean;
  userCount?: number;
  user?: any;
  error?: string;
  url?: string;
}

export async function testServerConnection(url: string): Promise<ServerConnectionResult> {
  let cleanUrl = url.trim();
  if (!cleanUrl) {
    return { success: false, error: 'Por favor, introduce la IP o dirección URL de tu servidor.' };
  }

  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `http://${cleanUrl}`;
  }
  cleanUrl = cleanUrl.replace(/\/+$/, '');

  try {
    const token = localStorage.getItem('cta_session_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['x-session-token'] = token;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${cleanUrl}/api/auth/status`, {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        success: false,
        error: `El servidor respondió con el código HTTP ${res.status}.`,
        url: cleanUrl,
      };
    }

    const data = await res.json();
    return {
      success: true,
      hasAdmin: Boolean(data.hasAdmin),
      userCount: data.userCount || 0,
      user: data.user || null,
      url: cleanUrl,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'Tiempo de espera agotado (6s). Verifica que la IP y el puerto sean correctos y estés en la misma red.',
        url: cleanUrl,
      };
    }

    if (Capacitor.isNativePlatform() && cleanUrl.startsWith('http://')) {
      return {
        success: false,
        error: 'Android no pudo acceder al servidor HTTP local. Comprueba que el teléfono esté en la misma red Wi-Fi, que no exista aislamiento entre dispositivos y que la dirección se abra en el navegador del teléfono.',
        url: cleanUrl,
      };
    }

    return {
      success: false,
      error: 'No se pudo conectar con el servidor. Revisa la IP/puerto y asegúrate de que Docker o el servidor estén activos.',
      url: cleanUrl,
    };
  }
}
