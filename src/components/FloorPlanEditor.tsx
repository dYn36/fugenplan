import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent, PointerEvent } from 'react';
import { ArrowCounterClockwise, ArrowLeft, ArrowRight, ArrowsOut, CaretDown, Check, CheckCircle, Crosshair, FilePdf, Hand, Minus, Plus, Polygon, Ruler, SquaresFour, Trash, UploadSimple, WarningCircle, X } from '@phosphor-icons/react';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import type { Calibration, FloorPlanDocument, WorkspaceRoom } from '../floorplan-types';
import type { Point } from '../types';
import { openPdf } from '../lib/pdf';
import { calibrationScale } from '../lib/calibration';
import { MAX_ROOMS } from '../lib/workspace';
import { isUnchangedExampleProject } from '../lib/project';
import Dialog from './Dialog';
import './FloorPlanEditor.css';

type Props = {
  document: FloorPlanDocument | undefined;
  pdfBytes: Uint8Array | null;
  rooms: WorkspaceRoom[];
  activeRoomId: string;
  onImport: (file: File) => Promise<boolean>;
  onPageChange: (page: number) => void;
  onCalibrate: (calibration: Calibration) => void;
  onAddRoom: (name: string, points: Point[], replaceExample?: boolean) => void;
  onOpenRoom: (id: string) => void;
  onRemoveRoom: (id: string) => void;
  onShowProject?: () => void;
  onDraftChange?: (dirty: boolean) => void;
  busy?: boolean;
};

