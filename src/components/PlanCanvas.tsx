import { useEffect, useId, useRef, useState } from 'react';
import { ArrowsOut, Cursor, Hand, Minus, Plus, ArrowsOutCardinal, X, Check, ArrowCounterClockwise } from '@phosphor-icons/react';
import type { LayoutResult, LayoutStart, Piece, Point, Project } from '../types';
import { multiPolygonPath, validateRoom } from '../lib/geometry';
import { formatNumber, MATERIAL_COLORS } from '../lib/project';
import { StartTargets, startTargets } from './StartPicker';

type Props = {
  project:Project; result:LayoutResult; showCuts:boolean; showDimensions:boolean; showGuides:boolean;
  selected:string|null; onSelect:(id:string|null)=>void; drawing:boolean; onCancelDraw:()=>void;
  onDrawRoom:(points:Point[])=>void; onOffset:(x:number,y:number)=>void;
  pickingStart:LayoutStart['kind']|null; onPickStart:(start:LayoutStart)=>void;
};
const pointPath=(points:Point[])=>points.map(p=>`${p.x},${p.y}`).join(' ');

export function FloorDrawing({project,result,showCuts=false,selected=null,onSelect,showStart=true,markerSize=Math.max(result.bounds.width,result.bounds.height)/55}: {
  project:Project;result:LayoutResult;showCuts?:boolean;selected?:string|null;onSelect?:(id:string)=>void;markerSize?:number;showStart?:boolean;
}) {
  const id=useId().replace(/:/g,'');
  const palette=MATERIAL_COLORS[project.material.color];
  const startPiece = result.start ? result.pieces.find(piece => piece.id === result.start!.pieceId) : undefined;
  const labelOnLeft = !!result.start && result.start.point.x > (result.bounds.minX+result.bounds.maxX)/2;
  return <>
    <defs>
      <pattern id={`cut-${id}`} width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="22" height="22" fill="#eddbb9"/><line x1="0" y1="0" x2="0" y2="22" stroke="#b48a48" strokeWidth="2"/></pattern>
      <clipPath id={`room-${id}`}><polygon points={pointPath(result.roomPolygon)}/></clipPath>
    </defs>
    <polygon points={pointPath(result.roomPolygon)} fill="#d9ddd6" />
    <path d={multiPolygonPath(result.usablePolygons)} fill="#f7f7f3" fillRule="evenodd" />
    <g className="floor-pieces">
      {result.pieces.map((piece,i)=><path key={piece.id} data-piece={piece.id} d={multiPolygonPath(piece.polygons)} fillRule="evenodd"
        fill={showCuts&&piece.cut?`url(#cut-${id})`:palette[i%palette.length]}
        className={onSelect?'floor-piece':undefined}
        stroke={selected===piece.id?'#245d4a':'#989e93'} strokeWidth={selected===piece.id?2.5:.5} vectorEffect="non-scaling-stroke"
        onClick={onSelect?(event)=>{event.stopPropagation();onSelect(piece.id);}:undefined}>
        <title>{`${piece.id===result.start?.pieceId?'Startfliese · ':''}${piece.cut?'Zuschnitt':'Ganzes Element'} ${i+1}: ${formatNumber(piece.width,2)} × ${formatNumber(piece.height,2)} mm`}</title>
      </path>)}
    </g>
    <g clipPath={`url(#room-${id})`}>{project.room.obstacles.map((o,i)=><g key={o.id} pointerEvents="none"><rect x={o.x} y={o.y} width={o.width} height={o.height} fill="#f2f3f1" stroke="#57665e" strokeWidth="1" vectorEffect="non-scaling-stroke"/><path d={`M${o.x},${o.y}l${o.width},${o.height} M${o.x+o.width},${o.y}l${-o.width},${o.height}`} stroke="#aab3ad" strokeWidth="1" vectorEffect="non-scaling-stroke"/><title>Hindernis {i+1}</title></g>)}</g>
    <polygon points={pointPath(result.roomPolygon)} fill="none" stroke="#3d5146" strokeWidth="2" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
    {showStart && result.start && startPiece && <g pointerEvents="none" data-testid="start-marker" aria-label={`Startfliese 1: ${result.start.label}`}>
      <path d={multiPolygonPath(startPiece.polygons)} fill="none" stroke="#245d4a" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      <circle cx={result.start.point.x} cy={result.start.point.y} r={markerSize} fill="#245d4a" stroke="white" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <text x={result.start.point.x} y={result.start.point.y} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={markerSize*1.35} fontWeight="700">1</text>
      <text x={result.start.point.x+markerSize*1.45*(labelOnLeft?-1:1)} y={result.start.point.y} textAnchor={labelOnLeft?'end':'start'} dominantBaseline="central" fontSize={markerSize*1.15} fontWeight="650" fill="#245d4a" stroke="#fff" strokeWidth={markerSize*.25} paintOrder="stroke">Start</text>
    </g>}
  </>;
}

