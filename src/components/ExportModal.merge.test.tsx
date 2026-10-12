// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import type { ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ExportModal } from './ExportModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import { DEFAULT_SETTINGS, StorageServiceError } from '../services/storageService';
import { createBackupSnapshot } from '../utils/backupService';

const snapshot = createBackupSnapshot([{
  id: 'one', timestamp: '2026-01-01T08:00:00.000Z', systolic: 120,
  diastolic: 80, heartRate: 70, arm: 'left',
}], DEFAULT_SETTINGS, '2026-01-02T00:00:00.000Z');
let root: Root;
let host: HTMLDivElement;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
  vi.unstubAllGlobals();
});

const flush = async () => {
  for (let tick = 0; tick < 5; tick += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  }
};

async function renderModal(
  preview: ReturnType<typeof vi.fn>,
  restore: ReturnType<typeof vi.fn>,
  language: 'es' | 'en' = 'es',
  importReadings: ComponentProps<typeof ExportModal>['onImportReadings'] = vi.fn().mockResolvedValue(0),
) {
  host = document.createElement('div'); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(
    <LanguageProvider language={language}>
      <ExportModal isOpen onClose={() => {}} sessions={[]} readings={[]} settings={{ ...DEFAULT_SETTINGS, language }}
        onImportReadings={importReadings}
        onPreviewBackupMerge={preview as ComponentProps<typeof ExportModal>['onPreviewBackupMerge']}
        onRestoreBackup={restore as ComponentProps<typeof ExportModal>['onRestoreBackup']}
        onUpdateSettings={() => {}} onTriggerManualBackup={() => {}} />
    </LanguageProvider>
  ));
  await act(async () => { [...host.querySelectorAll('button')].find((button) => button.textContent?.includes(language === 'es' ? 'Importar / Restaurar' : 'Import / Restore'))?.click(); });
  const findButton = (text: string) => [...host.querySelectorAll('button')].find((item) => item.textContent?.includes(text));
  return {
    selectFile: async (content: string = JSON.stringify(snapshot), name = 'copy.json', type = 'application/json') => {
      const input = host.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([content], name, { type });
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });
      await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
      await flush();
    },
    findButton,
    click: async (text: string) => {
      const button = findButton(text);
      expect(button).toBeDefined();
      await act(async () => { button!.click(); });
      await flush();
    },
  };
}

