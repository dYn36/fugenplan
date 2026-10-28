import { useEffect, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { openPdf } from '../lib/pdf';

/** Render the existing local PDF once. Its viewport already includes the PDF's rotation. */
export function useFloorTemplate(bytes: Uint8Array | null, documentId: string | undefined, pageNumber: number | undefined) {
  const [state, setState] = useState<{ key: string; image: string | null; error: string | null; loading: boolean }>({ key: '', image: null, error: null, loading: false });
  const key = `${documentId ?? ''}:${pageNumber ?? ''}`;
  useEffect(() => {
    setState({ key, image: null, error: null, loading: !!bytes });
    if (!bytes || !documentId || !pageNumber) return;
    let cancelled = false;
    let pdf: PDFDocumentProxy | undefined;
    let render: RenderTask | undefined;
    void (async () => {
      try {
        pdf = await openPdf(bytes);
        if (cancelled) return;
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const natural = page.getViewport({ scale: 1 });
        const scale = Math.min(2000 / Math.max(natural.width, natural.height), Math.sqrt(4_000_000 / (natural.width * natural.height)));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        try {
          render = page.render({ canvas, viewport });
          await render.promise;
          if (!cancelled) setState({ key, image: canvas.toDataURL('image/png'), error: null, loading: false });
        } finally { canvas.width = 1; canvas.height = 1; }
      } catch {
        if (!cancelled) setState({ key, image: null, error: 'Die PDF-Vorlage konnte nicht angezeigt werden. Die Raumpläne bleiben erhalten.', loading: false });
      } finally { if (pdf) void pdf.loadingTask.destroy().catch(() => {}); }
    })();
    return () => { cancelled = true; render?.cancel(); if (pdf) void pdf.loadingTask.destroy().catch(() => {}); };
  }, [bytes, documentId, pageNumber, key]);
  return state.key === key ? state : { key, image: null, error: null, loading: !!bytes };
}
