// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EditReadingModal } from './EditReadingModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import { DEFAULT_SETTINGS } from '../services/storageService';
import type { BloodPressureReading } from '../types/bloodPressure';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

function changeTextarea(element: HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}
const reading: BloodPressureReading = {
  id: 'r1', timestamp: '2026-01-01T08:00:00.000Z', systolic: 120,
  diastolic: 80, heartRate: 70, arm: 'left', notes: 'original',
};

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
});

async function render(
  onSaveReading: ComponentProps<typeof EditReadingModal>['onSaveReading'],
  onDeleteReading: ComponentProps<typeof EditReadingModal>['onDeleteReading'] = vi.fn(),
) {
  const onClose = vi.fn();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(
    <LanguageProvider language="es">
      <EditReadingModal isOpen reading={reading} settings={DEFAULT_SETTINGS} readings={[reading]}
        onClose={onClose} onSaveReading={onSaveReading} onDeleteReading={onDeleteReading} />
    </LanguageProvider>
  ));
  return { onClose, onDeleteReading };
}

describe('edit reading persistence failures', () => {
  it('keeps the modal and edited values open when saving rejects', async () => {
    const onSaveReading = vi.fn().mockRejectedValue(new Error('offline'));
    const { onClose } = await render(onSaveReading);
    const notes = host.querySelector('#edit-notes') as HTMLTextAreaElement;
    await act(async () => {
      changeTextarea(notes, 'edited value');
      host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect((host.querySelector('#edit-notes') as HTMLTextAreaElement).value).toBe('edited value');
    expect(host.querySelector('.form-error-banner')).not.toBeNull();
  });

  it('does not close after a failed delete', async () => {
    const onDeleteReading = vi.fn().mockRejectedValue(new Error('offline'));
    const { onClose } = await render(vi.fn(), onDeleteReading);
    const button = [...host.querySelectorAll('button')].find((item) => item.textContent?.includes('Eliminar'))!;
    await act(async () => button.click());
    const confirm = [...host.querySelectorAll('button')].find((item) => item.textContent?.includes('Sí, eliminar'))!;
    await act(async () => { confirm.click(); await Promise.resolve(); });

    expect(onDeleteReading).toHaveBeenCalledWith('r1');
    expect(onClose).not.toHaveBeenCalled();
    expect(host.querySelector('.form-error-banner')).not.toBeNull();
  });
});
