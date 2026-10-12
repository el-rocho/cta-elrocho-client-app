// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { ReadingForm } from './ReadingForm';
import { LanguageProvider } from '../i18n/LanguageContext';
import { DEFAULT_SETTINGS } from '../services/storageService';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

function changeValue(element: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
});

it('keeps the entered reading and does not show saved state when persistence rejects', async () => {
  const onAddReading = vi.fn().mockRejectedValue(new Error('offline'));
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(
    <LanguageProvider language="es">
      <ReadingForm onAddReading={onAddReading} settings={DEFAULT_SETTINGS} readings={[]} />
    </LanguageProvider>
  ));

  const systolic = host.querySelector('#systolic-input') as HTMLInputElement;
  const notes = host.querySelector('.input-notes') as HTMLInputElement;
  await act(async () => {
    changeValue(systolic, '135');
    changeValue(notes, 'keep me');
  });
  await act(async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });

  expect(onAddReading).toHaveBeenCalledOnce();
  expect((host.querySelector('#systolic-input') as HTMLInputElement).value).toBe('135');
  expect((host.querySelector('.input-notes') as HTMLInputElement).value).toBe('keep me');
  expect(host.querySelector('.btn-submit-reading')!.classList.contains('is-saved')).toBe(false);
  expect(host.querySelector('.alert-danger')).not.toBeNull();
});
