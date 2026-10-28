import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { ArrowRight, ArrowsOut, ArrowsOutCardinal, FilePdf, MapTrifold, Minus, Plus, Scissors, Trash, WarningCircle } from '@phosphor-icons/react';
import type { Workspace, WorkspaceRoom } from '../floorplan-types';
import type { Bounds, Point } from '../types';
import { MAX_PLACEMENT_MM, MAX_ROOMS } from '../lib/workspace';
import { formatArea, formatNumber, PATTERN_NAMES } from '../lib/project';
import { dragPlacement, getFloorLayout, roomLabelPoint } from '../lib/floor-layout';
import { useRoomPlans, type RoomPlan } from '../lib/useRoomPlans';
import { getRoomPolygon } from '../lib/geometry';
import { FloorDrawing } from './PlanCanvas';
import { useFloorTemplate } from './useFloorTemplate';
import Dialog from './Dialog';
import './ProjectOverview.css';

type Props = {
  workspace: Workspace;
  floorName: string;
  pdfBytes: Uint8Array | null;
  onOpenRoom: (id: string) => void;
  onAddRoom: () => void;
  onRemoveRoom: (id: string) => void;
  onFloorPlan: () => void;
  onPlaceRoom: (id: string, placement: Point | null) => void;
  showCuts: boolean;
  onToggleCuts: () => void;
};
const polygonPoints = (points: Point[]) => points.map(point => `${point.x},${point.y}`).join(' ');
const coordinate = (input: string) => Number(input.trim().replace(',', '.')) * 10;
const coordinateText = (millimetres: number) => String(Number((millimetres / 10).toPrecision(15)));
const MemoFloorDrawing = memo(FloorDrawing);
type FloorDrag = { pointerId: number; client: Point; pan: Point; unit: number; moved: boolean; roomId?: string; roomOrigin?: Point };

