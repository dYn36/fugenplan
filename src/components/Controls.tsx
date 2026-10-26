import { memo, useEffect, useId, useRef, useState } from 'react';
import { CaretDown, Check, Crosshair, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import type { LayoutConfig, MaterialConfig, Pattern, Point, Project, RoomConfig } from '../types';
import { updateRoom } from '../lib/project';
import StartControls from './StartControls';
import './Controls.css';

type ControlsProps = {
  project: Project;
  onChange: (project: Project) => void;
  onCenter: () => void;
  onDraw: () => void;
  onPickStart: () => void;
  startDisabled: boolean;
};

type NumericFieldProps = {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  unit?: string;
  divisor?: number;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  hint?: string;
  accessibleLabel?: string;
};

const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 4, useGrouping: false });
const format = (value: number) => numberFormat.format(value);

function parseNumber(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function NumericField({ label, value, onCommit, unit, divisor = 1, min, max, step = 1, integer, hint, accessibleLabel }: NumericFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(() => format(value / divisor));
  const [error, setError] = useState('');
  const focused = useRef(false);
  const cancelBlur = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setDraft(format(value / divisor));
      setError('');
    }
  }, [value, divisor]);

  const commit = () => {
    focused.current = false;
    if (cancelBlur.current) {
      cancelBlur.current = false;
      return;
    }
    const parsed = parseNumber(draft);
    if (parsed === null) {
      setError('Bitte eine Zahl eingeben.');
      return;
    }
    const next = Math.round(parsed * divisor * 1000) / 1000;
    if (integer && !Number.isInteger(next)) {
      setError('Bitte eine ganze Zahl eingeben.');
      return;
    }
    if (next < min || next > max) {
      setError(`Erlaubt: ${format(min / divisor)} bis ${format(max / divisor)}${unit ? ` ${unit}` : ''}.`);
      return;
    }
    setError('');
    setDraft(format(next / divisor));
    if (next !== value) onCommit(next);
  };

  return (
    <div className={`fp-field${error ? ' fp-field--invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="fp-input-wrap">
        <input
          id={id}
          type="text"
          inputMode={integer ? 'numeric' : 'decimal'}
          autoComplete="off"
          spellCheck={false}
          value={draft}
          aria-label={accessibleLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={[unit ? `${id}-unit` : '', error ? `${id}-error` : hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined}
          onFocus={() => { focused.current = true; }}
          onChange={(event) => { setDraft(event.target.value); setError(''); }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelBlur.current = true;
              setDraft(format(value / divisor));
              setError('');
              event.currentTarget.blur();
            }
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault();
              const current = parseNumber(draft) ?? value / divisor;
              const delta = (event.key === 'ArrowUp' ? step : -step) / divisor;
              setDraft(format(Math.min(max / divisor, Math.max(min / divisor, current + delta))));
              setError('');
            }
          }}
        />
        {unit && <span className="fp-input-unit" id={`${id}-unit`}>{unit}</span>}
      </div>
      {error ? <p className="fp-field-error" id={`${id}-error`} role="alert">{error}</p> : hint && <p className="fp-field-hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}

function NameField({ name, onCommit }: { name: string; onCommit: (name: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState('');
  useEffect(() => { setDraft(name); setError(''); }, [name]);
  const cancelBlur = useRef(false);

  return <div className={`fp-field${error ? ' fp-field--invalid' : ''}`}>
    <label htmlFor={id}>Raumname</label>
    <input id={id} type="text" value={draft} maxLength={100} autoComplete="off"
      aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
      onChange={(event) => { setDraft(event.target.value); setError(''); }}
      onBlur={() => {
        if (cancelBlur.current) { cancelBlur.current = false; return; }
        const next = draft.trim();
        if (!next) { setError('Bitte einen Namen eingeben.'); return; }
        setDraft(next);
        if (next !== name) onCommit(next);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === 'Escape') {
          event.preventDefault(); cancelBlur.current = true; setDraft(name); setError(''); event.currentTarget.blur();
        }
      }} />
    {error && <p className="fp-field-error" id={`${id}-error`} role="alert">{error}</p>}
  </div>;
}

const patterns: { value: Pattern; label: string }[] = [
  { value: 'grid', label: 'Kreuzverband' },
  { value: 'half', label: 'Halbverband' },
  { value: 'third', label: 'Drittelverband' },
  { value: 'quarter', label: 'Viertelverband' },
  { value: 'random', label: 'Wilder Verband' },
  { value: 'diagonal', label: 'Diagonalverband' },
  { value: 'herringbone', label: 'Fischgrät' },
];

const PatternPreview = memo(function PatternPreview({ pattern }: { pattern: Pattern }) {
  const clipId = useId();
  const tiles: { x: number; y: number; width: number; height: number }[] = [];
  if (pattern === 'herringbone') {
    // Two perpendicular elements form each repeating pair.
    for (let row = -5; row < 6; row++) {
      for (let col = -5; col < 6; col++) {
        const x = col * 30 + row * 10;
        const y = col * -30 + row * 10;
        tiles.push({ x, y, width: 28, height: 8 });
        tiles.push({ x, y: y + 10, width: 8, height: 28 });
      }
    }
  } else {
    for (let row = -4; row < 9; row++) {
      const shift = pattern === 'half' ? row * 16 : pattern === 'third' ? row * 32 / 3 : pattern === 'quarter' ? row * 8 : pattern === 'random' ? [0, 13, 5, 21, 9][((row % 5) + 5) % 5] : 0;
      for (let col = -5; col < 7; col++) {
        tiles.push({ x: col * 32 + shift, y: row * 14, width: 30, height: 12 });
      }
    }
  }
  return <svg viewBox="0 0 100 48" className="fp-pattern-preview" aria-hidden="true" focusable="false">
    <defs><clipPath id={clipId}><rect x="0" y="0" width="100" height="48" rx="3" /></clipPath></defs>
    <g clipPath={`url(#${clipId})`}>
      <rect width="100" height="48" className="fp-pattern-background" />
      <g transform={pattern === 'diagonal' || pattern === 'herringbone' ? 'rotate(45 50 24)' : undefined}>
        {tiles.map((tile, i) => <rect key={i} {...tile} rx="0.5" className="fp-pattern-tile" />)}
      </g>
    </g>
  </svg>;
});

function roomPoints(room: RoomConfig): Point[] {
  if (room.shape === 'custom' && room.points.length >= 3) return room.points;
  const { width: w, height: h, notchWidth: nw, notchHeight: nh } = room;
  if (room.shape === 'l-shape') return [{ x: 0, y: 0 }, { x: w - nw, y: 0 }, { x: w - nw, y: nh }, { x: w, y: nh }, { x: w, y: h }, { x: 0, y: h }];
  return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
}

const tileFormats = [
  { label: '12 × 30 cm', width: 120, height: 300 },
  { label: '60 × 60 cm', width: 600, height: 600 },
  { label: '60 × 30 cm', width: 600, height: 300 },
  { label: '120 × 60 cm', width: 1200, height: 600 },
  { label: '30 × 30 cm', width: 300, height: 300 },
  { label: '20 × 20 cm', width: 200, height: 200 },
  { label: '20 × 10 cm', width: 200, height: 100 },
];
const woodFormats = [
  { label: '120 × 20 cm', width: 1200, height: 200 },
  { label: '180 × 20 cm', width: 1800, height: 200 },
  { label: '220 × 18 cm', width: 2200, height: 180 },
  { label: '60 × 12 cm', width: 600, height: 120 },
];
const finishes: { value: MaterialConfig['color']; name: string; color: string }[] = [
  { value: 'limestone', name: 'Kalkstein', color: '#d5ccbb' },
  { value: 'chalk', name: 'Kreide', color: '#e7e5df' },
  { value: 'slate', name: 'Schiefer', color: '#66716c' },
  { value: 'oak', name: 'Eiche', color: '#c19b6b' },
];

export default function Controls({ project, onChange, onCenter, onDraw, onPickStart, startDisabled }: ControlsProps) {
  const [tab, setTab] = useState<'room' | 'material' | 'layout'>('room');
  const panelId = useId();
  const formatId = useId();
  const { room, material, layout } = project;
  const setRoom = (next: Partial<RoomConfig>) => onChange(updateRoom(project, next));
  const setMaterial = (next: Partial<MaterialConfig>) => onChange({ ...project, material: { ...material, ...next } });
  const setLayout = (next: Partial<LayoutConfig>) => onChange({ ...project, layout: { ...layout, ...next } });
  const formats = material.kind === 'tile' ? tileFormats : woodFormats;
  const selectedFormat = formats.findIndex((item) => item.width === material.width && item.height === material.height);
  const setPoint = (index: number, axis: 'x' | 'y', value: number) => {
    setRoom({ points: room.points.map((point, i) => i === index ? { ...point, [axis]: value } : point) });
  };
  const setObstacle = (id: string, field: 'x' | 'y' | 'width' | 'height', value: number) => {
    setRoom({ obstacles: room.obstacles.map((obstacle) => obstacle.id === id ? { ...obstacle, [field]: value } : obstacle) });
  };

  return <div className="fp-controls">
    <div className="fp-controls-tabs" role="group" aria-label="Planeinstellungen">
      {([{ value: 'room', label: 'Raum' }, { value: 'material', label: 'Belag' }, { value: 'layout', label: 'Verlegung' }] as const).map((item) => <button
        type="button" key={item.value} aria-pressed={tab === item.value} aria-controls={panelId}
        className={tab === item.value ? 'is-active' : ''} onClick={() => setTab(item.value)}>{item.label}</button>)}
    </div>
    <div className="fp-controls-panel" id={panelId}>
      {tab === 'room' && <>
        <section className="fp-control-section" aria-label="Raummaße">
          <div className="fp-section-heading"><h2>Dein Raum</h2><p>Innenmaße der Wände eingeben.</p></div>
          <NameField name={project.name} onCommit={(name) => onChange({ ...project, name })} />
          <fieldset className="fp-choice-field"><legend>Grundform</legend>
            <div className="fp-segmented fp-segmented--three">
              {([{ value: 'rectangle', label: 'Rechteck' }, { value: 'l-shape', label: 'L-Form' }, { value: 'custom', label: 'Frei' }] as const).map((item) => <button type="button" key={item.value}
                aria-pressed={room.shape === item.value} className={room.shape === item.value ? 'is-active' : ''}
                onClick={() => { if (room.shape !== item.value) setRoom({ shape: item.value, ...(item.value === 'custom' ? { points: roomPoints(room) } : {}) }); }}
              >{item.label}</button>)}
            </div>
          </fieldset>
          {room.shape !== 'custom' && <div className="fp-field-grid">
            <NumericField label="Breite" value={room.width} onCommit={(width) => setRoom({ width, notchWidth: Math.min(room.notchWidth, width - 1) })} unit="cm" divisor={10} min={100} max={50000} step={10} />
            <NumericField label="Tiefe" value={room.height} onCommit={(height) => setRoom({ height, notchHeight: Math.min(room.notchHeight, height - 1) })} unit="cm" divisor={10} min={100} max={50000} step={10} />
          </div>}
          {room.shape === 'l-shape' && <div className="fp-inset-fields">
            <h3>Aussparung rechts oben</h3>
            <div className="fp-field-grid">
              <NumericField label="Breite" accessibleLabel="Breite der Aussparung" value={room.notchWidth} onCommit={(notchWidth) => setRoom({ notchWidth })} unit="cm" divisor={10} min={1} max={room.width - 1} step={10} />
              <NumericField label="Tiefe" accessibleLabel="Tiefe der Aussparung" value={room.notchHeight} onCommit={(notchHeight) => setRoom({ notchHeight })} unit="cm" divisor={10} min={1} max={room.height - 1} step={10} />
            </div>
          </div>}
          {room.shape === 'custom' && <>
            <button type="button" className="fp-action-button" onClick={onDraw}><PencilSimple size={17} />Kontur zeichnen</button>
            <details className="fp-details" open>
              <summary><span>Eckpunkte</span><span className="fp-count">{room.points.length}</span><CaretDown className="fp-details-chevron" size={14} /></summary>
              <p className="fp-help">Punkte entlang der Wand. X nach rechts, Y nach unten.</p>
              <div className="fp-point-list">
                {room.points.map((point, index) => <div className="fp-point-row" key={index}>
                  <span className="fp-point-number" aria-hidden="true">{index + 1}</span>
                  <NumericField label="X" accessibleLabel={`Punkt ${index + 1}, X`} value={point.x} onCommit={(value) => setPoint(index, 'x', value)} unit="cm" divisor={10} min={-50000} max={50000} />
                  <NumericField label="Y" accessibleLabel={`Punkt ${index + 1}, Y`} value={point.y} onCommit={(value) => setPoint(index, 'y', value)} unit="cm" divisor={10} min={-50000} max={50000} />
                  <button type="button" className="fp-icon-button fp-point-remove" aria-label={`Punkt ${index + 1} entfernen`} title="Punkt entfernen" disabled={room.points.length <= 3}
                    onClick={() => setRoom({ points: room.points.filter((_, i) => i !== index) })}><Trash size={16} /></button>
                </div>)}
              </div>
              <button type="button" className="fp-text-button" disabled={room.points.length >= 32} onClick={() => {
                const last = room.points[room.points.length - 1];
                const first = room.points[0];
                if (!last || !first) return;
                setRoom({ points: [...room.points, { x: (last.x + first.x) / 2, y: (last.y + first.y) / 2 }] });
              }}><Plus size={16} />Punkt hinzufügen</button>
              {room.points.length >= 32 && <p className="fp-help">Maximal 32 Eckpunkte.</p>}
            </details>
          </>}
        </section>
        <section className="fp-control-section fp-obstacle-section">
          <details className="fp-details" open={room.obstacles.length > 0 || undefined}>
            <summary><span>Hindernisse</span>{room.obstacles.length > 0 && <span className="fp-count">{room.obstacles.length}</span>}<CaretDown className="fp-details-chevron" size={14} /></summary>
            <p className="fp-help">Flächen ohne Belag, etwa Säulen. Die Randfuge gilt auch hier.</p>
            {room.obstacles.map((obstacle, index) => <div className="fp-obstacle" key={obstacle.id}>
              <div className="fp-obstacle-header"><h3>Hindernis {index + 1}</h3><button type="button" className="fp-icon-button" aria-label={`Hindernis ${index + 1} entfernen`} title="Hindernis entfernen"
                onClick={() => setRoom({ obstacles: room.obstacles.filter((item) => item.id !== obstacle.id) })}><Trash size={17} /></button></div>
              <div className="fp-field-grid">
                <NumericField label="X" accessibleLabel={`Hindernis ${index + 1}, X`} value={obstacle.x} onCommit={(value) => setObstacle(obstacle.id, 'x', value)} unit="cm" divisor={10} min={-50000} max={50000} step={10} />
                <NumericField label="Y" accessibleLabel={`Hindernis ${index + 1}, Y`} value={obstacle.y} onCommit={(value) => setObstacle(obstacle.id, 'y', value)} unit="cm" divisor={10} min={-50000} max={50000} step={10} />
                <NumericField label="Breite" accessibleLabel={`Hindernis ${index + 1}, Breite`} value={obstacle.width} onCommit={(value) => setObstacle(obstacle.id, 'width', value)} unit="cm" divisor={10} min={1} max={50000} step={10} />
                <NumericField label="Tiefe" accessibleLabel={`Hindernis ${index + 1}, Tiefe`} value={obstacle.height} onCommit={(value) => setObstacle(obstacle.id, 'height', value)} unit="cm" divisor={10} min={1} max={50000} step={10} />
              </div>
            </div>)}
            <button type="button" className="fp-text-button" disabled={room.obstacles.length >= 24} onClick={() => {
              const points = roomPoints(room);
              const minX = Math.min(...points.map((point) => point.x));
              const minY = Math.min(...points.map((point) => point.y));
              const width = Math.max(...points.map((point) => point.x)) - minX;
              const height = Math.max(...points.map((point) => point.y)) - minY;
              setRoom({ obstacles: [...room.obstacles, { id: crypto.randomUUID(), x: Math.round(minX + width / 3), y: Math.round(minY + height / 3), width: Math.min(600, Math.round(width / 4)), height: Math.min(600, Math.round(height / 4)) }] });
            }}><Plus size={16} />Hindernis hinzufügen</button>
            {room.obstacles.length >= 24 && <p className="fp-help">Maximal 24 Hindernisse.</p>}
          </details>
        </section>
        <p className="fp-controls-footnote">Maße in cm. Fugen in mm.</p>
      </>}

      {tab === 'material' && <>
        <section className="fp-control-section" aria-label="Belag und Format">
          <div className="fp-section-heading"><h2>Dein Belag</h2><p>Das tatsächliche Elementmaß zählt.</p></div>
          <fieldset className="fp-choice-field"><legend>Material</legend><div className="fp-segmented">
            <button type="button" aria-pressed={material.kind === 'tile'} className={material.kind === 'tile' ? 'is-active' : ''} onClick={() => { if (material.kind !== 'tile') setMaterial({ kind: 'tile', width: 600, height: 600, grout: 3, color: 'limestone' }); }}>Fliese</button>
            <button type="button" aria-pressed={material.kind === 'wood'} className={material.kind === 'wood' ? 'is-active' : ''} onClick={() => { if (material.kind !== 'wood') setMaterial({ kind: 'wood', width: 1200, height: 200, grout: 0, color: 'oak' }); }}>Diele</button>
          </div></fieldset>
          <div className="fp-field"><label htmlFor={formatId}>Formatvorgabe</label><select id={formatId} value={selectedFormat} onChange={(event) => {
            const next = formats[Number(event.target.value)];
            if (next) setMaterial({ width: next.width, height: next.height });
          }}><option value={-1}>Eigene Maße</option>{formats.map((item, i) => <option value={i} key={item.label}>{item.label}</option>)}</select></div>
          <div className="fp-field-grid">
            <NumericField label="Länge" value={material.width} onCommit={(width) => setMaterial({ width })} unit="cm" divisor={10} min={10} max={5000} />
            <NumericField label="Breite" value={material.height} onCommit={(height) => setMaterial({ height })} unit="cm" divisor={10} min={10} max={5000} />
          </div>
          <p className="fp-help">Werkmaß auf der Verpackung prüfen. Die Fuge nicht zum Elementmaß addieren.</p>
          <div className="fp-field-grid">
            <NumericField label="Fuge" value={material.grout} onCommit={(grout) => setMaterial({ grout })} unit="mm" min={0} max={50} step={0.5} />
            <NumericField label="Randfuge" value={material.edgeGap} onCommit={(edgeGap) => setMaterial({ edgeGap })} unit="mm" min={0} max={100} />
          </div>
          {material.kind === 'wood' && <p className="fp-help">Mindestversatz und Randabstand nach Produktvorgabe prüfen.</p>}
        </section>
        <section className="fp-control-section">
          <fieldset className="fp-choice-field"><legend>Darstellung</legend><div className="fp-swatches">
            {finishes.map((finish) => <button type="button" key={finish.value} className={`fp-swatch${material.color === finish.value ? ' is-active' : ''}`} aria-label={finish.name} aria-pressed={material.color === finish.value}
              onClick={() => setMaterial({ color: finish.value })} title={finish.name}>
              <span className={`fp-swatch-chip fp-swatch-chip--${finish.value}`} style={{ backgroundColor: finish.color }} aria-hidden="true">{material.color === finish.value && <Check size={17} weight="bold" />}</span>
              <span>{finish.name}</span>
            </button>)}
          </div></fieldset>
        </section>
        <section className="fp-control-section" aria-label="Mengen und Zuschnitte">
          <h3 className="fp-section-title">Menge & Zuschnitt</h3>
          <div className="fp-field-grid">
            <NumericField label="Stück je Paket" value={material.piecesPerPack} onCommit={(piecesPerPack) => setMaterial({ piecesPerPack })} min={1} max={1000} integer />
            <NumericField label="Reserve" value={material.reserve} onCommit={(reserve) => setMaterial({ reserve })} unit="%" min={0} max={100} />
          </div>
          <NumericField label="Schmale Zuschnitte markieren unter" value={material.minCut} onCommit={(minCut) => setMaterial({ minCut })} unit="mm" min={0} max={1000} hint="Dein Grenzwert für die Planung." />
        </section>
      </>}

      {tab === 'layout' && <>
        <div className="fp-section-heading fp-layout-heading"><h2>Deine Verlegung</h2><p>Start wählen und Zuschnitte vergleichen.</p></div>
        <StartControls project={project} onChange={onChange} onPick={onPickStart} disabled={startDisabled} />
        <section className="fp-control-section" aria-label="Verlegemuster">
          <h3 className="fp-section-title">Verlegemuster</h3>
          <div className="fp-pattern-grid" role="group" aria-label="Verlegemuster">
            {patterns.map((pattern) => <button type="button" className={`fp-pattern-button${layout.pattern === pattern.value ? ' is-active' : ''}`} key={pattern.value} aria-pressed={layout.pattern === pattern.value}
              onClick={() => setLayout({ pattern: pattern.value })}><PatternPreview pattern={pattern.value} /><span>{pattern.label}</span>{layout.pattern === pattern.value && <Check size={14} weight="bold" className="fp-pattern-check" />}</button>)}
          </div>
          {layout.pattern === 'half' && material.kind === 'tile' && <p className="fp-note">Halbverband: Herstellerfreigabe für das Format prüfen.</p>}
          {layout.pattern === 'herringbone' && <p className="fp-note">Fischgrät braucht ein geeignetes Produkt. Die Vorschau prüft keine Klickverbindung.</p>}
          {layout.pattern === 'random' && <p className="fp-help">Feste, unregelmäßige Versätze. Bei Dielen den zulässigen Mindestversatz prüfen.</p>}
        </section>
        <section className="fp-control-section" aria-label="Drehung und Position">
          <NumericField label={layout.pattern === 'diagonal' || layout.pattern === 'herringbone' ? 'Zusätzliche Drehung' : 'Drehung'} value={layout.angle} onCommit={(angle) => setLayout({ angle })} unit="°" min={-360} max={360} />
          <div className="fp-angle-shortcuts" role="group" aria-label="Drehung einstellen">
            {[0, 45, 90].map((angle) => <button key={angle} type="button" className={layout.angle === angle ? 'is-active' : ''} aria-pressed={layout.angle === angle} onClick={() => setLayout({ angle })}>{angle}°</button>)}
          </div>
          {(layout.pattern === 'diagonal' || layout.pattern === 'herringbone') && <p className="fp-help">Dieses Muster ist bereits um 45° gedreht.</p>}
          <div className="fp-field-grid">
            <NumericField label="Versatz X" value={layout.offsetX} onCommit={(offsetX) => setLayout({ offsetX })} unit="cm" divisor={10} min={-50000} max={50000} />
            <NumericField label="Versatz Y" value={layout.offsetY} onCommit={(offsetY) => setLayout({ offsetY })} unit="cm" divisor={10} min={-50000} max={50000} />
          </div>
          <p className="fp-help">{layout.start ? 'Versatz vom gewählten Start entlang der gedrehten Rasterachsen. Ein neuer Start setzt X und Y auf null.' : 'Versatz entlang der gedrehten Rasterachsen.'}</p>
          <button type="button" className="fp-action-button" onClick={onCenter}><Crosshair size={18} />Belag zentrieren</button>
          {layout.start && <p className="fp-help">Zentrieren hebt die Startauswahl auf.</p>}
        </section>
      </>}
    </div>
  </div>;
}