type Mode = 'view' | 'calibrate' | 'room';
type WizardStep = 'file' | 'scale' | 'room' | 'done';
type PendingAction = { kind: 'page'; page: number } | { kind: 'file'; file: File } | { kind: 'discard' };
type PageState = { page: PDFPageProxy; documentId: string; number: number; width: number; height: number };
type View = { zoom: number; pan: Point };
type Drag = { pointer: number; start: Point; pan: Point; moved: boolean; roomId?: string };
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_POINTS = 32;
const steps: { id: WizardStep; label: string }[] = [
  { id: 'file', label: 'PDF & Seite' },
  { id: 'scale', label: 'Maßstab' },
  { id: 'room', label: 'Raum' },
  { id: 'done', label: 'Prüfen' },
];
const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2, useGrouping: false });
const displayNumber = (number: number) => numberFormat.format(number);
const pointsAttribute = (points: Point[]) => points.map(point => `${point.x},${point.y}`).join(' ');
const roundedPoint = (point: Point): Point => ({ x: Math.round(point.x * 10000) / 10000, y: Math.round(point.y * 10000) / 10000 });
const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
function readNumber(value: string): number | null {
  const input = value.trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(input)) return null;
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function FloorPlanEditor({ document: floorPlan, pdfBytes, rooms, activeRoomId, onImport, onPageChange, onCalibrate, onAddRoom, onOpenRoom, onRemoveRoom, onShowProject, onDraftChange, busy = false }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const errorNotice = useRef<HTMLDivElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const dropDepth = useRef(0);
  const docId = floorPlan?.id;
  const activePage = floorPlan?.activePage ?? 1;
  const pageInfo = floorPlan?.pages.find(page => page.number === activePage);
  const pageKey = `${docId ?? ''}:${activePage}`;
  const [pdf, setPdf] = useState<{ documentId: string; value: PDFDocumentProxy } | null>(null);
  const [pageState, setPageState] = useState<PageState | null>(null);
  const [renderedPage, setRenderedPage] = useState('');
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [painting, setPainting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [mode, setMode] = useState<Mode>('view');
  const [step, setStep] = useState<WizardStep>('file');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [replaceExample, setReplaceExample] = useState(false);
  const [panTool, setPanTool] = useState(false);
  const [view, setView] = useState<View>({ zoom: 1, pan: { x: 0, y: 0 } });
  const [stageSize, setStageSize] = useState({ width: 800, height: 620 });
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [lengthInput, setLengthInput] = useState('');
  const [draft, setDraft] = useState<Point[]>([]);
  const [closed, setClosed] = useState(false);
  const [name, setName] = useState('');
  const [cursor, setCursor] = useState<Point | null>(null);
  const [positionX, setPositionX] = useState('50');
  const [positionY, setPositionY] = useState('50');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const fieldId = useId();
  const keyboardHelpId = useId();
  const locked = busy || importing;
  const currentPage = pageState && pageState.documentId === docId && pageState.number === activePage ? pageState : null;
  const width = currentPage?.width ?? pageInfo?.width ?? 600;
  const height = currentPage?.height ?? pageInfo?.height ?? 800;
  const fitScale = Math.max(0.00001, Math.min(Math.max(80, stageSize.width - 44) / width, Math.max(80, stageSize.height - 44) / height));
  const displayScale = fitScale * view.zoom;
  const ready = !!currentPage && renderedPage === pageKey && !!pdfBytes && !loadError;
  const pageRooms = rooms.filter(room => room.source?.documentId === docId && room.source?.page === activePage);
  const calibration = pageInfo?.calibration ?? null;
  let mmPerUnit: number | null = null;
  try { if (calibration) mmPerUnit = calibrationScale(calibration); } catch { /* An invalid imported calibration must be set again. */ }
  const calibrated = mmPerUnit !== null;
  const activePoints = mode === 'calibrate' ? calibrationPoints : draft;
  const hasScaleDraft = calibrationPoints.length > 0 || (!!lengthInput.trim() && lengthInput !== (calibration ? displayNumber(calibration.lengthMm / 10) : ''));
  const hasRoomDraft = draft.length > 0 || (!!name.trim() && name !== `Raum ${rooms.length + 1}`);
  const hasDraft = hasScaleDraft || hasRoomDraft;
  const completedRoom = pageRooms.find(room => room.id === activeRoomId) ?? pageRooms.at(-1);
  const currentStepIndex = steps.findIndex(item => item.id === step);
  const canReplaceExample = rooms.length === 1 && !rooms[0].source && isUnchangedExampleProject(rooms[0].project);

  useEffect(() => {
    onDraftChange?.(hasDraft);
    return () => onDraftChange?.(false);
  }, [hasDraft, onDraftChange]);

  useEffect(() => {
    setPdf(null); setPageState(null); setRenderedPage(''); setLoadError('');
    if (!pdfBytes || !docId) { setLoadingPdf(false); return; }
    let cancelled = false;
    let opened: PDFDocumentProxy | null = null;
    setLoadingPdf(true);
    void openPdf(pdfBytes).then(value => {
      opened = value;
      if (cancelled) { void value.loadingTask.destroy().catch(() => {}); return; }
      setPdf({ value, documentId: docId });
      setLoadingPdf(false);
    }).catch(error => {
      if (!cancelled) { setLoadError(message(error, 'Die PDF-Datei konnte nicht geöffnet werden.')); setLoadingPdf(false); }
    });
    return () => { cancelled = true; if (opened) void opened.loadingTask.destroy().catch(() => {}); };
  }, [pdfBytes, docId]);

  useEffect(() => {
    setPageState(null); setRenderedPage(''); setLoadError('');
    if (!pdf || pdf.documentId !== docId) return;
    let cancelled = false;
    setLoadingPdf(true);
    void pdf.value.getPage(activePage).then(page => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 1 });
      setPageState({ page, documentId: pdf.documentId, number: activePage, width: viewport.width, height: viewport.height });
      setLoadingPdf(false);
    }).catch(() => {
      if (!cancelled) { setLoadError('Diese PDF-Seite konnte nicht geladen werden. Öffne die Datei erneut.'); setLoadingPdf(false); }
    });
    return () => { cancelled = true; };
  }, [pdf, docId, activePage]);

  useEffect(() => {
    if (!currentPage || !canvas.current) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    setPainting(true);
    // Each task paints a separate canvas. A cancelled or old task can never overwrite the current page.
    const timer = window.setTimeout(() => {
      const pixels = Math.min(window.devicePixelRatio || 1, 2);
      const renderScale = Math.min(displayScale * pixels, Math.sqrt(16_000_000 / (width * height)), 8192 / Math.max(width, height));
      const viewport = currentPage.page.getViewport({ scale: renderScale });
      const buffer = window.document.createElement('canvas');
      buffer.width = Math.max(1, Math.ceil(viewport.width));
      buffer.height = Math.max(1, Math.ceil(viewport.height));
      try { task = currentPage.page.render({ canvas: buffer, viewport }); }
      catch {
        if (!cancelled) { setLoadError('Diese PDF-Seite konnte nicht gezeichnet werden. Öffne eine neue PDF-Kopie.'); setPainting(false); }
        buffer.width = 1; buffer.height = 1;
        return;
      }
      void task.promise.then(() => {
        if (cancelled || !canvas.current) return;
        const target = canvas.current;
        target.width = buffer.width; target.height = buffer.height;
        const context = target.getContext('2d');
        if (!context) throw new Error('Die PDF-Ansicht ist in diesem Browser nicht verfügbar.');
        context.drawImage(buffer, 0, 0);
        setRenderedPage(pageKey); setPainting(false); setLoadError('');
      }).catch(error => {
        if (!cancelled && error?.name !== 'RenderingCancelledException') {
          setLoadError('Diese PDF-Seite konnte nicht dargestellt werden. Öffne eine neue PDF-Kopie.'); setPainting(false);
        }
      }).finally(() => { buffer.width = 1; buffer.height = 1; });
    }, 50);
    return () => { cancelled = true; window.clearTimeout(timer); task?.cancel(); };
  }, [currentPage, displayScale, width, height, pageKey]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, [!!floorPlan]);

  useEffect(() => {
    setMode('view'); setPanTool(false); setView({ zoom: 1, pan: { x: 0, y: 0 } });
    setCalibrationPoints([]); setLengthInput(''); setDraft([]); setName(''); setClosed(false); setCursor(null);
    setActionError(''); setAnnouncement(''); setConfirmRemove(null); setPositionX('50'); setPositionY('50');
    setPendingAction(null); setJustSaved(false);
    // Resume a saved page at its next useful step. A new page starts with its selection.
    setStep(calibrated ? (pageRooms.length ? 'done' : 'room') : 'file');
    drag.current = null;
    // A saved scale or added room must not reset an in-progress marking on this page.
  }, [docId, activePage]);

  useEffect(() => {
    if (!actionError || !errorNotice.current) return;
    const bounds = errorNotice.current.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > window.innerHeight) errorNotice.current.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [actionError]);

  const perform = (callback: () => void, fallback: string) => {
    try { callback(); setActionError(''); return true; }
    catch (error) { setActionError(message(error, fallback)); return false; }
  };

  const focusStep = () => window.requestAnimationFrame(() => {
    stepHeading.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    stepHeading.current?.focus({ preventScroll: true });
  });

  const importFile = async (file: File | undefined, discardDraft = false) => {
    if (!file || locked) return;
    setActionError(''); setDropActive(false); dropDepth.current = 0;
    if (file.size > MAX_BYTES) { setActionError('Die PDF-Datei darf höchstens 20 MiB groß sein.'); return; }
    if (file.size === 0) { setActionError('Diese Datei ist leer. Bitte wähle eine PDF-Datei.'); return; }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setActionError('Bitte wähle eine PDF-Datei.'); return; }
    if (hasDraft && !discardDraft) { setPendingAction({ kind: 'file', file }); if (input.current) input.current.value = ''; return; }
    setImporting(true);
    try { if (await onImport(file)) setAnnouncement('PDF geöffnet. Prüfe die Seite und lege danach den Maßstab fest.'); }
    catch (error) { setActionError(message(error, 'Die PDF-Datei konnte nicht geöffnet werden.')); }
    finally { setImporting(false); if (input.current) input.current.value = ''; }
  };

  const discard = () => {
    if (mode !== 'calibrate') { setDraft([]); setName(''); setClosed(false); }
    if (mode !== 'room') { setCalibrationPoints([]); setLengthInput(''); }
    setMode('view'); setPanTool(false); setCursor(null); setActionError('');
    setAnnouncement('Markierung abgebrochen.');
    focusStep();
  };

  const cancel = () => { if (hasDraft) setPendingAction({ kind: 'discard' }); else discard(); };

  const changePage = (page: number) => {
    if (page === activePage || locked) return;
    if (hasDraft) { setPendingAction({ kind: 'page', page }); return; }
    perform(() => onPageChange(page), 'Die Seite konnte nicht gewechselt werden.');
  };

  const goToStep = (next: WizardStep) => {
    if (locked || (next !== 'file' && !floorPlan) || (next === 'room' && (!calibrated || hasScaleDraft)) || (next === 'done' && (!pageRooms.length || hasDraft))) return;
    setStep(next); setPanTool(false); setCursor(null); setActionError('');
    setMode(next === 'scale' && (calibrationPoints.length || lengthInput) ? 'calibrate' : next === 'room' && hasRoomDraft ? 'room' : 'view');
    focusStep();
  };

  const startMode = (next: 'calibrate' | 'room') => {
    if (!ready || locked || (next === 'room' && !calibrated)) return;
    if (next === 'room' && rooms.length >= MAX_ROOMS) { setActionError(`Es sind höchstens ${MAX_ROOMS} Räume möglich.`); return; }
    setStep(next === 'calibrate' ? 'scale' : 'room');
    setMode(next); setPanTool(false); setActionError(''); setCursor(null);
    if (next === 'calibrate' && !calibrationPoints.length) setLengthInput(calibration ? displayNumber(calibration.lengthMm / 10) : lengthInput);
    if (next === 'room' && !draft.length) { setClosed(false); if (!name) setName(`Raum ${rooms.length + 1}`); }
    setAnnouncement(next === 'calibrate' ? 'Start und Ende einer bekannten Wand markieren.' : 'Die inneren Raumecken der Reihe nach markieren.');
    window.requestAnimationFrame(() => {
      stage.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
      overlay.current?.focus({ preventScroll: true });
    });
  };

  const pageCoordinate = (clientX: number, clientY: number): Point | null => {
    const rect = paper.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    return { x: (clientX - rect.left) / rect.width * width, y: (clientY - rect.top) / rect.height * height };
  };

  const addPoint = (value: Point, closeByPointer = false) => {
    if (!ready || locked || mode === 'view') return;
    const point = roundedPoint(value);
    if (point.x < 0 || point.y < 0 || point.x > width || point.y > height) {
      setActionError('Markiere einen Punkt innerhalb der PDF-Seite.'); return;
    }
    setActionError('');
    if (mode === 'calibrate') {
      if (calibrationPoints.length >= 2) { setAnnouncement('Beide Punkte sind gesetzt. Trage jetzt die Wandlänge ein.'); return; }
      if (calibrationPoints[0] && Math.hypot(point.x - calibrationPoints[0].x, point.y - calibrationPoints[0].y) < 0.01) {
        setActionError('Start und Ende müssen verschiedene Punkte sein.'); return;
      }
      setCalibrationPoints([...calibrationPoints, point]);
      setAnnouncement(calibrationPoints.length === 0 ? 'Startpunkt gesetzt. Markiere das Ende der Wand.' : 'Endpunkt gesetzt. Trage die bekannte Wandlänge ein.');
    } else {
      if (closed) { setAnnouncement('Die Kontur ist geschlossen. Du kannst den Raum übernehmen.'); return; }
      if (draft.length >= 3 && Math.hypot(point.x - draft[0].x, point.y - draft[0].y) <= (closeByPointer ? 12 / displayScale : .0001)) {
        setClosed(true); setCursor(null); setAnnouncement('Kontur geschlossen. Den Raum jetzt übernehmen.'); return;
      }
      if (draft.length >= MAX_POINTS) { setActionError('Ein Raum kann höchstens 32 Eckpunkte haben.'); return; }
      if (draft.some(p => Math.hypot(p.x - point.x, p.y - point.y) < 0.01)) { setActionError('Dieser Eckpunkt ist bereits gesetzt.'); return; }
      setDraft([...draft, point]); setAnnouncement(`Eckpunkt ${draft.length + 1} gesetzt.`);
    }
  };

  const undoPoint = () => {
    setActionError(''); setClosed(false);
    if (mode === 'calibrate') setCalibrationPoints(points => points.slice(0, -1));
    else setDraft(points => points.slice(0, -1));
    setAnnouncement('Letzten Punkt entfernt.');
  };

  const saveCalibration = () => {
    if (!ready || locked) return;
    const cm = readNumber(lengthInput);
    if (calibrationPoints.length !== 2) { setActionError('Markiere zuerst beide Endpunkte der Wand.'); return; }
    if (cm === null || cm <= 0 || cm > 5000) { setActionError('Die Wandlänge muss größer als 0 und höchstens 5.000 cm sein.'); return; }
    const next = { start: calibrationPoints[0], end: calibrationPoints[1], lengthMm: cm * 10 };
    if (perform(() => { calibrationScale(next); onCalibrate(next); }, 'Der Maßstab konnte nicht gespeichert werden.')) {
      setStep('room'); setMode(hasRoomDraft ? 'room' : 'view'); setPanTool(false); setCalibrationPoints([]); setLengthInput(''); setCursor(null); setAnnouncement('Maßstab gespeichert. Markiere jetzt einen Raum.');
      focusStep();
    }
  };

  const saveRoom = () => {
    if (!ready || locked) return;
    if (draft.length < 3) { setActionError('Ein Raum braucht mindestens drei Eckpunkte.'); return; }
    if (!name.trim()) { setActionError('Bitte gib dem Raum einen Namen.'); return; }
    if (!calibrated) { setActionError('Lege zuerst den Maßstab dieser Seite fest.'); return; }
    if (perform(() => onAddRoom(name.trim(), draft.map(point => ({ ...point })), replaceExample && canReplaceExample), 'Die Raumkontur konnte nicht übernommen werden.')) {
      setJustSaved(true); setStep('done'); setMode('view'); setDraft([]); setName(''); setClosed(false); setCursor(null); setAnnouncement('Raum übernommen. Prüfe den Verlegeplan oder markiere einen weiteren Raum.');
      focusStep();
    }
  };

  const zoomTo = (next: number, anchor?: Point) => {
    const zoom = Math.min(8, Math.max(0.5, next));
    const rect = stage.current?.getBoundingClientRect();
    const target = anchor && rect ? { x: anchor.x - rect.left - stageSize.width / 2, y: anchor.y - rect.top - stageSize.height / 2 } : { x: 0, y: 0 };
    setView(current => ({ zoom, pan: { x: target.x - (target.x - current.pan.x) * zoom / current.zoom, y: target.y - (target.y - current.pan.y) * zoom / current.zoom } }));
  };

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!ready || locked || (event.button !== 0 && event.pointerType !== 'touch') || drag.current) return;
    if ((event.target as Element).closest('button, input, select, .fpdf-view-tools')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const roomId = (event.target as Element).closest('[data-room-id]')?.getAttribute('data-room-id') ?? undefined;
    drag.current = { pointer: event.pointerId, start: { x: event.clientX, y: event.clientY }, pan: { ...view.pan }, moved: false, roomId };
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (current && current.pointer === event.pointerId) {
      const dx = event.clientX - current.start.x, dy = event.clientY - current.start.y;
      if (Math.hypot(dx, dy) > 4) current.moved = true;
      if (current.moved) { setView(previous => ({ ...previous, pan: { x: current.pan.x + dx, y: current.pan.y + dy } })); setCursor(null); }
    } else if (mode !== 'view' && !panTool) setCursor(pageCoordinate(event.clientX, event.clientY));
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
    if (current.moved || panTool) return;
    if (mode === 'view' && current.roomId) perform(() => onOpenRoom(current.roomId!), 'Der Raum konnte nicht geöffnet werden.');
    else { const point = pageCoordinate(event.clientX, event.clientY); if (point) addPoint(point, true); }
  };

  const canvasKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); return; }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z' && mode !== 'view') { event.preventDefault(); event.stopPropagation(); undoPoint(); return; }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomTo(view.zoom * 1.25); return; }
    if (event.key === '-') { event.preventDefault(); zoomTo(view.zoom / 1.25); return; }
    if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      const amount = (event.shiftKey ? 10 : 1) / displayScale;
      const dx = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0;
      const dy = event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0;
      if (mode === 'view' || panTool) setView(previous => ({ ...previous, pan: { x: previous.pan.x - dx * displayScale * 10, y: previous.pan.y - dy * displayScale * 10 } }));
      else setCursor(previous => ({ x: Math.min(width, Math.max(0, (previous?.x ?? width / 2) + dx)), y: Math.min(height, Math.max(0, (previous?.y ?? height / 2) + dy)) }));
    }
    if (event.key === 'Enter' && mode !== 'view' && !panTool) { event.preventDefault(); addPoint(cursor ?? { x: width / 2, y: height / 2 }); }
  };

  const setPrecisePoint = () => {
    const x = readNumber(positionX), y = readNumber(positionY);
    if (x === null || y === null || x > 100 || y > 100) { setActionError('X und Y müssen zwischen 0 und 100 % liegen.'); return; }
    const point = { x: width * x / 100, y: height * y / 100 };
    setCursor(point); addPoint(point);
    if (mode === 'calibrate') window.requestAnimationFrame(() => {
      window.document.getElementById(`${fieldId}-length`)?.focus();
    });
  };

  const dragDrop = {
    onDragEnter: (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); if (event.dataTransfer.types.includes('Files')) { dropDepth.current += 1; setDropActive(true); } },
    onDragOver: (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); event.dataTransfer.dropEffect = locked ? 'none' : 'copy'; },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); dropDepth.current = Math.max(0, dropDepth.current - 1); if (!dropDepth.current) setDropActive(false); },
    onDrop: (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); dropDepth.current = 0; setDropActive(false); if (event.dataTransfer.files.length > 1) setActionError('Bitte öffne jeweils eine PDF-Datei.'); else void importFile(event.dataTransfer.files[0]); },
  };

  return <div className={`fpdf-editor${dropActive ? ' is-drop-active' : ''}`} {...dragDrop}>
    <input ref={input} type="file" accept=".pdf,application/pdf" className="visually-hidden" aria-label="PDF-Grundriss öffnen" disabled={locked} onChange={(event: ChangeEvent<HTMLInputElement>) => void importFile(event.target.files?.[0])} />
    <span className="visually-hidden" role="status" aria-live="polite">{announcement}</span>
    <nav className="fpdf-progress" aria-label="Schritte zum Verlegeplan">
      <ol>{steps.map((item, index) => <li key={item.id} className={step === item.id ? 'is-current' : index < currentStepIndex ? 'is-complete' : ''}>
        <button type="button" aria-current={step === item.id ? 'step' : undefined} disabled={locked || (!floorPlan && item.id !== 'file') || (item.id === 'room' && (!calibrated || hasScaleDraft)) || (item.id === 'done' && (!pageRooms.length || hasDraft))} onClick={() => goToStep(item.id)}>
          <span className="fpdf-progress-number" aria-hidden="true">{index < currentStepIndex ? <Check size={15} weight="bold" /> : index + 1}</span><span>{item.label}</span>
        </button>
      </li>)}</ol>
    </nav>
    {actionError && <div ref={errorNotice} className="fpdf-error" role="alert"><WarningCircle size={19} /><span>{actionError}</span><button type="button" aria-label="Hinweis schließen" onClick={() => setActionError('')}><X size={17} /></button></div>}
    {!floorPlan ? <section className="fpdf-empty" aria-labelledby={`${fieldId}-title`}>
      <div className="fpdf-empty-intro"><span className="fpdf-step-caption">Schritt 1 von 4</span><h2 ref={stepHeading} tabIndex={-1} id={`${fieldId}-title`}>PDF und Seite wählen</h2><p>Öffne deinen Grundriss. Danach legst du den Maßstab fest und markierst die Räume.</p></div>
      <div className="fpdf-upload">
        <FilePdf size={40} weight="light" aria-hidden="true" />
        <h3>PDF hier ablegen</h3><p>Ein Grundriss oder ein gescannter Plan. Maximal 20 MiB.</p>
        <button type="button" className="button primary" disabled={locked} onClick={() => input.current?.click()}><UploadSimple size={18} />{locked ? 'PDF wird geöffnet …' : 'PDF auswählen'}</button>
        <span>Die Datei bleibt auf deinem Gerät.</span>
      </div>
      <p className="fpdf-upload-note">Halte eine bekannte Wandlänge bereit, zum Beispiel 480 cm. Damit berechnet Fugenplan den Maßstab.</p>
    </section> : <>
      <div className="fpdf-document-bar">
        <div className="fpdf-file-name"><FilePdf size={22} /><div><strong title={floorPlan.name}>{floorPlan.name}</strong><span>{floorPlan.pageCount === 1 ? '1 Seite' : `${floorPlan.pageCount} Seiten`} · PDF auf diesem Gerät</span></div></div>
        <div className="fpdf-document-actions"><label htmlFor={`${fieldId}-page`}>PDF-Seite</label><select id={`${fieldId}-page`} aria-label="PDF-Seite" value={activePage} disabled={locked} onChange={event => changePage(Number(event.target.value))}>
          {Array.from({ length: floorPlan.pageCount }, (_, index) => <option value={index + 1} key={index + 1}>Seite {index + 1}</option>)}
        </select><button type="button" className="button" disabled={locked} aria-describedby={rooms.some(room => room.source) ? `${fieldId}-replace-help` : undefined} onClick={() => input.current?.click()}><UploadSimple size={16} /><span>{pdfBytes ? 'Andere PDF' : 'PDF erneut öffnen'}</span></button></div>
      </div>
      {rooms.some(room => room.source) && <p className="fpdf-replace-note" id={`${fieldId}-replace-help`}>Eine andere PDF erhält die Raumpläne und löst ihre bisherige PDF-Zuordnung. Dieselbe PDF erhält auch die Zuordnung.</p>}
      <div className="fpdf-workspace">
        <aside className="fpdf-panel" aria-label="Grundriss vorbereiten">
          <span className="fpdf-step-caption">Schritt {currentStepIndex + 1} von 4</span>
          {step === 'file' && <section className="fpdf-step is-current" aria-labelledby={`${fieldId}-file-title`}>
            <h2 ref={stepHeading} tabIndex={-1} id={`${fieldId}-file-title`}>PDF und Seite wählen</h2>
            <p>Prüfe, ob die Vorschau den gewünschten Grundriss zeigt. Die Seitenauswahl steht über dem Plan.</p>
            <div className="fpdf-page-summary"><FilePdf size={20} /><span>Seite <strong>{activePage}</strong> von {floorPlan.pageCount}{calibrated && <small>Maßstab bereits gespeichert</small>}</span></div>
            {canReplaceExample && <label className="fpdf-example-choice"><input type="checkbox" checked={replaceExample} onChange={event => setReplaceExample(event.target.checked)} /><span>Beispielraum beim ersten Raum ersetzen<small>„{rooms[0].project.name}“ wird erst nach dem Übernehmen einer gültigen Kontur entfernt.</small></span></label>}
            <button type="button" className="button primary fpdf-full-button" disabled={!ready || locked} onClick={() => goToStep('scale')}>Seite verwenden<ArrowRight size={16} /></button>
            {draft.length > 0 && <p className="fpdf-small">Die Raumkontur bleibt beim Zurückgehen erhalten.</p>}
            {pageRooms.length > 0 && <p className="fpdf-small">{pageRooms.length} {pageRooms.length === 1 ? 'Raum ist' : 'Räume sind'} dieser Seite zugeordnet.</p>}
          </section>}
          {step === 'scale' && <section className="fpdf-step is-current" aria-labelledby={`${fieldId}-scale-title`}>
            <h2 ref={stepHeading} tabIndex={-1} id={`${fieldId}-scale-title`}>Maßstab festlegen</h2>
            {mode === 'calibrate' ? <>
              <p>{calibrationPoints.length === 0 ? 'Markiere den Anfang einer Wand mit bekanntem Maß.' : calibrationPoints.length === 1 ? 'Markiere jetzt das Ende derselben Wand.' : 'Gib die tatsächliche Länge dieser Wand in Zentimetern ein.'}</p>
              <div className="fpdf-point-status" aria-live="polite"><span className={calibrationPoints.length > 0 ? 'is-done' : ''}>1. Anfang</span><span className={calibrationPoints.length > 1 ? 'is-done' : ''}>2. Ende</span></div>
              {calibrationPoints.length === 2 && <label className="fpdf-field" htmlFor={`${fieldId}-length`}><span>Länge der Wand</span><div className="fpdf-unit-input"><input id={`${fieldId}-length`} value={lengthInput} type="text" inputMode="decimal" autoComplete="off" placeholder="z. B. 480" aria-label="Länge der Wand" onChange={event => setLengthInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); saveCalibration(); } }} aria-describedby={`${fieldId}-length-unit ${fieldId}-length-help`} /><span id={`${fieldId}-length-unit`}>cm</span></div><small id={`${fieldId}-length-help`}>4,80 m entsprechen 480 cm.</small></label>}
              {calibrationPoints.length === 2 && <button type="button" className="button primary fpdf-full-button" disabled={locked} onClick={saveCalibration}><Check size={16} />Maßstab speichern</button>}
              <div className="fpdf-draft-actions"><button type="button" disabled={!calibrationPoints.length || locked} onClick={undoPoint}><ArrowCounterClockwise size={16} />Letzten Punkt entfernen</button><button type="button" disabled={locked} onClick={cancel}>Abbrechen</button></div>
            </> : <>
              {calibrated && calibration ? <div className="fpdf-calibrated"><CheckCircle size={18} /><span>Wandmaß: <strong>{displayNumber(calibration.lengthMm / 10)} cm</strong><small>Gilt für Seite {activePage}.</small></span></div> : <p>Markiere Anfang und Ende einer Wand, deren tatsächliche Länge du kennst.</p>}
              {calibrated && <button type="button" className="button primary fpdf-full-button" disabled={!ready || locked} onClick={() => goToStep('room')}>Weiter zum Raum<ArrowRight size={16} /></button>}
              <button type="button" className={`button fpdf-full-button${!calibrated ? ' primary' : ''}`} disabled={!ready || locked} onClick={() => startMode('calibrate')}><Ruler size={17} />{calibrated ? 'Maßstab neu setzen' : 'Wand markieren'}</button>
            </>}
            {calibrated && pageRooms.length > 0 && <p className="fpdf-small">Ein neuer Maßstab ändert auch die Maße der {pageRooms.length} zugeordneten {pageRooms.length === 1 ? 'Raumkontur' : 'Raumkonturen'} auf dieser Seite.</p>}
            <button type="button" className="fpdf-back" disabled={locked} onClick={() => goToStep('file')}><ArrowLeft size={15} />Zur PDF-Auswahl</button>
          </section>}
          {step === 'room' && <section className="fpdf-step is-current" aria-labelledby={`${fieldId}-room-title`}>
            <h2 ref={stepHeading} tabIndex={-1} id={`${fieldId}-room-title`}>Raum markieren</h2>
            {mode === 'room' ? <>
              <p>{closed ? 'Die Kontur ist geschlossen. Prüfe den Namen und übernimm den Raum.' : 'Markiere die inneren Raumecken der Reihe nach. Die letzte Kante wird beim Übernehmen geschlossen.'}</p>
              <label className="fpdf-field" htmlFor={`${fieldId}-room-name`}><span>Raumname</span><input id={`${fieldId}-room-name`} type="text" maxLength={100} value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && draft.length >= 3) { event.preventDefault(); saveRoom(); } }} /></label>
              <div className="fpdf-draft-count"><span>{draft.length} von 32 Eckpunkten</span>{closed && <span><Check size={13} />Geschlossen</span>}</div>
              <button type="button" className="button primary fpdf-full-button" disabled={draft.length < 3 || locked} onClick={saveRoom}><Check size={16} />Raum übernehmen</button>
              <div className="fpdf-draft-actions"><button type="button" disabled={!draft.length || locked} onClick={undoPoint}><ArrowCounterClockwise size={16} />Letzten Punkt entfernen</button><button type="button" disabled={locked} onClick={cancel}>Abbrechen</button></div>
            </> : <>
              <div className="fpdf-calibrated"><CheckCircle size={18} /><span>Maßstab gespeichert<small>Seite {activePage} · Wandmaß {calibration ? displayNumber(calibration.lengthMm / 10) : '–'} cm</small></span></div>
              <p>Markiere die Innenkontur eines Raumes. Für weitere Räume bleibst du anschließend im Grundriss.</p>
              <button type="button" className="button primary fpdf-full-button" disabled={!ready || !calibrated || locked || rooms.length >= MAX_ROOMS} onClick={() => startMode('room')}><Polygon size={17} />Raum markieren</button>
              {rooms.length >= MAX_ROOMS && <p className="fpdf-small">Das Projekt enthält bereits {MAX_ROOMS} Räume. Entferne zuerst einen Raum in der Projektansicht.</p>}
            </>}
            <button type="button" className="fpdf-back" disabled={locked} onClick={() => goToStep('scale')}><ArrowLeft size={15} />Zum Maßstab</button>
          </section>}
          {step === 'done' && <section className="fpdf-step is-current" aria-labelledby={`${fieldId}-done-title`}>
            <div className="fpdf-complete-title"><CheckCircle size={24} /><h2 ref={stepHeading} tabIndex={-1} id={`${fieldId}-done-title`}>{justSaved ? 'Raum übernommen' : 'Räume prüfen'}</h2></div>
            <p className="fpdf-project-count">{rooms.length} {rooms.length === 1 ? 'Raum' : 'Räume'} im Projekt · {pageRooms.length} auf dieser Seite</p>
            {completedRoom ? <>
              <div className="fpdf-room-summary"><strong>{completedRoom.project.name}</strong><span>{displayNumber(completedRoom.project.room.width / 10)} × {displayNumber(completedRoom.project.room.height / 10)} cm</span><small>Außenmaße der markierten Kontur</small></div>
              <p>Prüfe im Raumplan ein zweites bekanntes Maß. Danach kannst du Belag und Verlegung einstellen.</p>
              <button type="button" className="button primary fpdf-full-button" disabled={locked} onClick={() => perform(() => onOpenRoom(completedRoom.id), 'Der Raum konnte nicht geöffnet werden.')}>Raum prüfen<ArrowRight size={16} /></button>
            </> : <p>Markiere einen Raum, um den Verlegeplan zu prüfen.</p>}
            <button type="button" className="button fpdf-full-button" disabled={!ready || !calibrated || locked || rooms.length >= MAX_ROOMS} onClick={() => startMode('room')}><Plus size={17} />Weiteren Raum markieren</button>
            {rooms.length >= MAX_ROOMS && <p className="fpdf-small">Das Projekt enthält bereits {MAX_ROOMS} Räume.</p>}
            {onShowProject && <button type="button" className="button fpdf-full-button" disabled={locked} onClick={onShowProject}><SquaresFour size={17} />Zur Projektansicht</button>}
            <button type="button" className="fpdf-back" disabled={locked} onClick={() => goToStep('scale')}><Ruler size={15} />Maßstab prüfen</button>
          </section>}
          {mode !== 'view' && <details className="fpdf-precise"><summary>Punkte per Tastatur eingeben<CaretDown size={14} /></summary><p>X zählt von links, Y von oben. 100 % entspricht der ganzen Seite.</p><div className="fpdf-coordinate-fields">
            <label className="fpdf-field" htmlFor={`${fieldId}-x`}><span>X auf Seite</span><div className="fpdf-unit-input"><input id={`${fieldId}-x`} inputMode="decimal" aria-label="X auf Seite" aria-describedby={`${fieldId}-x-unit`} value={positionX} onChange={event => setPositionX(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setPrecisePoint(); } }} /><span id={`${fieldId}-x-unit`}>%</span></div></label>
            <label className="fpdf-field" htmlFor={`${fieldId}-y`}><span>Y auf Seite</span><div className="fpdf-unit-input"><input id={`${fieldId}-y`} inputMode="decimal" aria-label="Y auf Seite" aria-describedby={`${fieldId}-y-unit`} value={positionY} onChange={event => setPositionY(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setPrecisePoint(); } }} /><span id={`${fieldId}-y-unit`}>%</span></div></label>
          </div><button type="button" className="button fpdf-full-button" onClick={setPrecisePoint} disabled={locked || (mode === 'calibrate' ? calibrationPoints.length >= 2 : closed || draft.length >= MAX_POINTS)}><Plus size={15} />Punkt setzen</button>
          {activePoints.length > 0 && <ol className="fpdf-coordinate-list">{activePoints.map((point, index) => <li key={index}><span>Punkt {index + 1}</span><span>{displayNumber(point.x / width * 100)} % / {displayNumber(point.y / height * 100)} %</span></li>)}</ol>}
          </details>}
          {step === 'done' && <section className="fpdf-rooms" aria-label={`Räume auf Seite ${activePage}`}><div className="fpdf-rooms-heading"><h2>Räume auf dieser Seite</h2><span>{pageRooms.length}</span></div>
            {pageRooms.length ? <ul>{pageRooms.map(room => <li key={room.id} className={room.id === activeRoomId ? 'is-active' : ''}>
              <div className="fpdf-room-row"><button type="button" className="fpdf-room-open" aria-label={`${room.project.name} öffnen`} onClick={() => perform(() => onOpenRoom(room.id), 'Der Raum konnte nicht geöffnet werden.')}><span>{room.project.name}</span><ArrowRight size={16} /></button><button type="button" className="fpdf-remove-room" aria-label={`${room.project.name} entfernen`} disabled={rooms.length === 1 || locked} onClick={() => setConfirmRemove(confirmRemove === room.id ? null : room.id)}><Trash size={16} /></button></div>
              {confirmRemove === room.id && <div className="fpdf-remove-confirm"><p>Raum und Verlegeplan entfernen?</p><button type="button" onClick={() => { if (perform(() => onRemoveRoom(room.id), 'Der Raum konnte nicht entfernt werden.')) setConfirmRemove(null); }}>Entfernen</button><button type="button" onClick={() => setConfirmRemove(null)}>Behalten</button></div>}
            </li>)}</ul> : <p>Hier erscheinen deine markierten Räume.</p>}
          </section>}
        </aside>
        <div className="fpdf-drawing-area">
          <div className="fpdf-stage-title"><span>{mode === 'calibrate' ? 'Wandmaß markieren' : mode === 'room' ? 'Raumkontur markieren' : `Grundriss · Seite ${activePage}`}</span><span>{mode === 'view' ? 'Ziehen verschiebt die Ansicht' : 'Klicken setzt Punkte · Ziehen verschiebt die Ansicht'}</span></div>
          <div ref={stage} className={`fpdf-stage${mode !== 'view' && !panTool ? ' is-marking' : ' is-panning'}`} data-testid="pdf-stage" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; }} onPointerLeave={() => { if (!drag.current) setCursor(null); }}>
            {!!pdfBytes && <div ref={paper} className="fpdf-paper" style={{ width: width * displayScale, height: height * displayScale, left: stageSize.width / 2 + view.pan.x, top: stageSize.height / 2 + view.pan.y, visibility: ready ? 'visible' : 'hidden' }}>
              <canvas ref={canvas} data-testid="pdf-canvas" aria-hidden="true" />
              <svg ref={overlay} data-testid="pdf-overlay" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`PDF-Grundriss, Seite ${activePage}`} aria-describedby={keyboardHelpId} tabIndex={0} onKeyDown={canvasKeyDown}>
                {pageRooms.map(room => {
                  const points = room.source!.points;
                  const center = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
                  const labelWidth = Math.min(180, Math.max(100, Array.from(room.project.name).length * 7 + 24));
                  return <g key={room.id} className={`fpdf-room-shape${room.id === activeRoomId ? ' is-active' : ''}`} data-room-id={room.id} role={mode === 'view' ? 'button' : undefined} tabIndex={mode === 'view' ? 0 : undefined} aria-label={`${room.project.name} öffnen`} onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && mode === 'view') { event.preventDefault(); event.stopPropagation(); perform(() => onOpenRoom(room.id), 'Der Raum konnte nicht geöffnet werden.'); } }}>
                    <polygon points={pointsAttribute(points)} fill="#245d4a" fillOpacity={room.id === activeRoomId ? '.15' : '.07'} stroke="#357259" strokeWidth={room.id === activeRoomId ? 2 : 1.25} vectorEffect="non-scaling-stroke" />
                    <g className="fpdf-room-label" transform={`translate(${center.x} ${center.y}) scale(${1 / displayScale})`} aria-hidden="true">
                      <rect x={-labelWidth / 2} y={-14} width={labelWidth} height={28} rx={4} fill="#fff" stroke="#dce2dc" strokeWidth={1} />
                      <foreignObject x={-labelWidth / 2} y={-14} width={labelWidth} height={28}><div className="fpdf-room-label-text" title={room.project.name}>{room.project.name}</div></foreignObject>
                    </g>
                  </g>;
                })}
                {mode !== 'calibrate' && calibration && <g className="fpdf-saved-calibration" pointerEvents="none"><line x1={calibration.start.x} y1={calibration.start.y} x2={calibration.end.x} y2={calibration.end.y} stroke="#98732e" strokeWidth="1.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" /><text x={(calibration.start.x + calibration.end.x) / 2} y={(calibration.start.y + calibration.end.y) / 2 - 10 / displayScale} textAnchor="middle" fill="#77561c" stroke="#fff" strokeWidth={4 / displayScale} paintOrder="stroke" fontSize={11 / displayScale}>{displayNumber(calibration.lengthMm / 10)} cm</text></g>}
                {mode !== 'view' && <g pointerEvents="none">
                  {mode === 'room' && draft.length >= 3 && <polygon points={pointsAttribute(draft)} fill="#245d4a" fillOpacity=".12" stroke={closed ? '#245d4a' : 'none'} strokeWidth="2" vectorEffect="non-scaling-stroke" />}
                  <polyline points={pointsAttribute(!closed && cursor && (mode === 'room' || calibrationPoints.length < 2) ? [...activePoints, cursor] : activePoints)} fill="none" stroke={mode === 'calibrate' ? '#97702c' : '#245d4a'} strokeWidth="2" strokeDasharray={closed ? undefined : '6 4'} vectorEffect="non-scaling-stroke" />
                  {activePoints.map((point, index) => <g key={index}><circle cx={point.x} cy={point.y} r={5 / displayScale} fill={index === 0 ? '#245d4a' : '#fff'} stroke="#245d4a" strokeWidth="2" vectorEffect="non-scaling-stroke" /><text x={point.x + 10 / displayScale} y={point.y - 10 / displayScale} fill="#245d4a" stroke="#fff" strokeWidth={3 / displayScale} paintOrder="stroke" fontSize={12 / displayScale}>{index + 1}</text></g>)}
                  {cursor && !panTool && !closed && <g stroke="#245d4a" strokeWidth="1" vectorEffect="non-scaling-stroke"><line x1={cursor.x - 8 / displayScale} x2={cursor.x + 8 / displayScale} y1={cursor.y} y2={cursor.y} /><line x1={cursor.x} x2={cursor.x} y1={cursor.y - 8 / displayScale} y2={cursor.y + 8 / displayScale} /></g>}
                </g>}
              </svg>
            </div>}
            {!pdfBytes ? <div className="fpdf-stage-message"><FilePdf size={34} weight="light" /><h3>PDF-Datei erneut öffnen</h3><p>Die Raumkonturen sind gespeichert. Öffne „{floorPlan.name}“, um den Grundriss wieder anzuzeigen.</p><button type="button" className="button primary" disabled={locked} onClick={() => input.current?.click()}>PDF erneut auswählen</button></div> : loadError ? <div className="fpdf-stage-message fpdf-load-error" role="alert"><WarningCircle size={32} /><h3>PDF kann nicht angezeigt werden</h3><p>{loadError}</p><button type="button" className="button" onClick={() => input.current?.click()}>PDF erneut auswählen</button></div> : !ready ? <div className="fpdf-stage-message" role="status"><span className="fpdf-loader" /><p>{loadingPdf ? 'PDF-Seite wird geladen …' : 'PDF-Seite wird gezeichnet …'}</p></div> : <>
              {painting && <span className="fpdf-rendering" role="status">Ansicht wird geschärft …</span>}
            </>}
          </div>
          {ready && <div className="fpdf-canvas-actions">
              {(mode === 'calibrate' && calibrationPoints.length === 2 || mode === 'room' && draft.length >= 3) && <button type="button" className="button primary fpdf-mobile-next" onClick={() => {
                const target = window.document.getElementById(`${fieldId}-${mode === 'calibrate' ? 'length' : 'room-name'}`);
                target?.scrollIntoView({ block: 'center', behavior: 'instant' }); target?.focus({ preventScroll: true });
              }}>{mode === 'calibrate' ? 'Wandlänge eingeben' : 'Raum benennen'}<ArrowRight size={15} /></button>}
              <div className="fpdf-view-tools" role="group" aria-label="PDF-Ansicht">
                {mode !== 'view' && <><button type="button" aria-label="Punkte markieren" title="Punkte markieren" aria-pressed={!panTool} className={!panTool ? 'is-active' : ''} onClick={() => setPanTool(false)}><Crosshair size={18} /></button><button type="button" aria-label="PDF-Ansicht verschieben" title="PDF-Ansicht verschieben" aria-pressed={panTool} className={panTool ? 'is-active' : ''} onClick={() => setPanTool(true)}><Hand size={18} /></button><span className="fpdf-tool-separator" /></>}
                <button type="button" aria-label="PDF verkleinern" title="Verkleinern" disabled={view.zoom <= .5} onClick={() => zoomTo(view.zoom / 1.25)}><Minus size={17} /></button><output aria-label="PDF-Zoom">{Math.round(view.zoom * 100)} %</output><button type="button" aria-label="PDF vergrößern" title="Vergrößern" disabled={view.zoom >= 8} onClick={() => zoomTo(view.zoom * 1.25)}><Plus size={17} /></button><button type="button" aria-label="PDF einpassen" title="Seite einpassen" onClick={() => setView({ zoom: 1, pan: { x: 0, y: 0 } })}><ArrowsOut size={18} /></button>
              </div>
          </div>}
          <p className="fpdf-canvas-footer">{calibrated ? 'Maße werden aus dem gespeicherten Wandmaß berechnet.' : 'Die PDF-Größe allein legt keinen verlässlichen Raummaßstab fest.'}</p>
          <span id={keyboardHelpId} className="visually-hidden">Pfeiltasten bewegen den Markierungszeiger. Mit Umschalt bewegt er sich schneller. Enter setzt einen Punkt. Plus und Minus ändern die Ansicht. Escape bricht die Markierung ab. Alternativ kannst du die Position als Prozentwert der Seite eingeben.</span>
        </div>
      </div>
    </>}
    {pendingAction && <Dialog title="Markierung verwerfen?" onClose={() => setPendingAction(null)}>
      <p>{pendingAction.kind === 'page' ? `Die laufende Markierung ist noch nicht übernommen. Beim Wechsel auf Seite ${pendingAction.page} wird sie verworfen.` : pendingAction.kind === 'file' ? 'Die laufende Markierung ist noch nicht übernommen. Beim Öffnen der gewählten PDF wird sie verworfen.' : 'Die laufende Markierung ist noch nicht übernommen. Möchtest du sie abbrechen?'}</p>
      <p className="muted">{pendingAction.kind === 'file' ? 'Gespeicherte Raumpläne bleiben erhalten. Eine andere PDF löst ihre bisherige PDF-Zuordnung.' : 'Gespeicherte Räume und Maßstäbe bleiben erhalten.'}</p>
      <div className="dialog-actions"><button type="button" className="button" onClick={() => setPendingAction(null)}>Weiter markieren</button><button type="button" className="button primary" onClick={() => {
        const action = pendingAction; setPendingAction(null);
        if (action.kind === 'page') perform(() => onPageChange(action.page), 'Die Seite konnte nicht gewechselt werden.');
        else if (action.kind === 'file') void importFile(action.file, true);
        else discard();
      }}>{pendingAction.kind === 'page' ? 'Verwerfen und Seite wechseln' : pendingAction.kind === 'file' ? 'Verwerfen und PDF öffnen' : 'Markierung verwerfen'}</button></div>
    </Dialog>}
    {dropActive && <div className="fpdf-drop-overlay" aria-hidden="true"><UploadSimple size={32} /><strong>PDF zum Öffnen ablegen</strong></div>}
  </div>;
}