export default function PlanCanvas(props:Props) {
  const {project,result,showDimensions,showGuides,selected,onSelect,drawing,pickingStart}=props;
  const container=useRef<HTMLDivElement>(null), svg=useRef<SVGSVGElement>(null);
  const [size,setSize]=useState({width:900,height:650});
  const [zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0});
  const [tool,setTool]=useState<'select'|'pan'|'layout'>('select');
  const [draft,setDraft]=useState<Point[]>([]),[cursor,setCursor]=useState<Point|null>(null),[drawError,setDrawError]=useState('');
  const drag=useRef<{x:number;y:number;pan:Point;offset:Point;moved:boolean}|null>(null);
  const [liveOffset,setLiveOffset]=useState<Point|null>(null);
  const suppressPick=useRef(false);
  const b=result.bounds, aspect=size.width/size.height;
  const fitScale=Math.min(Math.max(100,size.width-110)/Math.max(b.width,100),Math.max(100,size.height-164)/Math.max(b.height,100));
  const fittedWidth=size.width/fitScale;
  const width=fittedWidth/zoom, height=width/aspect;
  const view={x:(b.minX+b.maxX-width)/2+pan.x,y:(b.minY+b.maxY-height)/2+pan.y+14*width/size.width,width,height};
  const unit=width/size.width, font=12*unit;
  const winding=Math.sign(result.roomPolygon.reduce((sum,p,i)=>{const next=result.roomPolygon[(i+1)%result.roomPolygon.length];return sum+p.x*next.y-next.x*p.y;},0))||1;
  const totalAngle=(project.layout.angle+(['diagonal','herringbone'].includes(project.layout.pattern)?45:0))*Math.PI/180;
  useEffect(()=>{
    const el=container.current;if(!el)return;
    const resize=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width||900,height:entry.contentRect.height||650}));
    resize.observe(el);return()=>resize.disconnect();
  },[]);
  useEffect(()=>{setPan({x:0,y:0});setZoom(1);},[b.minX,b.minY,b.width,b.height]);
  useEffect(()=>{
    if(pickingStart){setTool('select');setLiveOffset(null);drag.current=null;}
  },[pickingStart]);
  useEffect(()=>{
    if(!drawing)return;
    setDraft([]);setDrawError('');setCursor(null);
    const frame=requestAnimationFrame(()=>{
      container.current?.scrollIntoView({block:'center',behavior:'instant'});
      svg.current?.focus({preventScroll:true});
    });
    return()=>cancelAnimationFrame(frame);
  },[drawing]);
  const coordinate=(clientX:number,clientY:number)=>{
    const rect=svg.current!.getBoundingClientRect();
    return{x:view.x+(clientX-rect.left)/rect.width*width,y:view.y+(clientY-rect.top)/rect.height*height};
  };
  const targetAt=(x:number,y:number)=>{
    if(!pickingStart)return null;
    const p=coordinate(x,y);
    // Choose the nearest visible target when 44-pixel hit areas overlap.
    const candidates=startTargets(result.roomPolygon,pickingStart).map((point,index)=>({point,index}))
      .filter(({point})=>Math.abs(point.x-p.x)<=22*unit&&Math.abs(point.y-p.y)<=22*unit)
      .sort((a,b)=>Math.hypot(a.point.x-p.x,a.point.y-p.y)-Math.hypot(b.point.x-p.x,b.point.y-p.y));
    return candidates[0]?.index??null;
  };
  const pickAt=(x:number,y:number)=>{
    if(!pickingStart||suppressPick.current)return;
    const index=targetAt(x,y);
    if(index!==null)props.onPickStart({kind:pickingStart,index});
  };
  const finishDraw=()=>{
    const points=draft.map(p=>({x:Math.round(p.x),y:Math.round(p.y)}));
    if(points.some(p=>Math.abs(p.x)>50000||Math.abs(p.y)>50000)){setDrawError('Eckpunkte dürfen höchstens 5.000 cm vom Ursprung entfernt sein.');return;}
    const errors=validateRoom({...project.room,shape:'custom',points,obstacles:[]});
    if(errors.length){setDrawError(errors[0]);return;}
    props.onDrawRoom(points);setDraft([]);
  };
  const scalePower=10**Math.floor(Math.log10(80*unit));
  const scaleFactor=80*unit/scalePower;
  const scaleLength=(scaleFactor>=5?5:scaleFactor>=2?2:1)*scalePower;
  const selectedPiece=result.pieces.find(p=>p.id===selected);
  return <div className={`plan-canvas ${drawing?'is-drawing':pickingStart?'is-picking-start':`tool-${tool}`}`} ref={container}>
    <svg ref={svg} className="plan-svg" data-testid="floor-plan" viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
      aria-label={`Verlegeplan ${project.name}, ${result.pieces.length} Elemente`} role="group" tabIndex={0} aria-describedby="canvas-keyboard-help"
      onKeyDown={event=>{
        if(drawing)return;
        if(pickingStart){
          if(['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(event.key)){
            event.preventDefault();setPan(p=>({x:p.x+(event.key==='ArrowRight'?50:event.key==='ArrowLeft'?-50:0)*unit,y:p.y+(event.key==='ArrowDown'?50:event.key==='ArrowUp'?-50:0)*unit}));
          }
          if(event.key==='+'||event.key==='-'){event.preventDefault();setZoom(z=>Math.max(.5,Math.min(4,event.key==='+'?z*1.25:z/1.25)));}
          return;
        }
        if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Enter','Home','End'].includes(event.key)){
          event.preventDefault();
          const current=result.pieces.findIndex(p=>p.id===selected);
          const direction=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;
          const index=event.key==='Home'?0:event.key==='End'?result.pieces.length-1:current<0?0:((current+direction)%result.pieces.length+result.pieces.length)%result.pieces.length;
          onSelect(result.pieces[index].id);
        }
        if(event.key==='Escape'){event.preventDefault();onSelect(null);}
      }}
      onPointerDown={event=>{
        if(drawing||(!pickingStart&&tool==='select')||event.button!==0)return;
        suppressPick.current=false;
        if(!pickingStart)svg.current?.setPointerCapture(event.pointerId);
        drag.current={x:event.clientX,y:event.clientY,pan,offset:{x:project.layout.offsetX,y:project.layout.offsetY},moved:false};
      }}
      onPointerMove={event=>{
        if(drawing){const p=coordinate(event.clientX,event.clientY);setCursor({x:Math.round(p.x/10)*10,y:Math.round(p.y/10)*10});return;}
        if(!drag.current)return;
        const dx=(event.clientX-drag.current.x)*unit,dy=(event.clientY-drag.current.y)*unit;
        if(Math.hypot(dx,dy)>3*unit)drag.current.moved=true;
        if(pickingStart&&drag.current.moved)svg.current?.setPointerCapture(event.pointerId);
        if((pickingStart&&drag.current.moved)||tool==='pan')setPan({x:drag.current.pan.x-dx,y:drag.current.pan.y-dy});
        if(!pickingStart&&tool==='layout'){
          const bounded=(value:number)=>Math.max(-50000,Math.min(50000,Math.round(value)));
          setLiveOffset({x:bounded(drag.current.offset.x+dx*Math.cos(totalAngle)+dy*Math.sin(totalAngle)),y:bounded(drag.current.offset.y-dx*Math.sin(totalAngle)+dy*Math.cos(totalAngle))});
        }
      }}
      onPointerUp={event=>{
        suppressPick.current=drag.current?.moved??false;
        if(!pickingStart&&drag.current&&liveOffset&&tool==='layout')props.onOffset(liveOffset.x,liveOffset.y);
        if(svg.current?.hasPointerCapture(event.pointerId))svg.current.releasePointerCapture(event.pointerId);
        drag.current=null;setLiveOffset(null);
      }}
      onPointerCancel={()=>{suppressPick.current=true;drag.current=null;setLiveOffset(null);}}
      onClick={event=>{
        if(pickingStart){pickAt(event.clientX,event.clientY);return;}
        if(drawing){
          const p=coordinate(event.clientX,event.clientY);const point={x:Math.round(p.x/10)*10,y:Math.round(p.y/10)*10};
          if(draft.length>=3&&Math.hypot(point.x-draft[0].x,point.y-draft[0].y)<14*unit){finishDraw();return;}
          if(draft.length>=32){setDrawError('Höchstens 32 Ecken sind möglich.');return;}
          setDraft([...draft,point]);setDrawError('');
        }else if(tool==='select')onSelect(null);
      }}>
      <defs><pattern id="workspace-grid" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="#e3e7e0" strokeWidth=".5" vectorEffect="non-scaling-stroke"/></pattern></defs>
      <rect x={view.x} y={view.y} width={width} height={height} fill="url(#workspace-grid)"/>
      <g opacity={drawing ? .25 : pickingStart ? .4 : 1} pointerEvents={pickingStart?'none':undefined}>
        <FloorDrawing {...props} showStart={!pickingStart} selected={pickingStart?null:selected} markerSize={10*unit} onSelect={!drawing&&!pickingStart&&tool==='select'?onSelect:undefined}/>
        {showGuides&&!pickingStart&&<g stroke="#6c8b7c" strokeWidth="1" strokeDasharray="7 6" opacity=".7">
          <line x1={b.minX-100} y1={(b.minY+b.maxY)/2} x2={b.maxX+100} y2={(b.minY+b.maxY)/2} vectorEffect="non-scaling-stroke"/>
          <line y1={b.minY-100} x1={(b.minX+b.maxX)/2} y2={b.maxY+100} x2={(b.minX+b.maxX)/2} vectorEffect="non-scaling-stroke"/>
        </g>}
        {showDimensions&&!pickingStart&&<g className="dimensions" stroke="#7d8980" fill="#526258" strokeWidth="1" fontSize={font} vectorEffect="non-scaling-stroke">
          {result.roomPolygon.map((a,i)=>{
            const end=result.roomPolygon[(i+1)%result.roomPolygon.length],dx=end.x-a.x,dy=end.y-a.y,len=Math.hypot(dx,dy);
            const offset=28*unit,nx=winding*dy/len*offset,ny=-winding*dx/len*offset;
            const ax=a.x+nx,ay=a.y+ny,bx=end.x+nx,by=end.y+ny,mx=(ax+bx)/2,my=(ay+by)/2;
            const angle=Math.atan2(dy,dx)*180/Math.PI; const rotation=angle>90?angle-180:angle<-90?angle+180:angle;
            return <g key={i}>
              <path d={`M${a.x+nx*.45},${a.y+ny*.45}L${a.x+nx*1.18},${a.y+ny*1.18} M${end.x+nx*.45},${end.y+ny*.45}L${end.x+nx*1.18},${end.y+ny*1.18} M${ax},${ay}L${bx},${by}`} fill="none" vectorEffect="non-scaling-stroke"/>
              <text x={mx} y={my} textAnchor="middle" dominantBaseline="central" transform={`rotate(${rotation} ${mx} ${my})`} stroke="#f2f3f1" strokeWidth={7*unit} paintOrder="stroke" strokeLinejoin="round">{formatNumber(len/10,1)} cm</text>
            </g>;
          })}
        </g>}
      </g>
      {pickingStart&&<StartTargets points={result.roomPolygon} room={project.room} kind={pickingStart} current={project.layout.start} unit={unit} onPick={props.onPickStart} onPointerPick={pickAt} targetAt={targetAt}/>}
      {drawing&&<g>
        <polyline points={pointPath(cursor?[...draft,cursor]:draft)} fill="none" stroke="#245d4a" strokeWidth="2" strokeDasharray="6 4" vectorEffect="non-scaling-stroke"/>
        {draft.length>2&&<polygon points={pointPath(draft)} fill="#245d4a" fillOpacity=".07"/>}
        {draft.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r={5*unit} fill={i===0?'#245d4a':'white'} stroke="#245d4a" strokeWidth="2" vectorEffect="non-scaling-stroke"/><text x={p.x+10*unit} y={p.y-10*unit} fontSize={font} fill="#245d4a">{i+1}</text></g>)}
      </g>}
    </svg>
    <span id="canvas-keyboard-help" className="visually-hidden">{pickingStart?'Tab wählt die Startpunkte an. Enter oder Leertaste übernimmt den Start. Escape bricht ab. Pfeiltasten verschieben die Ansicht. Plus und Minus ändern den Zoom.':'Mit den Pfeiltasten ein Element wählen. Pos1 wählt das erste, Ende das letzte Element. Escape schließt die Details. Eine freie Kontur kann auch über die Eckpunktfelder eingegeben werden.'}</span>
    {drawing?<div className="draw-toolbar">
      <div><strong>Raumkontur zeichnen</strong><span>Ecken anklicken. Raster: 1 cm. Maße danach links bearbeiten.</span>{drawError&&<span className="text-error" role="alert">{drawError}</span>}</div>
      <div className="draw-actions"><button className="icon-button" aria-label="Letzten Punkt entfernen" disabled={!draft.length} onClick={()=>setDraft(draft.slice(0,-1))}><ArrowCounterClockwise size={18}/></button><button className="button primary" disabled={draft.length<3} onClick={finishDraw}><Check size={16}/>Übernehmen</button><button className="icon-button" aria-label="Zeichnen abbrechen" onClick={props.onCancelDraw}><X size={18}/></button></div>
    </div>:<>
      {!pickingStart&&<div className="canvas-hint">{tool==='layout'?'Ziehen, um den Verband zu verschieben. Beim Loslassen wird neu berechnet.':tool==='pan'?'Ziehen, um die Ansicht zu verschieben.':'Ein Element anklicken, um den Zuschnitt zu prüfen.'}</div>}
      {liveOffset&&<div className="offset-preview">X {formatNumber(liveOffset.x/10)} cm · Y {formatNumber(liveOffset.y/10)} cm</div>}
      {selectedPiece&&!pickingStart&&<PieceDetail piece={selectedPiece} isStart={selectedPiece.id===result.start?.pieceId} onClose={()=>onSelect(null)}/>}
      <div className="canvas-bottom">
        <div className="scale-bar"><span style={{width:scaleLength/unit}}/><small>{formatNumber(scaleLength/10)} cm</small></div>
        <div className="canvas-tools" role="group" aria-label="Zeichenwerkzeuge">
          {!pickingStart&&<><button className={`icon-button ${tool==='select'?'active':''}`} aria-label="Element auswählen" aria-pressed={tool==='select'} onClick={()=>setTool('select')}><Cursor size={18}/></button>
          <button className={`icon-button ${tool==='pan'?'active':''}`} aria-label="Ansicht verschieben" aria-pressed={tool==='pan'} onClick={()=>setTool('pan')}><Hand size={18}/></button>
          <button className={`icon-button ${tool==='layout'?'active':''}`} aria-label="Verband verschieben" aria-pressed={tool==='layout'} onClick={()=>setTool('layout')}><ArrowsOutCardinal size={18}/></button>
          <span className="tool-divider"/></>}
          <button className="icon-button" aria-label="Verkleinern" disabled={zoom<=.5} onClick={()=>setZoom(z=>Math.max(.5,z/1.25))}><Minus size={16}/></button>
          <span className="zoom-value">{Math.round(zoom*100)} %</span>
          <button className="icon-button" aria-label="Vergrößern" disabled={zoom>=4} onClick={()=>setZoom(z=>Math.min(4,z*1.25))}><Plus size={16}/></button>
          <button className="icon-button" aria-label="Plan einpassen" onClick={()=>{setZoom(1);setPan({x:0,y:0});}}><ArrowsOut size={18}/></button>
        </div>
        <span className="canvas-unit">Maße in cm</span>
      </div>
    </>}
  </div>;
}

