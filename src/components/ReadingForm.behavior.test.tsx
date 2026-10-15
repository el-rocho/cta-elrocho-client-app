// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
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

function deferredSave() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function renderForm(
  onAddReading = vi.fn(),
  settings = DEFAULT_SETTINGS
) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(
    <LanguageProvider language="es">
      <ReadingForm onAddReading={onAddReading} settings={settings} readings={[]} />
    </LanguageProvider>
  ));
  return onAddReading;
}

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
  vi.useRealTimers();
});

const validationDialog = () => document.body.querySelector<HTMLElement>('.form-alert-dialog');
const pulsePressureDialog = () => document.body.querySelector<HTMLElement>('.pulse-pressure-dialog');

it('labels the primary action as Registrar medición', async () => {
  await renderForm();

  expect(host.querySelector<HTMLButtonElement>('.btn-submit-reading')?.textContent).toContain(
    'Registrar medición'
  );
});

it('starts with empty numeric fields and reference placeholders', async () => {
  await renderForm();

  const systolic = host.querySelector('#systolic-input') as HTMLInputElement;
  const diastolic = host.querySelector('#diastolic-input') as HTMLInputElement;
  const pulse = host.querySelector('#pulse-input') as HTMLInputElement;

  expect([systolic.value, diastolic.value, pulse.value]).toEqual(['', '', '']);
  expect([systolic.placeholder, diastolic.placeholder, pulse.placeholder]).toEqual(['115', '65', '60']);
});

