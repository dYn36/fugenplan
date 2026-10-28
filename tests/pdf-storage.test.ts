import { afterEach, describe, expect, it, vi } from 'vitest';
import { protectPdfStorage } from '../src/lib/pdf-storage';

afterEach(() => vi.unstubAllGlobals());

describe('Schutz des PDF-Speichers', () => {
  it('fordert Schutz an, wenn der Browser den Speicher noch automatisch bereinigen darf', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist } });
    expect(await protectPdfStorage()).toBe(true);
    expect(persist).toHaveBeenCalledOnce();
  });

  it('fordert eine bereits erteilte Berechtigung nicht erneut an', async () => {
    const persist = vi.fn();
    vi.stubGlobal('navigator', { storage: { persisted: async () => true, persist } });
    expect(await protectPdfStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('erhält normale lokale Speicherung, wenn der Browser den Schutz ablehnt', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist: async () => false } });
    expect(await protectPdfStorage()).toBe(false);
  });

  it('verträgt Browser ohne StorageManager oder ohne Persistenz-Methoden', async () => {
    vi.stubGlobal('navigator', undefined);
    expect(await protectPdfStorage()).toBe(false);
    vi.stubGlobal('navigator', { storage: {} });
    expect(await protectPdfStorage()).toBe(false);
  });

  it('erhält normale lokale Speicherung bei einem Fehler der Berechtigungsprüfung', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: async () => { throw new DOMException('gesperrt', 'SecurityError'); } } });
    expect(await protectPdfStorage()).toBe(false);
  });
});