export default function ProjectOverview({ workspace, floorName, pdfBytes, onOpenRoom, onAddRoom, onRemoveRoom, onFloorPlan, onPlaceRoom, showCuts, onToggleCuts }: Props) {
  const plans = useRoomPlans(workspace.rooms);
  const layout = useMemo(() => getFloorLayout(workspace), [workspace]);
  const [showTemplate, setShowTemplate] = useState(true);
  const template = useFloorTemplate(pdfBytes, workspace.floorPlan?.id, workspace.floorPlan?.activePage);
  const [placing, setPlacing] = useState<WorkspaceRoom | null>(null);
  const [position, setPosition] = useState({ x: '', y: '' });
  const [positionError, setPositionError] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 900, height: 480 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [arranging, setArranging] = useState(false);
  const [arrangementBounds, setArrangementBounds] = useState<Bounds | null>(null);
  const [roomPreview, setRoomPreview] = useState<{ id: string; placement: Point } | null>(null);
  const drag = useRef<FloorDrag | null>(null);
  const suppressClick = useRef(false);
  const manualRooms = layout.placed.filter(item => item.kind === 'manual');
  const roomIdentity = workspace.rooms.map(room => room.id).join('|');
  const available = workspace.rooms.flatMap(room => plans[room.id]?.project === room.project && plans[room.id]?.result ? [plans[room.id].result!] : []);
  const totalArea = available.reduce((total, plan) => total + plan.roomArea, 0);
  const finished = workspace.rooms.every(room => plans[room.id]?.project === room.project);
  const fallbackBounds = { minX: 0, minY: 0, maxX: layout.template?.width ?? 8000, maxY: layout.template?.height ?? 6000, width: layout.template?.width ?? 8000, height: layout.template?.height ?? 6000 };
  const bounds = arrangementBounds ?? layout.bounds ?? fallbackBounds;
  const fit = Math.min(Math.max(size.width - 80, 150) / Math.max(bounds.width, 100), Math.max(size.height - 72, 150) / Math.max(bounds.height, 100));
  const width = size.width / fit / zoom, height = size.height / fit / zoom;
  const view = { x: (bounds.minX + bounds.maxX - width) / 2 + pan.x, y: (bounds.minY + bounds.maxY - height) / 2 + pan.y, width, height };
  const unit = width / size.width;
  const scalePower = 10 ** Math.floor(Math.log10(unit * 90));
  const scaleLength = ([5, 2, 1].find(value => value * scalePower <= unit * 90) ?? 1) * scalePower;
  const scaleLabel = scaleLength >= 1000 ? `${formatNumber(scaleLength / 1000, 2)} m` : `${formatNumber(scaleLength / 10, 2)} cm`;
  const hasDrawing = layout.placed.length > 0 || (layout.template && !!template.image);
  const cancelDrag = () => {
    const current = drag.current;
    drag.current = null;
    setRoomPreview(null);
    suppressClick.current = true;
    if (current && svg.current?.hasPointerCapture(current.pointerId)) svg.current.releasePointerCapture(current.pointerId);
  };
  const finishArrangement = () => { cancelDrag(); setArranging(false); setArrangementBounds(null); };

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width || 900, height: entry.contentRect.height || 480 }));
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasDrawing]);
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [floorName, workspace.floorPlan?.id, workspace.floorPlan?.activePage, bounds.minX, bounds.minY, bounds.width, bounds.height]);
  useEffect(() => { finishArrangement(); }, [floorName, workspace.floorPlan?.id, workspace.floorPlan?.activePage, roomIdentity]);
  useEffect(() => { if (!manualRooms.length) finishArrangement(); }, [manualRooms.length]);
  useEffect(() => {
    if (!arranging) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.target instanceof Element && event.target.closest('dialog')) return;
      event.preventDefault();
      if (drag.current) cancelDrag(); else finishArrangement();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [arranging]);
  const planFor = (room: WorkspaceRoom) => plans[room.id]?.project === room.project ? plans[room.id] : undefined;
  const beginPlacement = (room: WorkspaceRoom) => {
    cancelDrag();
    setPlacing(room);
    setPosition({ x: coordinateText(room.placement?.x ?? 0), y: coordinateText(room.placement?.y ?? 0) });
    setPositionError('');
  };
  const savePlacement = (roomId: string, placement: Point | null) => {
    onPlaceRoom(roomId, placement);
    setPlacing(null);
    window.requestAnimationFrame(() => document.getElementById(`floor-room-open-${roomId}`)?.focus());
  };
  const pointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || drag.current) return;
    const target = event.target instanceof Element ? event.target.closest('[data-room-id]') : null;
    const roomId = target?.getAttribute('data-room-id') ?? undefined;
    const roomOrigin = arranging ? manualRooms.find(item => item.room.id === roomId)?.origin : undefined;
    drag.current = { pointerId: event.pointerId, client: { x: event.clientX, y: event.clientY }, pan, unit, moved: false, roomId, roomOrigin };
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.client.x, dy = event.clientY - current.client.y;
    if (Math.hypot(dx, dy) > 4) current.moved = true;
    if (!current.moved) return;
    if (current.roomOrigin && current.roomId) setRoomPreview({ id: current.roomId, placement: dragPlacement(current.roomOrigin, { x: dx, y: dy }, current.unit) });
    else setPan({ x: current.pan.x - dx * current.unit, y: current.pan.y - dy * current.unit });
  };
  const pointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    const current = drag.current;
    suppressClick.current = true;
    drag.current = null;
    setRoomPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (current.roomOrigin && current.roomId) {
      if (current.moved) {
        const placement = dragPlacement(current.roomOrigin, { x: event.clientX - current.client.x, y: event.clientY - current.client.y }, current.unit);
        if (placement.x !== current.roomOrigin.x || placement.y !== current.roomOrigin.y) onPlaceRoom(current.roomId, placement);
      } else {
        const room = workspace.rooms.find(item => item.id === current.roomId);
        if (room) beginPlacement(room);
      }
    } else if (current.roomId && !current.moved && !arranging) onOpenRoom(current.roomId);
  };

  return <section className="project-overview" aria-label="Projektübersicht">
    <div className="floor-overview-bar">
      <p className="floor-overview-summary" aria-live="polite"><strong>{workspace.rooms.length} {workspace.rooms.length === 1 ? 'Raum' : 'Räume'}</strong>{available.length > 0 && <> · {formatArea(totalArea)}{available.length < workspace.rooms.length ? ' berechnet' : ''}</>}{!finished && <span>Pläne werden berechnet …</span>}</p>
      <div className="floor-overview-actions">
        <button className="button" disabled={workspace.rooms.length >= MAX_ROOMS} onClick={onAddRoom}><Plus size={18}/>Raum hinzufügen</button>
        <button className={`button${workspace.rooms.length ? '' : ' primary'}`} onClick={onFloorPlan}><FilePdf size={18}/>{workspace.floorPlan ? 'Grundriss bearbeiten' : 'PDF-Grundriss laden'}</button>
      </div>
    </div>
    {hasDrawing ? <div className={`floor-drawing-shell${arranging ? ' is-arranging' : ''}`}>
      <div className="floor-drawing-toolbar">
        <span className="floor-template-name" title={workspace.floorPlan?.name}>{workspace.floorPlan ? `${workspace.floorPlan.name} · Seite ${workspace.floorPlan.activePage}` : 'Manuell angeordnet'}</span>
        <div>
          {manualRooms.length > 0 && <button className="button" aria-pressed={arranging} onClick={() => { if (arranging) finishArrangement(); else { setArrangementBounds({ ...bounds }); setArranging(true); } }}><ArrowsOutCardinal size={17}/>{arranging ? 'Anordnen beenden' : 'Räume anordnen'}</button>}
          {layout.template && <button className="button" aria-pressed={showTemplate} disabled={!template.image} onClick={() => setShowTemplate(value => !value)}><FilePdf size={17}/>Vorlage</button>}
          <button className="button" aria-pressed={showCuts} onClick={onToggleCuts}><Scissors size={17}/>Zuschnitte</button>
        </div>
      </div>
      {arranging && <div id="floor-arrangement-help" className="floor-arrangement-help"><span>Manuelle Räume ziehen. Die freie Fläche verschiebt die Ansicht. PDF-Räume bleiben an ihrer Position. Enter öffnet X/Y; Escape verwirft das Ziehen.</span><strong>{roomPreview ? `Vorschau: X ${formatNumber(roomPreview.placement.x / 10)} · Y ${formatNumber(roomPreview.placement.y / 10)} cm` : 'Die Position wird beim Loslassen gespeichert.'}</strong></div>}
      <div ref={container} className="floor-drawing-stage">
        <svg ref={svg} className="floor-drawing-svg" role="group" aria-label={`Etagenplan ${floorName}`} aria-describedby={arranging ? 'floor-arrangement-help' : undefined} tabIndex={0} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelDrag} onLostPointerCapture={() => { if (drag.current) cancelDrag(); }}
          onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
          onKeyDown={event => { if (event.target !== event.currentTarget) return; const step = unit * 60; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); setPan(value => ({ x: value.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), y: value.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) })); } }}>
          <title>{floorName}: Räume an ihrer Position im Grundriss</title>
          {showTemplate && layout.template && template.image && <image href={template.image} x={0} y={0} width={layout.template.width} height={layout.template.height} opacity="0.55" pointerEvents="none" aria-hidden="true"/>}
          {layout.placed.map(item => {
            const state = planFor(item.room), plan = state?.result;
            const center = roomLabelPoint(item.polygon);
            const preview = roomPreview?.id === item.room.id ? roomPreview.placement : item.origin;
            const delta = { x: preview.x - item.origin.x, y: preview.y - item.origin.y };
            const labelWidth = Math.max(64, Math.min(164, item.room.project.name.length * 7 + 24, item.bounds.width / unit - 12)) * unit;
            const activate = () => { if (!arranging) onOpenRoom(item.room.id); else if (item.kind === 'manual') beginPlacement(item.room); };
            return <g key={item.room.id} className={`floor-room-target is-${item.kind}${roomPreview?.id === item.room.id ? ' is-moving' : ''}`} role="button" tabIndex={arranging && item.kind === 'pdf' ? -1 : 0} aria-disabled={arranging && item.kind === 'pdf' ? true : undefined} aria-label={`${item.room.project.name} ${arranging ? item.kind === 'manual' ? 'verschieben' : 'Position aus PDF' : 'bearbeiten'}`} aria-describedby={arranging ? 'floor-arrangement-help' : undefined} data-room-id={item.room.id} data-origin-x={preview.x} data-origin-y={preview.y} data-placement-preview={roomPreview?.id === item.room.id ? 'true' : undefined} transform={`translate(${delta.x} ${delta.y})`}
              onClick={activate} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } }}>
              <g transform={`translate(${item.origin.x} ${item.origin.y})`} aria-hidden="true">{plan ? <MemoFloorDrawing project={item.room.project} result={plan} showCuts={showCuts} showStart={false}/> : <polygon points={polygonPoints(getRoomPolygon(item.room.project.room))} fill="#e5ece6" stroke="#62756a" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray="5 4"/>}</g>
              <polygon className="floor-room-highlight" points={polygonPoints(item.polygon)} fill="transparent" stroke="transparent" strokeWidth="3" vectorEffect="non-scaling-stroke"/>
              <foreignObject x={center.x - labelWidth / 2} y={center.y - 19 * unit} width={labelWidth} height={38 * unit} pointerEvents="none" aria-hidden="true">
                <div className="floor-room-label" style={{ fontSize: 12 * unit, borderRadius: 4 * unit, padding: `${4 * unit}px ${6 * unit}px` }}><strong title={item.room.project.name}>{item.room.project.name}</strong><span style={{ fontSize: 10 * unit }}>{plan ? formatArea(plan.roomArea) : state?.error ? 'Eingaben prüfen' : 'Berechnet …'}</span></div>
              </foreignObject>
            </g>;
          })}
        </svg>
      </div>
      <div className="floor-drawing-footer">
        <div className="floor-drawing-scale" aria-label={`Maßstabsbalken: ${scaleLabel}`}><span style={{ width: scaleLength / unit }}/><small>{scaleLabel}</small></div>
        <div className="floor-zoom" aria-label="Etagenplan vergrößern oder verkleinern">
          <button className="icon-button" aria-label="Etagenplan verkleinern" disabled={zoom <= .5} onClick={() => setZoom(value => Math.max(.5, value / 1.25))}><Minus size={18}/></button>
          <span>{Math.round(zoom * 100)} %</span>
          <button className="icon-button" aria-label="Etagenplan vergrößern" disabled={zoom >= 5} onClick={() => setZoom(value => Math.min(5, value * 1.25))}><Plus size={18}/></button>
          <button className="icon-button" aria-label="Etagenplan einpassen" onClick={() => { if (arranging && layout.bounds) setArrangementBounds({ ...layout.bounds }); setZoom(1); setPan({ x: 0, y: 0 }); }}><ArrowsOut size={18}/></button>
        </div>
        <span className="floor-drawing-hint">{arranging ? 'Raum ziehen: Position ändern' : 'Raum öffnen · Ziehen verschiebt die Ansicht'}</span>
      </div>
    </div> : <div className="floor-empty-drawing">
      <MapTrifold size={40} weight="light" aria-hidden="true"/>
      <h2>{workspace.floorPlan ? layout.template ? 'Räume im Grundriss markieren' : 'Maßstab für diese Etage festlegen' : workspace.rooms.length ? 'Räume im Grundriss anordnen' : 'Der Grundriss für diese Etage'}</h2>
      {workspace.floorPlan && <p className="floor-template-source"><FilePdf size={17} aria-hidden="true"/><span>{workspace.floorPlan.name} · Seite {workspace.floorPlan.activePage}</span></p>}
      <p>{workspace.floorPlan ? layout.template ? 'Der Maßstab ist gespeichert. Markiere jetzt die Innenkonturen der Räume.' : 'Die PDF ist dieser Etage zugeordnet. Markiere eine bekannte Wand und gib ihre Länge ein.' : workspace.rooms.length ? 'Lege die Positionen unten fest oder übernimm die Räume aus einer PDF.' : 'Lade eine PDF und markiere die Räume. Du kannst Räume auch mit eigenen Maßen anlegen.'}</p>
      {workspace.floorPlan && <button className="button primary" onClick={onFloorPlan}>{layout.template ? 'Räume im Grundriss markieren' : 'Maßstab festlegen'}</button>}
    </div>}
    {hasDrawing && !workspace.rooms.length && <p className="floor-status">Der Maßstab ist gespeichert. <button onClick={onFloorPlan}>Räume im Grundriss markieren</button></p>}
    {template.loading && workspace.floorPlan && <p className="floor-status" role="status">PDF-Vorlage wird geladen …</p>}
    {template.error && <p className="floor-status floor-status-error" role="status">{template.error}</p>}
    {workspace.floorPlan && !pdfBytes && <p className="floor-status">Die PDF-Vorlage fehlt auf diesem Gerät. <button onClick={onFloorPlan}>PDF erneut öffnen</button></p>}
    {layout.placed.length > 0 && <section className="floor-room-list" aria-label={`Räume in ${floorName}`}>
      <h2>Räume auf dieser Etage</h2>
      {layout.placed.map(item => <RoomRow key={item.room.id} room={item.room} state={planFor(item.room)} showCuts={showCuts} location={item.kind === 'pdf' ? 'Position aus PDF' : `X ${formatNumber(item.origin.x / 10)} · Y ${formatNumber(item.origin.y / 10)} cm`} onOpen={() => onOpenRoom(item.room.id)} onRemove={() => onRemoveRoom(item.room.id)} onPlace={item.kind === 'manual' ? () => beginPlacement(item.room) : undefined}/>) }
    </section>}
    {layout.unplaced.length > 0 && <section className="floor-room-list floor-unplaced" aria-label="Noch nicht angeordnete Räume">
      <h2>Noch nicht angeordnet <span>{layout.unplaced.length}</span></h2>
      <p>Diese Räume haben noch keine Position in der Etagenzeichnung.</p>
      {layout.unplaced.map(item => <RoomRow key={item.room.id} room={item.room} state={planFor(item.room)} showCuts={showCuts}
        location={item.reason === 'other-page' ? `Auf PDF-Seite ${item.room.source!.page}` : item.reason === 'reference-missing' ? 'PDF-Zuordnung prüfen' : 'Position fehlt'}
        onOpen={() => onOpenRoom(item.room.id)} onRemove={() => onRemoveRoom(item.room.id)} onPlace={!item.room.source ? () => beginPlacement(item.room) : undefined}/>) }
    </section>}
    {placing && <Dialog title={`Position von „${placing.project.name}“`} onClose={() => setPlacing(null)}><form onSubmit={event => {
      event.preventDefault();
      const x = coordinate(position.x), y = coordinate(position.y);
      if (!position.x.trim() || !position.y.trim() || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > MAX_PLACEMENT_MM || Math.abs(y) > MAX_PLACEMENT_MM) { setPositionError('Gib X und Y zwischen −100.000 und 100.000 cm ein.'); return; }
      savePlacement(placing.id, { x, y });
    }}>
      <p className="floor-placement-help">Position des Raumursprungs in dieser Etage. X wächst nach rechts, Y nach unten. {workspace.floorPlan ? 'Der Nullpunkt ist die linke obere Ecke der PDF-Seite.' : 'Nutze denselben Nullpunkt für alle Räume.'}</p>
      <div className="floor-position-fields"><label>X in cm<input autoFocus inputMode="decimal" value={position.x} onChange={event => setPosition(value => ({ ...value, x: event.target.value }))}/></label><label>Y in cm<input inputMode="decimal" value={position.y} onChange={event => setPosition(value => ({ ...value, y: event.target.value }))}/></label></div>
      {positionError && <p role="alert" className="inline-warning">{positionError}</p>}
      <div className="dialog-actions floor-placement-actions">{placing.placement && <button className="button" type="button" onClick={() => savePlacement(placing.id, null)}>Position aufheben</button>}<button className="button" type="button" onClick={() => setPlacing(null)}>Abbrechen</button><button className="button primary" type="submit">Position speichern</button></div>
    </form></Dialog>}
  </section>;
}

