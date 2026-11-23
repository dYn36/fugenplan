import { readFile } from 'node:fs/promises';
import { afterEach, expect, it, vi } from 'vitest';
import { openPdf } from '../src/lib/pdf';

const getDocument = vi.hoisted(() => vi.fn());
vi.mock('pdfjs-dist', () => ({ getDocument, GlobalWorkerOptions: {}, VerbosityLevel: { ERRORS: 0 } }));

afterEach(() => vi.unstubAllGlobals());

it('setzt die Grenzen für Bilddekodierung und Vorschau beim Öffnen einer PDF', async () => {
  const bytes = await readFile(new URL('./fixtures/grundriss-drei-seiten.pdf', import.meta.url));
  const pdf = { numPages: 3, getMetadata: async () => ({ info: {} }) };
  vi.stubGlobal('document', { baseURI: 'http://localhost/' });
  getDocument.mockReturnValue({ promise: Promise.resolve(pdf) });

  expect(await openPdf(new Uint8Array(bytes))).toBe(pdf);
  expect(getDocument).toHaveBeenCalledWith(expect.objectContaining({
    maxImageSize: 64_000_000, canvasMaxAreaInBytes: 64_000_000, stopAtErrors: true,
  }));
});
