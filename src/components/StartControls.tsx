import { Crosshair } from '@phosphor-icons/react';
import type { Project } from '../types';
import { startLabel } from '../lib/layout-start';

export default function StartControls({ project, onChange, onPick, disabled }: {
  project: Project; onChange: (project: Project) => void; onPick: () => void; disabled: boolean;
}) {
  const { layout, room } = project;
  const start = layout.start;
  return <section className="fp-control-section" aria-label="Startfliese festlegen">
    <h3 className="fp-section-title">Startfliese</h3>
    <p className="fp-start-current">{start ? startLabel(room, start) : 'Noch kein Start gewählt'}</p>
    <button type="button" className="fp-action-button" disabled={disabled} onClick={onPick}><Crosshair size={17}/>Im Raumplan wählen</button>
    <p className="fp-help">Klicke im großen Plan auf eine Ecke oder Wandmitte. „Start 1“ zeigt danach die erste Fliese. Die Randfuge bleibt frei.</p>
    {start && <>
      <p className="fp-help">Bei schrägen Wänden, gedrehten Mustern oder Hindernissen kann dort ein Zuschnitt liegen.</p>
      {(layout.offsetX !== 0 || layout.offsetY !== 0) && <button type="button" className="fp-action-button" onClick={() => onChange({ ...project, layout: { ...layout, offsetX: 0, offsetY: 0 } })}>Am Start neu ausrichten</button>}
      <button type="button" className="fp-action-button" onClick={() => {
        const { start: _start, ...rest } = layout;
        onChange({ ...project, layout: { ...rest, offsetX: 0, offsetY: 0 } });
      }}>Start aufheben</button>
      <p className="fp-help">„Start aufheben“ setzt auch den Versatz auf null.</p>
    </>}
  </section>;
}
