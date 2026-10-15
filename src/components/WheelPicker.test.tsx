// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { WheelPicker } from './WheelPicker';
import { LanguageProvider } from '../i18n/LanguageContext';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

async function renderWheel(onChangeSystolic = vi.fn()) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(
    <LanguageProvider language="es">
      <WheelPicker
        systolic={120}
        diastolic={80}
        heartRate={60}
        onChangeSystolic={onChangeSystolic}
        onChangeDiastolic={vi.fn()}
        onChangeHeartRate={vi.fn()}
      />
    </LanguageProvider>
  ));
  return onChangeSystolic;
}

beforeEach(() => vi.useFakeTimers());
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
  vi.useRealTimers();
});

it('emits only the nearest value once after scrolling settles and aligns it exactly', async () => {
  const onChangeSystolic = await renderWheel();
  const column = host.querySelector('.wheel-tumbler-container') as HTMLDivElement;
  await act(async () => {
    vi.advanceTimersByTime(50);
  });
  onChangeSystolic.mockClear();

  await act(async () => {
    column.scrollTop = 62.1 * 40;
    column.dispatchEvent(new Event('scroll', { bubbles: true }));
    column.scrollTop = 63.2 * 40;
    column.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  expect(onChangeSystolic).not.toHaveBeenCalled();

  await act(async () => {
    vi.advanceTimersByTime(150);
  });

  expect(onChangeSystolic).toHaveBeenCalledTimes(1);
  expect(onChangeSystolic).toHaveBeenCalledWith(123);
  expect(column.scrollTop).toBe(63 * 40);
});

it('does not emit the displayed reference value without user interaction', async () => {
  const onChangeSystolic = await renderWheel();

  await act(async () => {
    vi.runAllTimers();
  });

  expect(onChangeSystolic).not.toHaveBeenCalled();
});

it('selects and aligns a clicked item exactly', async () => {
  const onChangeSystolic = await renderWheel();
  const column = host.querySelector('.wheel-tumbler-container') as HTMLDivElement;
  const item = Array.from(column.querySelectorAll('.wheel-item'))
    .find((candidate) => candidate.textContent === '125') as HTMLDivElement;

  await act(async () => {
    vi.runAllTimers();
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(onChangeSystolic).toHaveBeenCalledTimes(1);
  expect(onChangeSystolic).toHaveBeenCalledWith(125);
  expect(column.scrollTop).toBe(65 * 40);
});

it('emits a reference value when the user explicitly clicks it', async () => {
  const onChangeSystolic = await renderWheel();
  const column = host.querySelector('.wheel-tumbler-container') as HTMLDivElement;
  const item = Array.from(column.querySelectorAll('.wheel-item'))
    .find((candidate) => candidate.textContent === '120') as HTMLDivElement;

  await act(async () => {
    vi.runAllTimers();
    item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(onChangeSystolic).toHaveBeenCalledOnce();
  expect(onChangeSystolic).toHaveBeenCalledWith(120);
  expect(column.scrollTop).toBe(60 * 40);
});

it('does not realign from a parent value while user scrolling is unsettled', async () => {
  const onChangeSystolic = await renderWheel();
  const column = host.querySelector('.wheel-tumbler-container') as HTMLDivElement;
  await act(async () => {
    vi.runAllTimers();
    column.scrollTop = 62.1 * 40;
    column.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  await act(async () => root.render(
    <LanguageProvider language="es">
      <WheelPicker
        systolic={130}
        diastolic={80}
        heartRate={60}
        onChangeSystolic={onChangeSystolic}
        onChangeDiastolic={vi.fn()}
        onChangeHeartRate={vi.fn()}
      />
    </LanguageProvider>
  ));

  expect(column.scrollTop).toBe(62.1 * 40);
  expect(onChangeSystolic).not.toHaveBeenCalled();

  await act(async () => {
    vi.advanceTimersByTime(120);
  });

  expect(onChangeSystolic).toHaveBeenCalledOnce();
  expect(onChangeSystolic).toHaveBeenCalledWith(122);
  expect(column.scrollTop).toBe(62 * 40);
});

it('exposes the column as a keyboard-operable selector', async () => {
  const onChangeSystolic = await renderWheel();
  const column = host.querySelector('.wheel-tumbler-container') as HTMLDivElement;

  expect(column.getAttribute('role')).toBe('listbox');
  expect(column.tabIndex).toBe(0);
  expect(column.querySelector('[role="option"][aria-selected="true"]')?.textContent).toBe('120');

  await act(async () => {
    column.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  });

  expect(onChangeSystolic).toHaveBeenCalledOnce();
  expect(onChangeSystolic).toHaveBeenCalledWith(121);
  expect(column.scrollTop).toBe((121 - 60) * 40);
});