describe('backup merge preview in the import modal', () => {
  it('requests and shows the merge preview automatically as soon as a valid backup is selected, without any confirmation step', async () => {
    const preview = vi.fn().mockResolvedValue({ addedCount: 1, duplicateCount: 2, conflictCount: 3, previewToken: 'opaque' });
    const restore = vi.fn();
    const modal = await renderModal(preview, restore);
    await modal.selectFile();

    expect(preview).toHaveBeenCalledOnce();
    expect(preview).toHaveBeenCalledWith(snapshot);
    expect(restore).not.toHaveBeenCalled();
    expect(host.textContent).toMatch(/mediciones añadidas/i);
    expect(host.textContent).toMatch(/duplicadas idénticas/i);
    expect(host.textContent).toMatch(/misma fecha\/hora, datos distintos/i);
    expect(host.textContent).toMatch(/misma fecha y hora pero datos distintos: 3/i);
    expect(host.textContent).toMatch(/se conservarán ambas/i);

    const note = host.querySelector('.import-preview-card .import-preview-note')!;
    expect(note.classList.contains('merge-conflicts')).toBe(true);
    expect(note.querySelector('svg')).not.toBeNull();
    expect(note.textContent).toContain('3');

    const conflictCounter = host.querySelector('.import-preview-card .is-conflict');
    expect(conflictCounter).not.toBeNull();
    expect(conflictCounter!.textContent).toContain('3');

    expect(modal.findButton('Combinar mediciones')).toBeDefined();
    expect(host.textContent).not.toContain('Aceptar y combinar');
  });

  it('applies the merge directly with the preview token when the action is clicked, with no accept step', async () => {
    const preview = vi.fn().mockResolvedValue({ addedCount: 1, duplicateCount: 2, conflictCount: 3, previewToken: 'opaque' });
    const restore = vi.fn().mockResolvedValue({ addedCount: 1, duplicateCount: 2, conflictCount: 3 });
    const modal = await renderModal(preview, restore);
    await modal.selectFile();

    await modal.click('Combinar mediciones');
    expect(restore).toHaveBeenCalledOnce();
    expect(restore).toHaveBeenCalledWith(snapshot, 'merge', 'opaque');
    expect(host.textContent).toMatch(/Combinación completada/);
  });

  it('shows a neutral note and does not write until the action is clicked when there are no conflicts', async () => {
    const preview = vi.fn().mockResolvedValue({ addedCount: 5, duplicateCount: 2, conflictCount: 0, previewToken: 'clean' });
    const restore = vi.fn().mockResolvedValue({ addedCount: 5, duplicateCount: 2, conflictCount: 0 });
    const modal = await renderModal(preview, restore);
    await modal.selectFile();

    expect(restore).not.toHaveBeenCalled();
    expect(host.textContent).toMatch(/Mediciones nuevas: 5/);
    expect(host.textContent).toMatch(/ya existentes omitidas: 2/);

    const note = host.querySelector('.import-preview-card .import-preview-note')!;
    expect(note.classList.contains('merge-conflicts')).toBe(false);
    expect(host.querySelector('.import-preview-card .is-conflict')).toBeNull();

    await modal.click('Combinar mediciones');
    expect(restore).toHaveBeenCalledOnce();
    expect(restore).toHaveBeenCalledWith(snapshot, 'merge', 'clean');
  });

  it('reports the merge totals in English after applying directly', async () => {
    const preview = vi.fn().mockResolvedValue({ addedCount: 1, duplicateCount: 2, conflictCount: 3, previewToken: 'opaque' });
    const restore = vi.fn().mockResolvedValue({ addedCount: 1, duplicateCount: 2, conflictCount: 3 });
    const modal = await renderModal(preview, restore, 'en');
    await modal.selectFile();

    expect(preview).toHaveBeenCalledOnce();
    expect(host.textContent).toMatch(/readings with the same date and time but different data: 3/i);
    await modal.click('Merge readings');
    expect(restore).toHaveBeenCalledWith(snapshot, 'merge', 'opaque');
    expect(host.textContent).toMatch(/added: 1.*duplicates skipped: 2.*different data: 3/i);
  });

  it('shows a checking state and disables the merge action while the preview is in flight', async () => {
    let resolvePreview!: (value: unknown) => void;
    const preview = vi.fn().mockReturnValue(new Promise((resolve) => { resolvePreview = resolve; }));
    const restore = vi.fn();
    const modal = await renderModal(preview, restore);
    await modal.selectFile();

    expect(preview).toHaveBeenCalledOnce();
    expect(host.textContent).toMatch(/Comprobando/i);
    expect(modal.findButton('Combinar mediciones')!.disabled).toBe(true);

    await act(async () => { resolvePreview({ addedCount: 1, duplicateCount: 0, conflictCount: 0, previewToken: 't' }); });
    await flush();
    expect(modal.findButton('Combinar mediciones')!.disabled).toBe(false);
    expect(host.textContent).toMatch(/Mediciones nuevas: 1/);
  });

  it('keeps the file and requires a second click after retrying a failed preview', async () => {
    const preview = vi.fn().mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ addedCount: 0, duplicateCount: 1, conflictCount: 1, previewToken: 'fresh' });
    const restore = vi.fn().mockResolvedValue({ addedCount: 0, duplicateCount: 1, conflictCount: 1 });
    const modal = await renderModal(preview, restore);
    await modal.selectFile();

    expect(preview).toHaveBeenCalledOnce();
    expect(restore).not.toHaveBeenCalled();
    expect(host.textContent).toMatch(/vuelve a previsualizar/i);
    expect(modal.findButton('Combinar mediciones')).toBeDefined();

    await modal.click('Combinar mediciones');
    expect(preview).toHaveBeenCalledTimes(2);
    expect(restore).not.toHaveBeenCalled();
    expect(host.textContent).toMatch(/misma fecha y hora pero datos distintos: 1/i);
    await modal.click('Combinar mediciones');
    expect(restore).toHaveBeenCalledOnce();
    expect(restore).toHaveBeenCalledWith(snapshot, 'merge', 'fresh');
  });

  it('recomputes the preview automatically after a stale-token failure and never writes without a fresh one', async () => {
    const preview = vi.fn()
      .mockResolvedValueOnce({ addedCount: 1, duplicateCount: 0, conflictCount: 1, previewToken: 'old' })
      .mockResolvedValueOnce({ addedCount: 1, duplicateCount: 0, conflictCount: 1, previewToken: 'fresh' });
    const restore = vi.fn().mockRejectedValueOnce(new Error('409'))
      .mockResolvedValueOnce({ addedCount: 1, duplicateCount: 0, conflictCount: 1 });
    const modal = await renderModal(preview, restore);
    await modal.selectFile();
    expect(preview).toHaveBeenCalledOnce();

    await modal.click('Combinar mediciones');
    expect(restore).toHaveBeenCalledOnce();
    expect(restore).toHaveBeenCalledWith(snapshot, 'merge', 'old');
    expect(host.textContent).toMatch(/vuelve a previsualizar/i);
    expect(preview).toHaveBeenCalledTimes(2);

    await modal.click('Combinar mediciones');
    expect(restore).toHaveBeenCalledTimes(2);
    expect(restore).toHaveBeenLastCalledWith(snapshot, 'merge', 'fresh');
  });

  it('does not replace the selected file while a merge is being applied', async () => {
    const preview = vi.fn().mockResolvedValue({ addedCount: 1, duplicateCount: 0, conflictCount: 0, previewToken: 'first' });
    let finishRestore!: (value: unknown) => void;
    const restore = vi.fn().mockReturnValue(new Promise((resolve) => { finishRestore = resolve; }));
    const modal = await renderModal(preview, restore);
    await modal.selectFile();
    await act(async () => { modal.findButton('Combinar mediciones')!.click(); });
    expect(restore).toHaveBeenCalledOnce();
    expect((host.querySelector('input[type="file"]') as HTMLInputElement).disabled).toBe(true);
    expect(modal.findButton('Elegir otro archivo')!.disabled).toBe(true);
    await modal.selectFile(JSON.stringify({ ...snapshot, createdAt: '2026-01-03T00:00:00.000Z' }));
    expect(preview).toHaveBeenCalledOnce();
    await act(async () => { finishRestore({ addedCount: 1, duplicateCount: 0, conflictCount: 0 }); });
    await flush();
    expect(host.textContent).toMatch(/Combinación completada/);
  });

  it('does not request a merge preview for a CSV file', async () => {
    const preview = vi.fn();
    const restore = vi.fn();
    const modal = await renderModal(preview, restore);
    await modal.selectFile('fecha,hora,sistolica,diastolica,pulsacion\n01/01/2026,08:00,120,80,70\n', 'readings.csv', 'text/csv');

    expect(preview).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
  });

  it('keeps a CSV selection and does not show success when import persistence rejects', async () => {
    const importReadings = vi.fn().mockRejectedValue(new Error('offline'));
    const modal = await renderModal(vi.fn(), vi.fn(), 'es', importReadings);
    await modal.selectFile('fecha,hora,sistolica,diastolica,pulsacion\n01/01/2026,08:00,120,80,70\n', 'readings.csv', 'text/csv');

    await modal.click('Confirmar importación');

    expect(importReadings).toHaveBeenCalledOnce();
    expect(modal.findButton('Confirmar importación')).toBeDefined();
    expect(host.querySelector('.import-status-box.error')).not.toBeNull();
    expect(host.querySelector('.import-status-box.success')).toBeNull();
  });

  it('keeps a backup selection and does not show a successful replacement when a phase rejects', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    const modal = await renderModal(
      vi.fn().mockResolvedValue({ addedCount: 1, duplicateCount: 0, conflictCount: 0, previewToken: 'token' }),
      vi.fn().mockRejectedValue(new Error('settings failed')),
    );
    await modal.selectFile();

    await modal.click('Restaurar y reemplazar');

    expect(modal.findButton('Restaurar y reemplazar')).toBeDefined();
    expect(host.querySelector('.import-status-box.error')).not.toBeNull();
    expect(host.textContent).not.toMatch(/Restauradas 0 mediciones/);
  });

  it('does not present zero restored readings as a successful replacement', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    const modal = await renderModal(
      vi.fn().mockResolvedValue({ addedCount: 0, duplicateCount: 0, conflictCount: 0, previewToken: 'token' }),
      vi.fn().mockResolvedValue(0),
    );
    await modal.selectFile();

    await modal.click('Restaurar y reemplazar');

    expect(modal.findButton('Restaurar y reemplazar')).toBeDefined();
    expect(host.querySelector('.import-status-box.error')).not.toBeNull();
    expect(host.querySelector('.import-status-box.success')).toBeNull();
  });

  it('explains that the server is outdated (404) instead of the generic error when the merge preview route is missing', async () => {
    const preview = vi.fn().mockRejectedValue(new StorageServiceError('unsupported-server', 'preview-backup-merge', 404));
    const modal = await renderModal(preview, vi.fn());
    await modal.selectFile();

    expect(host.querySelector('.import-status-box.error')).not.toBeNull();
    expect(host.textContent).toContain('no admite esta operación');
    expect(host.textContent).toContain('Actualiza el servidor');
    expect(host.textContent).not.toContain('vuelve a previsualizar');
  });

  it('explains that the server is outdated (404) instead of the generic error when the replace route is missing', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    const modal = await renderModal(
      vi.fn().mockResolvedValue({ addedCount: 1, duplicateCount: 0, conflictCount: 0, previewToken: 't' }),
      vi.fn().mockRejectedValue(new StorageServiceError('unsupported-server', 'restore-backup-replace', 404)),
    );
    await modal.selectFile();

    await modal.click('Restaurar y reemplazar');

    expect(host.querySelector('.import-status-box.error')).not.toBeNull();
    expect(host.textContent).toContain('no admite esta operación');
    expect(host.textContent).not.toContain('Tus cambios no se han aplicado');
  });
});
