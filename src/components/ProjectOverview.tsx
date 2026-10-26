import { useRef, type Dispatch, type SetStateAction } from 'react';
import { ArrowRight, FilePdf, Plus, Scissors, Trash, WarningCircle } from '@phosphor-icons/react';
import type { Workspace } from '../floorplan-types';
import { MAX_ROOMS } from '../lib/workspace';
import { formatArea, formatNumber, PATTERN_NAMES } from '../lib/project';
import { useRoomPlans } from '../lib/useRoomPlans';
import { FloorDrawing } from './PlanCanvas';
import './ProjectOverview.css';

type Props = {
  workspace: Workspace;
  onOpenRoom: (id: string) => void;
  onAddRoom: () => void;
  onRemoveRoom: (id: string) => void;
  onFloorPlan: () => void;
  hiddenRooms: string[];
  setHiddenRooms: Dispatch<SetStateAction<string[]>>;
  showCuts: boolean;
  onToggleCuts: () => void;
};

export default function ProjectOverview({ workspace, onOpenRoom, onAddRoom, onRemoveRoom, onFloorPlan, hiddenRooms, setHiddenRooms, showCuts, onToggleCuts }: Props) {
  const roomChoices = useRef<HTMLDivElement>(null);
  const plans = useRoomPlans(workspace.rooms);
  const selectRooms = (hidden: string[]) => {
    setHiddenRooms(hidden);
    roomChoices.current?.querySelector<HTMLInputElement>('input')?.focus();
  };
  const visibleRooms = workspace.rooms.filter(room => !hiddenRooms.includes(room.id));
  const availablePlans = visibleRooms.flatMap(room => {
    const plan = plans[room.id];
    return plan?.project === room.project && plan.result ? [plan.result] : [];
  });
  const extent = Math.max(1000, ...availablePlans.map(plan => Math.max(plan.bounds.width, plan.bounds.height * 4 / 3))) * 1.15;
  const totalArea = availablePlans.reduce((area, plan) => area + plan.roomArea, 0);
  const finished = visibleRooms.every(room => plans[room.id]?.project === room.project);

  return <section className="project-overview" aria-label="Projektübersicht">
    <div className="project-actions">
      <div>
        <button className="button" disabled={workspace.rooms.length >= MAX_ROOMS} onClick={onAddRoom}><Plus size={18}/>Raum hinzufügen</button>
        <button className="button primary" onClick={onFloorPlan}><FilePdf size={18}/>{workspace.floorPlan ? 'Grundriss bearbeiten' : 'PDF-Grundriss übernehmen'}</button>
      </div>
    </div>
    <fieldset className="project-room-selection">
      <legend>Räume anzeigen</legend>
      <div ref={roomChoices} className="project-room-choices">
        {workspace.rooms.map(room => <label key={room.id} className={hiddenRooms.includes(room.id) ? '' : 'is-visible'}>
          <input type="checkbox" checked={!hiddenRooms.includes(room.id)} onChange={event => setHiddenRooms(current => event.target.checked ? current.filter(id => id !== room.id) : [...current, room.id])}/>
          <span title={room.project.name}>{room.project.name}</span>
        </label>)}
      </div>
      <div className="project-selection-actions">
        <button onClick={() => selectRooms([])} disabled={visibleRooms.length === workspace.rooms.length}>Alle anzeigen</button>
        <button onClick={() => selectRooms(workspace.rooms.map(room => room.id))} disabled={!visibleRooms.length}>Auswahl aufheben</button>
      </div>
    </fieldset>
    <div className="project-summary">
      <p aria-live="polite"><strong>{visibleRooms.length} von {workspace.rooms.length} Räumen</strong>{availablePlans.length > 0 && <> · {formatArea(totalArea)}{availablePlans.length < visibleRooms.length ? ' berechnet' : ' Raumfläche'}</>}{!finished && ' · Pläne werden berechnet …'}</p>
      <button className={`button${showCuts ? ' primary' : ''}`} aria-pressed={showCuts} onClick={onToggleCuts}><Scissors size={17}/>Zuschnitte</button>
    </div>
    {visibleRooms.length > 0 ? <>
      <div className="project-room-grid">
        {visibleRooms.map(room => {
          const state = plans[room.id]?.project === room.project ? plans[room.id] : undefined;
          const plan = state?.result;
          return <article className="project-room" key={room.id} aria-label={`Raum ${room.project.name}`}>
            <div className="project-room-heading">
              <div><h2>{room.project.name}</h2><p>{room.source ? `PDF · Seite ${room.source.page}` : 'Manuell angelegt'}{plan && <> · {formatArea(plan.roomArea)}</>}</p></div>
              <button className="icon-button" aria-label={`${room.project.name} entfernen`} disabled={workspace.rooms.length === 1} onClick={() => onRemoveRoom(room.id)}><Trash size={18}/></button>
            </div>
            <button className="project-room-preview" aria-label={`${room.project.name} bearbeiten`} onClick={() => onOpenRoom(room.id)}>
              {plan ? <svg role="img" aria-label={`Verlegeplan ${room.project.name}`} viewBox={`${plan.bounds.minX + (plan.bounds.width - extent) / 2} ${plan.bounds.minY + (plan.bounds.height - extent * .75) / 2} ${extent} ${extent * .75}`}>
                <FloorDrawing project={room.project} result={plan} showCuts={showCuts} showStart={false}/>
              </svg> : state?.error ? <span className="project-room-error"><WarningCircle size={26}/>{state.error}</span> : <span>Plan wird berechnet …</span>}
            </button>
            <div className="project-room-description">
              <p>{PATTERN_NAMES[room.project.layout.pattern]} · {formatNumber(room.project.material.width / 10)} × {formatNumber(room.project.material.height / 10)} cm</p>
              {plan && <p>{plan.cutCount} Zuschnitte · {formatNumber(plan.wastePercent)} % Verschnitt</p>}
              <button className="button" onClick={() => onOpenRoom(room.id)}>Raum bearbeiten<ArrowRight size={17}/></button>
            </div>
          </article>;
        })}
      </div>
      <p className="project-scale-note">Alle Vorschauen haben denselben Maßstab auf dem Bildschirm. Hindernisflächen sind von den Raumflächen abgezogen. Materialmengen stehen im jeweiligen Raumplan.</p>
    </> : <div className="project-empty"><h2>Keine Räume ausgewählt</h2><p>Wähle oben mindestens einen Raum für die Vorschau.</p><button className="button" onClick={() => selectRooms([])}>Alle Räume anzeigen</button></div>}
  </section>;
}
