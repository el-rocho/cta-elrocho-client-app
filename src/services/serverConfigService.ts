/**
 * Servicio para gestionar la URL y conectividad del servidor autoalojado
 */

import { Capacitor } from '@capacitor/core';

const SERVER_URL_KEY = 'cta_server_url';

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, '');
}

function looksLikeLocalAddress(address: string): boolean {
  const host = address.split('/')[0].split(':')[0].toLowerCase();
  return host === 'localhost'
    || host.endsWith('.local')
    || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
    || !host.includes('.');
}

/**
 * Devuelve las direcciones que deben probarse respetando un protocolo explícito.
 * Si no se indicó protocolo, prioriza HTTP en direcciones locales y HTTPS en dominios.
 */
export function getServerUrlCandidates(url: string): string[] {
  const cleanUrl = stripTrailingSlashes(url.trim());
  if (!cleanUrl) return [];

  if (/^https?:\/\//i.test(cleanUrl)) {
    return [cleanUrl];
  }

  const protocols = looksLikeLocalAddress(cleanUrl)
    ? ['http://', 'https://']
    : ['https://', 'http://'];
  return protocols.map((protocol) => `${protocol}${cleanUrl}`);
}

export function getSavedServerUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) || '';
}

export function saveServerUrl(url: string): string {
  const [cleanUrl = ''] = getServerUrlCandidates(url);
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
  const candidates = getServerUrlCandidates(url);
  if (candidates.length === 0) {
    return { success: false, error: 'Por favor, introduce la IP o dirección URL de tu servidor.' };
  }

  let lastResult: ServerConnectionResult | null = null;
  for (const cleanUrl of candidates) {
    try {
      const token = localStorage.getItem('cta_session_token');
      const headers: Record<string, string> = {};
      if (token) headers['x-session-token'] = token;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      let res: Response;
      try {
        res = await fetch(`${cleanUrl}/api/auth/status`, {
          headers,
          signal: controller.signal,
          cache: 'no-store',
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        lastResult = {
          success: false,
          error: `El servidor respondió con el código HTTP ${res.status}.`,
          url: cleanUrl,
        };
        continue;
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
        lastResult = {
          success: false,
          error: 'Tiempo de espera agotado (6s). Verifica que la IP y el puerto sean correctos y estés en la misma red.',
          url: cleanUrl,
        };
      } else if (Capacitor.isNativePlatform() && cleanUrl.startsWith('http://')) {
        lastResult = {
          success: false,
          error: 'Android no pudo acceder al servidor HTTP local. Comprueba que el teléfono esté en la misma red Wi-Fi, que no exista aislamiento entre dispositivos y que la dirección se abra en el navegador del teléfono.',
          url: cleanUrl,
        };
      } else {
        lastResult = {
          success: false,
          error: 'No se pudo conectar con el servidor. Revisa la IP/puerto y asegúrate de que Docker o el servidor estén activos.',
          url: cleanUrl,
        };
      }
    }
  }

  return lastResult || { success: false, error: 'No se pudo conectar con el servidor.' };
}