function RoomRow({ room, state, showCuts, location, onOpen, onRemove, onPlace }: { room: WorkspaceRoom; state: RoomPlan | undefined; showCuts: boolean; location: string; onOpen: () => void; onRemove: () => void; onPlace?: () => void }) {
  const plan = state?.result;
  return <article className="floor-room-row" aria-label={`Raum ${room.project.name}`}>
    <button id={`floor-room-open-${room.id}`} className="floor-room-open" onClick={onOpen} aria-label={`${room.project.name} bearbeiten`}>
      <span className="floor-room-thumbnail" aria-hidden="true">{plan ? <svg viewBox={`${plan.bounds.minX - 150} ${plan.bounds.minY - 150} ${plan.bounds.width + 300} ${plan.bounds.height + 300}`}><MemoFloorDrawing project={room.project} result={plan} showCuts={showCuts} showStart={false}/></svg> : state?.error ? <WarningCircle size={22}/> : <span>…</span>}</span>
      <span className="floor-room-name"><strong>{room.project.name}</strong><small>{PATTERN_NAMES[room.project.layout.pattern]} · {formatNumber(room.project.material.width / 10)} × {formatNumber(room.project.material.height / 10)} cm</small>{state?.error && <small className="floor-room-error">{state.error}</small>}</span><ArrowRight size={17}/>
    </button>
    <div className="floor-room-facts"><strong>{plan ? formatArea(plan.roomArea) : state?.error ? 'Eingaben prüfen' : 'Berechnet …'}</strong><small>{location}</small></div>
    <div className="floor-room-actions">{onPlace && <button className="button" aria-label={`Position von ${room.project.name} festlegen`} onClick={onPlace}><ArrowsOutCardinal size={17}/>{room.placement ? 'Position ändern' : 'Anordnen'}</button>}<button className="icon-button" aria-label={`${room.project.name} entfernen`} onClick={onRemove}><Trash size={18}/></button></div>
  </article>;
}
