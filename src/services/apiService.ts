import type { BloodPressureReading, AppSettings } from '../types/bloodPressure';
import { getSavedServerUrl } from './serverConfigService';

function getApiBase(): string {
  const serverUrl = getSavedServerUrl();
  return serverUrl ? `${serverUrl}/api` : '/api';
}

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  const token = localStorage.getItem('cta_session_token');
  if (token) {
    headers['x-session-token'] = token;
  }
  return headers;
}

const INITIAL_DEMO_READINGS: BloodPressureReading[] = [
  {
    id: 'demo-100',
    timestamp: new Date().toISOString(),
    systolic: 120,
    diastolic: 80,
    heartRate: 72,
    arm: 'left',
    notes: 'Medición habitual de control',
  },
  {
    id: 'demo-5',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    systolic: 124,
    diastolic: 81,
    heartRate: 70,
    arm: 'left',
    notes: 'Mañana en ayunas',
  },
  {
    id: 'demo-4',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    systolic: 118,
    diastolic: 78,
    heartRate: 69,
    arm: 'left',
    notes: 'Tras reposo',
  },
];

export async function fetchReadingsAPI(): Promise<BloodPressureReading[]> {
  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/readings`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error de servidor al cargar lecturas');
    const data = await res.json();
    localStorage.setItem('server_bp_readings_cache', JSON.stringify(data));
    return data;
  } catch (error) {
    console.warn('Servidor local no alcanzable, usando almacenamiento en caché local:', error);
    const cached = localStorage.getItem('server_bp_readings_cache');
    return cached ? JSON.parse(cached) : INITIAL_DEMO_READINGS;
  }
}

export async function addReadingAPI(reading: Omit<BloodPressureReading, 'id'>): Promise<BloodPressureReading> {
  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/readings`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(reading),
    });
    if (!res.ok) throw new Error('Error al guardar lectura en el servidor');
    return await res.json();
  } catch (error) {
    const created: BloodPressureReading = {
      ...reading,
      id: `bp-local-${Date.now()}`,
    };
    const cached = localStorage.getItem('server_bp_readings_cache');
    const current = cached ? JSON.parse(cached) : INITIAL_DEMO_READINGS;
    const updated = [created, ...current];
    localStorage.setItem('server_bp_readings_cache', JSON.stringify(updated));
    return created;
  }
}

export async function deleteReadingAPI(id: string): Promise<void> {
  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/readings/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al eliminar lectura en el servidor');
  } catch (error) {
    const cached = localStorage.getItem('server_bp_readings_cache');
    if (cached) {
      const current: BloodPressureReading[] = JSON.parse(cached);
      const updated = current.filter((r) => r.id !== id);
      localStorage.setItem('server_bp_readings_cache', JSON.stringify(updated));
    }
  }
}

export async function deleteSessionAPI(readingIds: string[]): Promise<void> {
  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/sessions/delete`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ readingIds }),
    });
    if (!res.ok) throw new Error('Error al eliminar sesión en el servidor');
  } catch (error) {
    const ids = new Set(readingIds);
    const cached = localStorage.getItem('server_bp_readings_cache');
    if (cached) {
      const current: BloodPressureReading[] = JSON.parse(cached);
      const updated = current.filter((r) => !ids.has(r.id));
      localStorage.setItem('server_bp_readings_cache', JSON.stringify(updated));
    }
  }
}

export async function clearAllDataAPI(): Promise<void> {
  try {
    const apiBase = getApiBase();
    await fetch(`${apiBase}/readings/all/confirm`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
  } catch (error) {
    console.warn('Servidor offline al borrar todo:', error);
  }
  localStorage.removeItem('server_bp_readings_cache');
}

export async function resetDemoDataAPI(): Promise<BloodPressureReading[]> {
  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/readings/reset-demo`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al restaurar datos demo en el servidor');
    const data = await res.json();
    localStorage.setItem('server_bp_readings_cache', JSON.stringify(data));
    return data;
  } catch (error) {
    localStorage.setItem('server_bp_readings_cache', JSON.stringify(INITIAL_DEMO_READINGS));
    return INITIAL_DEMO_READINGS;
  }
}

export async function importReadingsAPI(imported: Omit<BloodPressureReading, 'id'>[]): Promise<{ addedCount: number; readings: BloodPressureReading[] }> {
  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/readings/import`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(imported),
    });
    if (!res.ok) throw new Error('Error al importar lecturas en el servidor');
    const result = await res.json();
    localStorage.setItem('server_bp_readings_cache', JSON.stringify(result.readings));
    return result;
  } catch (error) {
    const cached = localStorage.getItem('server_bp_readings_cache');
    const current: BloodPressureReading[] = cached ? JSON.parse(cached) : INITIAL_DEMO_READINGS;
    let addedCount = 0;
    const newItems: BloodPressureReading[] = [];
    const existingSigs = new Set(current.map((r) => `${new Date(r.timestamp).toISOString().slice(0, 16)}_${r.systolic}_${r.diastolic}_${r.heartRate}`));
    imported.forEach((item) => {
      const sig = `${new Date(item.timestamp).toISOString().slice(0, 16)}_${item.systolic}_${item.diastolic}_${item.heartRate}`;
      if (!existingSigs.has(sig)) {
        existingSigs.add(sig);
        addedCount++;
        newItems.push({ ...item, id: `imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}` });
      }
    });
    const updated = [...newItems, ...current];
    localStorage.setItem('server_bp_readings_cache', JSON.stringify(updated));
    return { addedCount, readings: updated };
  }
}

export async function fetchSettingsAPI(): Promise<AppSettings> {
  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/settings`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error de servidor al cargar ajustes');
    return await res.json();
  } catch (error) {
    const cached = localStorage.getItem('server_bp_settings_cache');
    return cached ? JSON.parse(cached) : {
      language: 'es',
      enableWhiteCoatFilter: false,
      whiteCoatIntervalMinutes: 5,
      defaultArm: 'left',
      preferredInputMode: 'keyboard',
      patientName: '',
      patientSex: '',
      patientAge: '',
      backupFrequency: 'disabled',
      backupFolder: 'Descargas/Copias_Tension_Arterial',
    };
  }
}

export async function saveSettingsAPI(settings: AppSettings): Promise<AppSettings> {
  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/settings`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Error al guardar ajustes en el servidor');
    const saved = await res.json();
    localStorage.setItem('server_bp_settings_cache', JSON.stringify(saved));
    return saved;
  } catch (error) {
    localStorage.setItem('server_bp_settings_cache', JSON.stringify(settings));
    return settings;
  }
}

export async function generateServerBackupAPI(csvContent: string, filenamePrefix: string): Promise<{ success: boolean; filename: string; timestamp: string }> {
  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/backups/generate`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ csvContent, filenamePrefix }),
    });
    if (!res.ok) throw new Error('Error al enviar copia de seguridad al servidor');
    return await res.json();
  } catch (error) {
    console.warn('No se pudo guardar la copia física en el servidor:', error);
    return { success: false, filename: '', timestamp: new Date().toISOString() };
  }
}