function PieceDetail({piece,isStart,onClose}:{piece:Piece;isStart:boolean;onClose:()=>void}) {
  const points=piece.polygons.flat(2), xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const minX=Math.min(...xs),minY=Math.min(...ys),w=Math.max(...xs)-minX,h=Math.max(...ys)-minY;
  const pad=Math.max(w,h)*.08;
  return <section className="piece-detail" aria-label="Elementdetails">
    <div className="piece-heading"><strong>{isStart?'Startfliese 1':piece.cut?'Zuschnitt':'Ganzes Element'}</strong><button className="icon-button" aria-label="Elementdetails schließen" onClick={onClose}><X size={16}/></button></div>
    {isStart&&<p>{piece.cut?'Zuschnitt am Start':'Ganzes Element am Start'}</p>}
    <svg viewBox={`${minX-pad} ${minY-pad} ${w+pad*2} ${h+pad*2}`} role="img" aria-label="Schnittkontur"><path d={multiPolygonPath(piece.polygons)} fill="#d7e3d9" stroke="#245d4a" strokeWidth="1.5" vectorEffect="non-scaling-stroke" fillRule="evenodd"/></svg>
    <strong className="piece-size">{formatNumber(piece.width,2)} × {formatNumber(piece.height,2)} <small>mm</small></strong>
    <p>Hüllmaß in den Elementachsen.{piece.cut?' Die Kontur zeigt den Schnitt.':''}</p>
    <details><summary>Kantenmaße ansehen</summary><ol>{piece.polygons.flatMap((polygon,pi)=>polygon.flatMap((ring,ri)=>ring.map((p,i)=>{const next=ring[(i+1)%ring.length];const length=Math.hypot(next.x-p.x,next.y-p.y);return length>.01?<li key={`${pi}-${ri}-${i}`}>Kante {i+1}: {formatNumber(length,2)} mm</li>:null;})))}</ol></details>
  </section>;
}