it('rejects an empty submission with a modal notice and without adding a reading', async () => {
  const onAddReading = await renderForm();

  await act(async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  expect(onAddReading).not.toHaveBeenCalled();
  expect(host.querySelector('.alert-danger')).toBeNull();
  expect(validationDialog()!.querySelector('.form-alert-message')?.textContent).toBe(
    'Introduce valores Sistólica, Diastólica y Pulso'
  );
});

it('closes the missing-values modal with its button and with Escape', async () => {
  await renderForm();

  await act(async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(validationDialog()!.contains(document.activeElement)).toBe(true);
  await act(async () => {
    validationDialog()!.querySelector<HTMLButtonElement>('.btn-alert-accept')!.click();
  });
  expect(validationDialog()).toBeNull();

  await act(async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(validationDialog()!.contains(document.activeElement)).toBe(true);
  await act(async () => {
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  expect(validationDialog()).toBeNull();
});

it('closes the missing-values modal by clicking outside its content', async () => {
  await renderForm();

  await act(async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    validationDialog()!.parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(validationDialog()).toBeNull();
});

it('makes the background form inert while a dialog is open', async () => {
  await renderForm();
  const form = host.querySelector('form')!;
  expect(form.hasAttribute('inert')).toBe(false);

  await act(async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(form.hasAttribute('inert')).toBe(true);

  await act(async () => {
    validationDialog()!.querySelector<HTMLButtonElement>('.btn-alert-accept')!.click();
  });
  expect(form.hasAttribute('inert')).toBe(false);
});

it('moves the focus into the cuff modal and closes it with Escape', async () => {
  await renderForm();
  await act(async () => {
    changeValue(host.querySelector('#systolic-input') as HTMLInputElement, '180');
    changeValue(host.querySelector('#diastolic-input') as HTMLInputElement, '60');
    changeValue(host.querySelector('#pulse-input') as HTMLInputElement, '70');
    host.querySelector<HTMLFormElement>('form')!.requestSubmit();
  });

  expect(pulsePressureDialog()!.contains(document.activeElement)).toBe(true);

  await act(async () => {
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  expect(pulsePressureDialog()).toBeNull();
  expect((host.querySelector('#systolic-input') as HTMLInputElement).value).toBe('180');
});

it('keeps the cuff modal open when the overlay is clicked during a save', async () => {
  const save = deferredSave();
  await renderForm(vi.fn(() => save.promise));
  await act(async () => {
    changeValue(host.querySelector('#systolic-input') as HTMLInputElement, '180');
    changeValue(host.querySelector('#diastolic-input') as HTMLInputElement, '60');
    changeValue(host.querySelector('#pulse-input') as HTMLInputElement, '70');
    host.querySelector<HTMLFormElement>('form')!.requestSubmit();
  });
  await act(async () => pulsePressureDialog()!.querySelector<HTMLButtonElement>('.btn-force-save')!.click());
  await act(async () => {
    pulsePressureDialog()!.parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(pulsePressureDialog()).not.toBeNull();

  await act(async () => {
    save.resolve();
    await save.promise;
  });
});

it('explains a diastolic value that is not lower than the systolic one in the modal', async () => {
  const onAddReading = await renderForm();
  await act(async () => {
    changeValue(host.querySelector('#systolic-input') as HTMLInputElement, '80');
    changeValue(host.querySelector('#diastolic-input') as HTMLInputElement, '90');
    changeValue(host.querySelector('#pulse-input') as HTMLInputElement, '70');
    host.querySelector<HTMLFormElement>('form')!.requestSubmit();
  });

  expect(onAddReading).not.toHaveBeenCalled();
  expect(validationDialog()!.querySelector('.form-alert-message')?.textContent).toBe(
    'La presión diastólica debe ser menor que la sistólica. Revisa los valores: esta medición no se puede guardar.'
  );
});

it('labels a very high reading with the plain hypertension name', async () => {
  await renderForm();
  await act(async () => {
    changeValue(host.querySelector('#systolic-input') as HTMLInputElement, '200');
    changeValue(host.querySelector('#diastolic-input') as HTMLInputElement, '120');
    changeValue(host.querySelector('#pulse-input') as HTMLInputElement, '70');
  });

  const pill = host.querySelector('.reading-alerts-row .clinical-alert-pill');
  expect(pill?.getAttribute('data-alert-key')).toBe('extremeHighPressure');
  expect(pill?.querySelector('.health-alert-name')?.textContent).toBe('Hipertensión grave (200/120)');
  // El aviso de urgencia no cabe en un desplegable que caduca: la etiqueta queda
  // sin texto propio y, por tanto, sin capa desplegable.
  expect(pill?.closest('details')).toBeNull();
  expect(host.querySelector('.clinical-alert-popover')).toBeNull();
  expect(host.querySelector('.reading-info-area')?.textContent).not.toContain('112');
});

it('keeps the previous assessment while a partial value is typed and updates it when plausible', async () => {
  await renderForm();
  await act(async () => {
    changeValue(host.querySelector('#systolic-input') as HTMLInputElement, '200');
    changeValue(host.querySelector('#diastolic-input') as HTMLInputElement, '80');
    changeValue(host.querySelector('#pulse-input') as HTMLInputElement, '70');
  });

  const alertKey = () => host.querySelector('.reading-alerts-row .clinical-alert-pill')?.getAttribute('data-alert-key');
  expect(alertKey()).toBe('extremeHighPressure');

  await act(async () => changeValue(host.querySelector('#systolic-input') as HTMLInputElement, '2'));
  expect(alertKey()).toBe('extremeHighPressure');

  await act(async () => changeValue(host.querySelector('#systolic-input') as HTMLInputElement, '20'));
  expect(alertKey()).toBe('extremeHighPressure');

  await act(async () => changeValue(host.querySelector('#systolic-input') as HTMLInputElement, '120'));
  expect(alertKey()).not.toBe('extremeHighPressure');
});

it('keeps the last valid assessment until the whole combination is valid again', async () => {
  await renderForm();
  await act(async () => {
    changeValue(host.querySelector('#systolic-input') as HTMLInputElement, '200');
    changeValue(host.querySelector('#diastolic-input') as HTMLInputElement, '80');
    changeValue(host.querySelector('#pulse-input') as HTMLInputElement, '70');
  });

  const alertKey = () => host.querySelector('.reading-alerts-row .clinical-alert-pill')?.getAttribute('data-alert-key');
  expect(alertKey()).toBe('extremeHighPressure');

  await act(async () => changeValue(host.querySelector('#systolic-input') as HTMLInputElement, '70'));
  expect(alertKey()).toBe('extremeHighPressure');

  await act(async () => changeValue(host.querySelector('#diastolic-input') as HTMLInputElement, '50'));
  expect(alertKey()).not.toBe('extremeHighPressure');
});

it('does not truncate decimals or use them to update the assessment', async () => {
  await renderForm();
  await act(async () => {
    changeValue(host.querySelector('#systolic-input') as HTMLInputElement, '200');
    changeValue(host.querySelector('#diastolic-input') as HTMLInputElement, '80');
    changeValue(host.querySelector('#pulse-input') as HTMLInputElement, '70');
  });

  const alertKey = () => host.querySelector('.reading-alerts-row .clinical-alert-pill')?.getAttribute('data-alert-key');

  await act(async () => changeValue(host.querySelector('#systolic-input') as HTMLInputElement, '49.5'));
  expect((host.querySelector('#systolic-input') as HTMLInputElement).value).toBe('49.5');
  expect(alertKey()).toBe('extremeHighPressure');

  await act(async () => changeValue(host.querySelector('#systolic-input') as HTMLInputElement, '120'));
  expect(alertKey()).not.toBe('extremeHighPressure');
});

it('does not save the wheel reference values until the user selects them', async () => {
  const onAddReading = await renderForm(vi.fn(), { ...DEFAULT_SETTINGS, preferredInputMode: 'wheel' });
  expect(host.querySelectorAll('.wheel-item.selected.reference')).toHaveLength(3);
  await act(async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  expect(onAddReading).not.toHaveBeenCalled();
  expect(validationDialog()!.querySelector('.form-alert-message')?.textContent).toBe(
    'Introduce valores Sistólica, Diastólica y Pulso'
  );
});

it('saves wheel reference values after the user selects every column', async () => {
  const onAddReading = await renderForm(
    vi.fn().mockResolvedValue(undefined),
    { ...DEFAULT_SETTINGS, preferredInputMode: 'wheel' }
  );
  const columns = Array.from(host.querySelectorAll('.wheel-tumbler-container'));
  const references = ['115', '65', '60'];
  await act(async () => {
    columns.forEach((column, index) => {
      const item = Array.from(column.querySelectorAll('.wheel-item'))
        .find((candidate) => candidate.textContent === references[index]) as HTMLDivElement;
      item.click();
    });
  });
  expect(host.querySelectorAll('.wheel-item.selected.reference')).toHaveLength(0);
  await act(async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });

  expect(onAddReading).toHaveBeenCalledWith(expect.objectContaining({
    systolic: 115,
    diastolic: 65,
    heartRate: 60,
  }));
});

it('clears the numeric fields after a reading is saved', async () => {
  const onAddReading = await renderForm(vi.fn().mockResolvedValue(undefined));
  const systolic = host.querySelector('#systolic-input') as HTMLInputElement;
  const diastolic = host.querySelector('#diastolic-input') as HTMLInputElement;
  const pulse = host.querySelector('#pulse-input') as HTMLInputElement;

  await act(async () => {
    changeValue(systolic, '130');
    changeValue(diastolic, '85');
    changeValue(pulse, '70');
  });
  await act(async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });

  expect(onAddReading).toHaveBeenCalledWith(expect.objectContaining({
    systolic: 130,
    diastolic: 85,
    heartRate: 70,
  }));
  expect([systolic.value, diastolic.value, pulse.value]).toEqual(['', '', '']);
});

it('locks the draft while a save is pending', async () => {
  const save = deferredSave();
  await renderForm(vi.fn(() => save.promise));
  const systolic = host.querySelector('#systolic-input') as HTMLInputElement;
  const diastolic = host.querySelector('#diastolic-input') as HTMLInputElement;
  const pulse = host.querySelector('#pulse-input') as HTMLInputElement;

  await act(async () => {
    changeValue(systolic, '120');
    changeValue(diastolic, '80');
    changeValue(pulse, '60');
    host.querySelector<HTMLFormElement>('form')!.requestSubmit();
  });
  expect(systolic.disabled).toBe(true);
  await act(async () => changeValue(systolic, '130'));
  expect(systolic.value).toBe('120');

  await act(async () => {
    save.resolve();
    await save.promise;
  });
  expect(systolic.value).toBe('');
});

it('preserves a failed pending save beyond the inactivity timeout', async () => {
  vi.useFakeTimers();
  const save = deferredSave();
  await renderForm(vi.fn(() => save.promise));
  const systolic = host.querySelector('#systolic-input') as HTMLInputElement;
  const diastolic = host.querySelector('#diastolic-input') as HTMLInputElement;
  const pulse = host.querySelector('#pulse-input') as HTMLInputElement;

  await act(async () => {
    changeValue(systolic, '120');
    changeValue(diastolic, '80');
    changeValue(pulse, '60');
    host.querySelector<HTMLFormElement>('form')!.requestSubmit();
  });
  await act(async () => changeValue(systolic, '130'));
  await act(async () => {
    save.reject(new Error('offline'));
    await save.promise.catch(() => undefined);
  });
  await act(async () => vi.advanceTimersByTime(5000));

  expect(systolic.value).toBe('120');
  expect(host.querySelector('.alert-danger')).not.toBeNull();

  await act(async () => changeValue(systolic, '131'));
  await act(async () => vi.advanceTimersByTime(5000));
  expect(systolic.value).toBe('');
});

it('clears an unsaved partial draft after five seconds without changes', async () => {
  vi.useFakeTimers();
  await renderForm();
  const systolic = host.querySelector('#systolic-input') as HTMLInputElement;
  const diastolic = host.querySelector('#diastolic-input') as HTMLInputElement;
  const notes = host.querySelector('.input-notes') as HTMLInputElement;

  await act(async () => {
    changeValue(systolic, '128');
    changeValue(notes, 'no guardar');
    vi.advanceTimersByTime(4000);
  });
  expect([systolic.value, notes.value]).toEqual(['128', 'no guardar']);

  await act(async () => {
    changeValue(diastolic, '82');
    vi.advanceTimersByTime(4999);
  });
  expect([systolic.value, diastolic.value, notes.value]).toEqual(['128', '82', 'no guardar']);

  await act(async () => vi.advanceTimersByTime(1));
  expect([systolic.value, diastolic.value, notes.value]).toEqual(['', '', '']);
});

it('clears an unsaved wheel selection after five seconds', async () => {
  vi.useFakeTimers();
  await renderForm(vi.fn(), { ...DEFAULT_SETTINGS, preferredInputMode: 'wheel' });

  await act(async () => host.querySelector<HTMLDivElement>('.wheel-item.selected')!.click());
  expect(host.querySelectorAll('.wheel-item.selected.reference')).toHaveLength(2);

  await act(async () => vi.advanceTimersByTime(5000));
  expect(host.querySelectorAll('.wheel-item.selected.reference')).toHaveLength(3);
});

it('keeps the cuff-confirmation modal and the values while the user decides', async () => {
  vi.useFakeTimers();
  await renderForm();
  const systolic = host.querySelector('#systolic-input') as HTMLInputElement;
  const diastolic = host.querySelector('#diastolic-input') as HTMLInputElement;
  const pulse = host.querySelector('#pulse-input') as HTMLInputElement;

  await act(async () => {
    changeValue(systolic, '180');
    changeValue(diastolic, '60');
    changeValue(pulse, '70');
    host.querySelector<HTMLFormElement>('form')!.requestSubmit();
  });
  expect(pulsePressureDialog()).not.toBeNull();

  await act(async () => vi.advanceTimersByTime(30000));

  expect(pulsePressureDialog()).not.toBeNull();
  expect([systolic.value, diastolic.value, pulse.value]).toEqual(['180', '60', '70']);
});

it('restarts the inactivity cleanup after the cuff modal is dismissed', async () => {
  vi.useFakeTimers();
  await renderForm();
  const systolic = host.querySelector('#systolic-input') as HTMLInputElement;
  const diastolic = host.querySelector('#diastolic-input') as HTMLInputElement;
  const pulse = host.querySelector('#pulse-input') as HTMLInputElement;

  await act(async () => {
    changeValue(systolic, '180');
    changeValue(diastolic, '60');
    changeValue(pulse, '70');
    host.querySelector<HTMLFormElement>('form')!.requestSubmit();
  });
  await act(async () => {
    pulsePressureDialog()!.querySelector<HTMLButtonElement>('.btn-cancel-warning')!.click();
  });

  expect(pulsePressureDialog()).toBeNull();
  expect(systolic.value).toBe('180');

  await act(async () => vi.advanceTimersByTime(5000));
  expect(systolic.value).toBe('');
});

it('blocks the pulse-pressure confirmation buttons while a save is pending', async () => {
  const save = deferredSave();
  await renderForm(vi.fn(() => save.promise));
  const systolic = host.querySelector('#systolic-input') as HTMLInputElement;
  const diastolic = host.querySelector('#diastolic-input') as HTMLInputElement;
  const pulse = host.querySelector('#pulse-input') as HTMLInputElement;

  await act(async () => {
    changeValue(systolic, '180');
    changeValue(diastolic, '60');
    changeValue(pulse, '70');
    host.querySelector<HTMLFormElement>('form')!.requestSubmit();
  });
  await act(async () => pulsePressureDialog()!.querySelector<HTMLButtonElement>('.btn-force-save')!.click());

  expect(pulsePressureDialog()!.querySelector<HTMLButtonElement>('.btn-force-save')!.disabled).toBe(true);
  expect(pulsePressureDialog()!.querySelector<HTMLButtonElement>('.btn-cancel-warning')!.disabled).toBe(true);

  await act(async () => {
    save.resolve();
    await save.promise;
  });
});

it('does not unlock the form through the previous save feedback timer', async () => {
  vi.useFakeTimers();
  const first = deferredSave();
  const second = deferredSave();
  const onAddReading = vi.fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const renderWithSession = (sessionResetToken: number) => act(async () => root.render(
    <LanguageProvider language="es">
      <ReadingForm
        onAddReading={onAddReading}
        settings={DEFAULT_SETTINGS}
        readings={[]}
        sessionResetToken={sessionResetToken}
      />
    </LanguageProvider>
  ));

  await renderWithSession(1);
  const systolic = host.querySelector('#systolic-input') as HTMLInputElement;
  const diastolic = host.querySelector('#diastolic-input') as HTMLInputElement;
  const pulse = host.querySelector('#pulse-input') as HTMLInputElement;
  await act(async () => {
    changeValue(systolic, '120');
    changeValue(diastolic, '80');
    changeValue(pulse, '60');
    host.querySelector<HTMLFormElement>('form')!.requestSubmit();
  });
  await act(async () => {
    first.resolve();
    await first.promise;
  });

  await renderWithSession(2);
  await act(async () => {
    changeValue(systolic, '130');
    changeValue(diastolic, '85');
    changeValue(pulse, '70');
    host.querySelector<HTMLFormElement>('form')!.requestSubmit();
  });

  await act(async () => vi.advanceTimersByTime(1100));

  expect(systolic.disabled).toBe(true);
  await act(async () => changeValue(systolic, '140'));
  expect(systolic.value).toBe('130');

  await act(async () => {
    second.resolve();
    await second.promise;
  });
});

it('keeps one primary alert in the reserved row and summarizes additional alerts', async () => {
  await renderForm(vi.fn(), { ...DEFAULT_SETTINGS, showInformationalLabels: true });
  const systolic = host.querySelector('#systolic-input') as HTMLInputElement;
  const diastolic = host.querySelector('#diastolic-input') as HTMLInputElement;
  const pulse = host.querySelector('#pulse-input') as HTMLInputElement;

  await act(async () => {
    changeValue(systolic, '80');
    changeValue(diastolic, '65');
    changeValue(pulse, '70');
  });

  expect(host.querySelectorAll('.reading-alerts-row .clinical-alert-pill')).toHaveLength(1);
  expect(host.querySelector('.health-alert-count')).toBeNull();

  await act(async () => {
    changeValue(systolic, '85');
    changeValue(diastolic, '55');
    changeValue(pulse, '105');
  });

  expect(host.querySelectorAll('.reading-alerts-row .clinical-alert-pill')).toHaveLength(1);
  expect(host.querySelector('.reading-alerts-row .clinical-alert-pill')?.getAttribute('data-alert-key')).toBe('hypotensionTachycardia');
  expect(host.querySelector('.health-alert-count')?.textContent).toBe('+2');
  expect(host.querySelector('.reading-info-area')?.contains(host.querySelector('.reading-alerts-row'))).toBe(true);
  const details = host.querySelector<HTMLDetailsElement>('.clinical-alert-details');
  expect(details).not.toBeNull();
  expect(details!.querySelector('.clinical-alert-popover')?.textContent).toContain('repite la medición');
});

it('groups the header blocks reserving two informative labels and two buttons', async () => {
  await renderForm(vi.fn(), { ...DEFAULT_SETTINGS, showInformationalLabels: true });

  const badges = Array.from(host.querySelectorAll('.classification-badges > *'));
  expect(badges).toHaveLength(2);
  expect(badges[1].classList.contains('is-placeholder')).toBe(true);
  expect(badges[1].getAttribute('aria-hidden')).toBe('true');

  expect(host.querySelectorAll('.form-controls-wrapper .btn-switch')).toHaveLength(2);
});

it('keeps compact controls in the title row and one information row below save', async () => {
  await renderForm(vi.fn(), { ...DEFAULT_SETTINGS, showInformationalLabels: true });
  const header = host.querySelector('.form-header')!;
  expect(header.querySelector('.form-title-left')).not.toBeNull();
  expect(header.querySelector('.form-controls-wrapper')).not.toBeNull();
  expect(header.querySelector('.classification-badges')).toBeNull();
  expect(header.querySelector<HTMLButtonElement>('.arm-chip')!.textContent).toBe('Izq.');
  expect(header.querySelector<HTMLButtonElement>('.btn-mode-chip')!.textContent).toBe('');
  expect(header.querySelector('.btn-mode-chip svg')).not.toBeNull();
  const infoArea = host.querySelector('.reading-info-area')!;
  // Una sola fila con los dos grupos; los avisos van antes que las etiquetas, así
  // que al no caber el bloque de etiquetas cae debajo del aviso.
  expect(Array.from(infoArea.children).map((child) => child.className.split(' ')[0])).toEqual([
    'reading-alerts-row',
    'reading-labels-row',
  ]);
  expect(infoArea.querySelector('.reading-info-row')).toBeNull();
  expect(infoArea.previousElementSibling?.classList.contains('reading-submit-row')).toBe(true);
});

it('does not reserve the target slot when the treatment target is shown', async () => {
  await renderForm(vi.fn(), {
    ...DEFAULT_SETTINGS,
    showInformationalLabels: true,
    takesAntihypertensiveMedication: true,
  });

  const badges = Array.from(host.querySelectorAll('.classification-badges > *'));
  expect(badges).toHaveLength(2);
  expect(badges.some((badge) => badge.classList.contains('is-placeholder'))).toBe(false);
});

it('ignores a late failure from the previous session without warning the new user', async () => {
  const save = deferredSave();
  const onAddReading = vi.fn(() => save.promise);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const renderWithSession = (sessionResetToken: number) => act(async () => root.render(
    <LanguageProvider language="es">
      <ReadingForm
        onAddReading={onAddReading}
        settings={DEFAULT_SETTINGS}
        readings={[]}
        sessionResetToken={sessionResetToken}
      />
    </LanguageProvider>
  ));

  await renderWithSession(1);
  await act(async () => {
    changeValue(host.querySelector('#systolic-input') as HTMLInputElement, '120');
    changeValue(host.querySelector('#diastolic-input') as HTMLInputElement, '80');
    changeValue(host.querySelector('#pulse-input') as HTMLInputElement, '60');
    host.querySelector<HTMLFormElement>('form')!.requestSubmit();
  });

  await renderWithSession(2);
  await act(async () => {
    changeValue(host.querySelector('#systolic-input') as HTMLInputElement, '130');
    save.reject(new Error('offline'));
    await save.promise.catch(() => undefined);
  });

  expect((host.querySelector('#systolic-input') as HTMLInputElement).value).toBe('130');
  expect(host.querySelector('.alert-danger')).toBeNull();
});
