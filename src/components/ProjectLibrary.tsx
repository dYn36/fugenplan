import { ArrowLeft, ArrowRight, Buildings, DotsThree, FileArrowUp, Plus, Stack } from '@phosphor-icons/react';
import type { BuildingProject, ProjectLibrary as Library, Workspace } from '../floorplan-types';
import { getBounds, getRoomPolygon } from '../lib/geometry';
import { calibrationScale } from '../lib/calibration';
import './ProjectLibrary.css';

function ProjectPreview({ workspace }: { workspace?: Workspace }) {
  const polygons = (workspace?.rooms ?? []).flatMap(room => {
    const source = room.source;
    const page = source && workspace?.floorPlan?.pages[source.page - 1];
    const scale = page?.calibration ? calibrationScale(page.calibration) : null;
    const origin = source && scale && source.page === workspace?.floorPlan?.activePage
      ? { x: source.origin.x * scale, y: source.origin.y * scale }
      : room.placement;
    return origin ? [getRoomPolygon(room.project.room).map(p => ({ x: p.x + origin.x, y: p.y + origin.y }))] : [];
  });
  if (!polygons.length) return <span className="library-preview-empty" aria-hidden="true"><Buildings size={42} weight="light"/></span>;
  const bounds = getBounds(polygons.flat());
  const pad = Math.max(bounds.width, bounds.height) * .1;
  return <svg aria-hidden="true" viewBox={`${bounds.minX-pad} ${bounds.minY-pad} ${bounds.width+pad*2} ${bounds.height+pad*2}`}>
    {polygons.map((points, i) => <polygon key={i} points={points.map(p=>`${p.x},${p.y}`).join(' ')} fill="var(--soft)" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}
  </svg>;
}

export default function ProjectLibrary({ library, onOpen, onCreate, onImport, onManage }: {
  library: Library;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onImport: () => void;
  onManage: (id: string) => void;
}) {
  return <section className="library-view" aria-label="Projekte">
    <div className="library-heading"><div><h1>Deine Projekte</h1><p>Grundrisse, Etagen und Verlegepläne an einem Ort.</p></div>{library.projects.length>0&&<button className="button primary" onClick={onCreate}><Plus size={18}/>Neues Projekt</button>}</div>
    {library.projects.length ? <div className="library-projects">{library.projects.map(building => {
      const rooms = building.floors.reduce((count, floor) => count + floor.workspace.rooms.length, 0);
      const cover = building.floors.find(floor => floor.workspace.rooms.some(room => room.source || room.placement)) ?? building.floors[0];
      return <article className="library-project" key={building.id}>
        <button className="library-project-open" onClick={()=>onOpen(building.id)} aria-label={`${building.name} öffnen`}>
          <span className="library-project-preview"><ProjectPreview workspace={cover?.workspace}/></span>
          <span className="library-project-info"><strong>{building.name}</strong><span>{building.floors.length} {building.floors.length===1?'Etage':'Etagen'} · {rooms} {rooms===1?'Raum':'Räume'}</span><small>{building.floors.map(floor=>floor.name).join(' · ') || 'Noch keine Etagen'}</small></span>
          <ArrowRight size={20}/>
        </button>
        <button className="icon-button library-project-menu" aria-label={`${building.name} verwalten`} onClick={()=>onManage(building.id)}><DotsThree size={24}/></button>
      </article>;
    })}</div> : <div className="library-empty"><Buildings size={52} weight="light"/><h2>Platz für dein erstes Projekt.</h2><p>Lege ein Projekt an. Danach ergänze die Etagen und übernimm die Räume aus deinem Grundriss.</p><button className="button primary" onClick={onCreate}><Plus size={18}/>Projekt anlegen</button></div>}
    <button className="library-import" onClick={onImport}><FileArrowUp size={18}/>Gespeichertes Projekt importieren</button>
    <p className="library-local">Auf diesem Gerät gespeichert. Sichere deine Planung als Projektdatei.</p>
  </section>;
}

export function ProjectNavigator({ building, onBack, onSelectFloor, onAddFloor, onManage, onManageFloor }: {
  building: BuildingProject;
  onBack: () => void;
  onSelectFloor: (id: string) => void;
  onAddFloor: () => void;
  onManage: () => void;
  onManageFloor: (id: string) => void;
}) {
  return <aside className="project-navigator" aria-label="Projektnavigation">
    <button className="project-back" onClick={onBack}><ArrowLeft size={17}/>Projekte</button>
    <div className="navigator-project"><strong>{building.name}</strong><button className="icon-button" onClick={onManage} aria-label="Projekt verwalten"><DotsThree size={23}/></button></div>
    <div className="navigator-label"><span>Etagen</span></div>
    <nav className="floor-navigation" aria-label="Etagen">{building.floors.map(floor=><div key={floor.id} className={`floor-navigation-row${floor.id===building.activeFloorId?' is-current':''}`}>
      <button aria-current={floor.id===building.activeFloorId?'page':undefined} aria-label={`${floor.name} öffnen`} onClick={()=>onSelectFloor(floor.id)}><Stack size={18}/><span>{floor.name}<small>{floor.workspace.rooms.length} {floor.workspace.rooms.length===1?'Raum':'Räume'}</small></span></button>
      <button className="icon-button" onClick={()=>onManageFloor(floor.id)} aria-label={`${floor.name} verwalten`}><DotsThree size={20}/></button>
    </div>)}</nav>
    <button className="navigator-add-floor" onClick={onAddFloor}><Plus size={17}/>Etage hinzufügen</button>
  </aside>;
}
