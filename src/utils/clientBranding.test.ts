import { describe, expect, it } from 'vitest';
import logoLightSvgRaw from '../assets/app-logo.svg?raw';
import logoDarkSvgRaw from '../assets/app-logo-dark.svg?raw';
import { getTranslation } from '../i18n/translations';

describe('client application branding', () => {
  it('identifies the client edition without claiming offline storage', () => {
    expect(getTranslation('es', 'header.badgeClient')).toBe('Cliente autoalojado');
    expect(getTranslation('en', 'header.badgeClient')).toBe('Self-hosted client');
    expect(getTranslation('es', 'header.badgeClient')).not.toContain('Offline');
  });

  it('uses the self-hosted logo in both themes', () => {
    expect(logoLightSvgRaw).toContain('id="Servidor"');
    expect(logoDarkSvgRaw).toContain('id="Servidor"');
  });
});
