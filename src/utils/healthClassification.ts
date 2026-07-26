import type { HealthCategoryInfo, HealthSeverity, LanguageOption } from '../types/bloodPressure';
import { getTranslation } from '../i18n/translations';

const BASE_CATEGORIES_STYLE: Record<HealthSeverity, { colorHex: string; badgeBg: string; badgeText: string }> = {
  optimal: {
    colorHex: '#10b981', // Verde esmeralda
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeText: '#059669',
  },
  normal: {
    colorHex: '#3b82f6', // Azul claro
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    badgeText: '#2563eb',
  },
  elevated: {
    colorHex: '#f59e0b', // Ámbar / Amarillo
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeText: '#d97706',
  },
  stage1: {
    colorHex: '#f97316', // Naranja
    badgeBg: 'rgba(249, 115, 22, 0.15)',
    badgeText: '#ea580c',
  },
  stage2: {
    colorHex: '#ef4444', // Rojo
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    badgeText: '#dc2626',
  },
  crisis: {
    colorHex: '#991b1b', // Rojo oscuro / Púrpura
    badgeBg: 'rgba(153, 27, 27, 0.2)',
    badgeText: '#991b1b',
  },
};

export function getHealthCategoriesMap(lang: LanguageOption = 'es'): Record<HealthSeverity, HealthCategoryInfo> {
  const keys: HealthSeverity[] = ['optimal', 'normal', 'elevated', 'stage1', 'stage2', 'crisis'];
  const map = {} as Record<HealthSeverity, HealthCategoryInfo>;

  keys.forEach((key) => {
    map[key] = {
      key,
      name: getTranslation(lang, `trend.categories.${key}.name`),
      description: getTranslation(lang, `trend.categories.${key}.desc`),
      ...BASE_CATEGORIES_STYLE[key],
    };
  });

  return map;
}

export const HEALTH_CATEGORIES = getHealthCategoriesMap('es');

/**
 * Clasifica una lectura de tensión arterial según las guías estándar OMS/AHA/ESH.
 */
export function getHealthCategory(systolic: number, diastolic: number, lang: LanguageOption = 'es'): HealthCategoryInfo {
  const categories = getHealthCategoriesMap(lang);

  if (systolic >= 180 || diastolic >= 110) {
    return categories.crisis;
  }
  if ((systolic >= 160 && systolic < 180) || (diastolic >= 100 && diastolic < 110)) {
    return categories.stage2;
  }
  if ((systolic >= 140 && systolic < 160) || (diastolic >= 90 && diastolic < 100)) {
    return categories.stage1;
  }
  if ((systolic >= 130 && systolic < 140) || (diastolic >= 85 && diastolic < 90)) {
    return categories.elevated;
  }
  if ((systolic >= 120 && systolic < 130) || (diastolic >= 80 && diastolic < 85)) {
    return categories.normal;
  }
  return categories.optimal;
}
