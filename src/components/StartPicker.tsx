import { useEffect, useRef, useState } from 'react';
import type { LayoutStart, Point, Project } from '../types';
import { startLabel } from '../lib/layout-start';

type Kind = LayoutStart['kind'];
export function StartPicker({ kind, points, room, onKind, onPick, onCancel }: {
  kind: Kind; points: Point[]; room: Project['room']; onKind: (kind: Kind) => void;
  onPick: (start: LayoutStart) => void; onCancel: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.scrollIntoView({ block: 'start' });
    panel.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }, []);
  return <section ref={panel} className="start-picker" aria-label="Start im Raumplan wählen">
    <div className="start-picker-row">
      <strong>Wo beginnt die erste Fliese?</strong>
      <div className="start-kind" role="group" aria-label="Art der Startposition">
        <button type="button" aria-pressed={kind === 'corner'} onClick={() => onKind('corner')}>Ecke</button>
        <button type="button" aria-pressed={kind === 'side'} onClick={() => onKind('side')}>Wandmitte</button>
      </div>
      <button type="button" className="button start-cancel" onClick={onCancel}>Abbrechen</button>
    </div>
    <div className="start-picker-help">
      <p id="start-pick-help">{kind === 'corner' ? 'Einen Eckpunkt im Plan anklicken.' : 'Einen Punkt in der Wandmitte anklicken.'} Ziehen verschiebt die Ansicht.</p>
      <details><summary>Aus Liste wählen</summary>
        <select aria-label={kind === 'corner' ? 'Startecke aus Liste' : 'Startwand aus Liste'} value="" onChange={event => {
          if (event.target.value !== '') onPick({ kind, index: Number(event.target.value) });
        }}>
          <option value="" disabled>Position wählen …</option>
          {points.map((_, index) => <option key={index} value={index}>{index + 1} · {startLabel(room, { kind, index })}</option>)}
        </select>
      </details>
    </div>
  </section>;
}

export function startTargets(points: Point[], kind: Kind): Point[] {
  return kind === 'corner' ? points : points.map((p, index) => {
    const end = points[(index + 1) % points.length];
    return { x: (p.x + end.x) / 2, y: (p.y + end.y) / 2 };
  });
}

export function StartTargets({ points, room, kind, current, unit, onPick, onPointerPick, targetAt }: {
  points: Point[]; room: Project['room']; kind: Kind; current?: LayoutStart; unit: number;
  onPick: (start: LayoutStart) => void; onPointerPick: (x: number, y: number) => void;
  targetAt: (x: number, y: number) => number | null;
}) {
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => setActive(null), [kind]);
  return <g className="start-targets" aria-label={kind === 'corner' ? 'Eckpunkte' : 'Wandmitten'}>
    {active !== null && <polyline pointerEvents="none"
      points={(kind === 'corner' ? [points[(active + points.length - 1) % points.length], points[active], points[(active + 1) % points.length]] : [points[active], points[(active + 1) % points.length]]).map(p => `${p.x},${p.y}`).join(' ')}
      fill="none" stroke="#245d4a" strokeWidth="5" vectorEffect="non-scaling-stroke" />}
    {startTargets(points, kind).map((point, index) => {
      const selected = current?.kind === kind && current.index === index;
      const label = startLabel(room, { kind, index });
      return <g key={index} className="start-target" role="button" tabIndex={0}
        aria-label={`${kind === 'corner' ? 'Ecke' : 'Wandmitte'} ${index + 1}: ${label} als Start wählen`}
        aria-pressed={selected} aria-describedby="start-pick-help"
        onPointerEnter={event => setActive(targetAt(event.clientX, event.clientY))}
        onPointerMove={event => setActive(targetAt(event.clientX, event.clientY))} onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(index)} onBlur={() => setActive(null)}
        onClick={event => { event.stopPropagation();
          if (event.detail === 0) onPick({ kind, index });
          else onPointerPick(event.clientX, event.clientY);
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault(); event.stopPropagation(); onPick({ kind, index });
          }
        }}>
        <title>{active === null ? label : startLabel(room, { kind, index: active })}</title>
        <rect x={point.x - 22 * unit} y={point.y - 22 * unit} width={44 * unit} height={44 * unit} fill="transparent" />
        <circle className="start-target-ring" cx={point.x} cy={point.y} r={18 * unit} fill="none" stroke="#245d4a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <circle cx={point.x} cy={point.y} r={13 * unit} fill={selected || active === index ? '#245d4a' : '#fff'} stroke="#245d4a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <text x={point.x} y={point.y} textAnchor="middle" dominantBaseline="central" fontSize={12 * unit} fontWeight="700" fill={selected || active === index ? '#fff' : '#245d4a'} pointerEvents="none">{index + 1}</text>
      </g>;
    })}
  </g>;
}
