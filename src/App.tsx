import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowCounterClockwise, ArrowClockwise, ArrowDown, CheckCircle, DownloadSimple, FloppyDisk, FolderOpen, Info, Plus, Printer, SquaresFour, Stack, Trash, X, WarningCircle, Ruler, Scissors, Crosshair, FileArrowDown } from '@phosphor-icons/react';
import type { LayoutStart, Project, SavedVariant } from './types';
import type { Workspace } from './floorplan-types';
import Controls from './components/Controls';
import FloorPlanEditor from './components/FloorPlanEditor';
import PlanCanvas, { FloorDrawing } from './components/PlanCanvas';
import { StartPicker } from './components/StartPicker';
import Dialog from './components/Dialog';
import { calculateLayout, getCenteredLayout } from './lib/geometry';
import { createCutCsv, createPlanSvg, svgDimensions } from './lib/export';
import { downloadFile, filename, formatArea, formatNumber, loadVariants, PATTERN_NAMES, STORAGE_KEY, VARIANTS_KEY } from './lib/project';
import { usePlan } from './lib/usePlan';
import { startLabel } from './lib/layout-start';
import { addEmptyRoom, addPdfRoom, calibratePage, createWorkspace, currentRoom, loadWorkspace, MAX_ROOMS, removeRoom, replaceRoomProject, withPdf, WORKSPACE_KEY } from './lib/workspace';
import { MAX_PDF_BYTES, preparePdf } from './lib/pdf';
import { getPdf, putPdf } from './lib/pdf-storage';
import { MAX_PROJECT_BYTES, readProjectFile, writeProjectFile } from './lib/workspace-file';

export default function App() {
  const [loaded]=useState(loadWorkspace);
  const [history,setHistory]=useState({past:[] as Workspace[],present:loaded.workspace,future:[] as Workspace[]});
  const workspace=history.present;
  const workspaceRef=useRef(workspace); workspaceRef.current=workspace;
  const activeRoom=currentRoom(workspace), project=activeRoom.project;
  const [saveState,setSaveState]=useState<'saved'|'saving'|'error'>(loaded.error?'error':'saved');
  const edited=useRef(!loaded.error);
  const [notice,setNotice]=useState<string|null>(loaded.error??loaded.warning??null);
  const [variants,setVariants]=useState(loadVariants);
  const [mode,setMode]=useState<'plan'|'floorplan'|'variants'>('plan');
  const [modal,setModal]=useState<'export'|'variant'|'help'|'reset'|null>(null);
  const [variantName,setVariantName]=useState('');
  const [showCuts,setShowCuts]=useState(false),[showDimensions,setShowDimensions]=useState(true),[showGuides,setShowGuides]=useState(false);
  const [drawing,setDrawing]=useState(false),[selected,setSelected]=useState<string|null>(null);
  const [pickingStart,setPickingStart]=useState<LayoutStart['kind']|null>(null);
  const startTrigger=useRef<HTMLElement|null>(null);
  const startButton=useRef<HTMLButtonElement>(null);
  const returnStartFocus=useRef(false);
  const [printScale,setPrintScale]=useState(25);
  const [pendingImports,setPendingImports]=useState(0);
  const pdfBusy=pendingImports>0;
  const [exportError,setExportError]=useState('');
  const [pdfAsset,setPdfAsset]=useState<{id:string;bytes:Uint8Array}|null>(null);
  const assetRef=useRef(pdfAsset); assetRef.current=pdfAsset;
  const [pdfStorageError,setPdfStorageError]=useState(false);
  const [editorEpoch,setEditorEpoch]=useState(0);
  const importSequence=useRef(0);
  const pdfBytes=pdfAsset?.id===workspace.floorPlan?.id?pdfAsset?.bytes??null:null;
  const input=useRef<HTMLInputElement>(null);
  const {result,calculatedProject,error,pending}=usePlan(project);
  const displayProject=calculatedProject??project;
  const commit=(next:Workspace,force=false)=>{
    if(!force&&JSON.stringify(next)===JSON.stringify(workspaceRef.current))return;
    edited.current=true;setSelected(null);setPickingStart(null);
    setHistory(h=>({past:[...h.past,h.present].slice(-60),present:next,future:[]}));
  };
  const change=(next:Project,force=false)=>commit(replaceRoomProject(workspaceRef.current,next),force);
  const navigate=(next:Workspace)=>{edited.current=true;setHistory(h=>({...h,present:next}));setDrawing(false);setSelected(null);setPickingStart(null);};
  const openRoom=(id:string)=>{navigate({...workspaceRef.current,activeRoomId:id});setMode('plan');};
  const deleteRoom=(id:string)=>{commit(removeRoom(workspaceRef.current,id));setDrawing(false);setNotice('Raum entfernt. Du kannst diesen Schritt rückgängig machen.');};
  const undo=()=>{importSequence.current++;edited.current=true;setDrawing(false);setPickingStart(null);setEditorEpoch(n=>n+1);setHistory(h=>h.past.length?{past:h.past.slice(0,-1),present:h.past[h.past.length-1],future:[h.present,...h.future]}:h);setSelected(null);};
  const redo=()=>{importSequence.current++;edited.current=true;setDrawing(false);setPickingStart(null);setEditorEpoch(n=>n+1);setHistory(h=>h.future.length?{past:[...h.past,h.present],present:h.future[0],future:h.future.slice(1)}:h);setSelected(null);};
  const beginStart=()=>{
    if(pending||error||!result)return;
    startTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    setMode('plan');setDrawing(false);setSelected(null);setPickingStart(project.layout.start?.kind??'corner');
  };
  const cancelStart=()=>{returnStartFocus.current=true;setPickingStart(null);};
  const chooseStart=(start:LayoutStart)=>{
    if(pending||error||!result||start.index<0||start.index>=result.roomPolygon.length)return;
    returnStartFocus.current=true;setPickingStart(null);
    change({...project,layout:{...project.layout,start,offsetX:0,offsetY:0}});
    setNotice(`Start: ${startLabel(project.room,start)}. Mit „Rückgängig“ kannst du die Auswahl zurücknehmen.`);
  };
  useEffect(()=>{
    if(mode!=='plan'||drawing||modal||pending)setPickingStart(null);
  },[mode,drawing,modal,pending]);
  useEffect(()=>{
    if(pickingStart||pending||!returnStartFocus.current)return;
    returnStartFocus.current=false;
    const target=startTrigger.current?.isConnected?startTrigger.current:startButton.current;
    target?.focus({preventScroll:true});
  },[pickingStart,pending]);
  useEffect(()=>{
    if(!pickingStart)return;
    const onEscape=(event:KeyboardEvent)=>{
      if(event.key!=='Escape'||event.defaultPrevented)return;
      const target=event.target;
      if(target instanceof Element&&target.closest('input, textarea, select, dialog'))return;
      if(target instanceof HTMLElement&&target.isContentEditable)return;
      event.preventDefault();cancelStart();
    };
    // Let fields discard their drafts before handling Escape for the start picker.
    window.addEventListener('keydown',onEscape);
    return()=>window.removeEventListener('keydown',onEscape);
  },[pickingStart]);
  useEffect(()=>{
    if(!edited.current)return;
    setSaveState('saving');
    const timer=setTimeout(()=>{try {localStorage.setItem(WORKSPACE_KEY,JSON.stringify(workspace));localStorage.setItem(STORAGE_KEY,JSON.stringify(project));setSaveState('saved');}catch{setSaveState('error');setNotice('Der Browser kann das Projekt nicht speichern. Sichere es über „Projektdatei“.');}},220);
    return()=>clearTimeout(timer);
  },[workspace,project]);
  useEffect(()=>{
    const id=workspace.floorPlan?.id;
    if(!id){setPdfStorageError(false);return;}
    if(assetRef.current?.id===id){setPdfStorageError(false);return;}
    let cancelled=false;
    setPdfStorageError(false);
    void getPdf(id).then(async bytes=>{
      if(cancelled)return;
      if(bytes){
        const digest=await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer);
        const actual=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
        if(cancelled)return;
        if(actual!==id)throw new Error('Die gespeicherte PDF wurde verändert.');
        setPdfAsset({id,bytes});setPdfStorageError(false);
      }
      else{setPdfStorageError(true);setNotice('Die gespeicherte PDF fehlt. Öffne unter „Grundriss“ dieselbe Datei erneut. Deine Räume sind erhalten.');}
    }).catch(()=>{if(!cancelled){setPdfStorageError(true);setNotice('Der Browser kann die PDF nicht laden. Öffne die Datei unter „Grundriss“ erneut.');}});
    return()=>{cancelled=true;};
  },[workspace.floorPlan?.id,pdfAsset?.id]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement;
      if(target.closest('input, textarea, select, dialog')||target.isContentEditable)return;
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();}
      if(event.key==='Escape'){setDrawing(false);setSelected(null);}
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(null),8000);return()=>clearTimeout(timer);},[notice]);
  const storeVariants=(next:SavedVariant[])=>{
    try {localStorage.setItem(VARIANTS_KEY,JSON.stringify(next));setVariants(next);return true;}
    catch {setNotice('Die Variante konnte nicht gespeichert werden. Sichere den Plan als Projektdatei.');return false;}
  };
  const importPdf=async(file:File)=>{
    const sequence=++importSequence.current;
    setPendingImports(n=>n+1);
    try{
      if(file.size>MAX_PDF_BYTES)throw new Error('Die PDF darf höchstens 20 MB groß sein.');
      const bytes=new Uint8Array(await file.arrayBuffer());
      const document=await preparePdf(bytes,file.name);
      if(sequence!==importSequence.current)return;
      await putPdf(document.id,bytes);
      if(sequence!==importSequence.current)return;
      const restored=workspaceRef.current.floorPlan?.id===document.id;
      setPdfAsset({id:document.id,bytes});setPdfStorageError(false);
      commit(withPdf(workspaceRef.current,document),true);setDrawing(false);setMode('floorplan');setEditorEpoch(n=>n+1);
      setNotice(restored?'PDF wiederhergestellt. Maßstab und Räume sind erhalten.':'PDF geladen. Wähle die Seite und lege den Maßstab fest.');
    }finally{setPendingImports(n=>n-1);}
  };
  const loadFile=async(file:File|undefined)=>{
    if(!file)return;
    if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
      try{await importPdf(file);}catch(e){setNotice(e instanceof Error?e.message:'Die PDF konnte nicht geladen werden.');}
      if(input.current)input.current.value='';return;
    }
    const sequence=++importSequence.current;setPendingImports(n=>n+1);
    try {
      if(file.size>MAX_PROJECT_BYTES)throw new Error('Die Projektdatei darf höchstens 40 MB groß sein.');
      const contents=await file.text();
      let parsed:unknown;
      try{parsed=JSON.parse(contents);}catch{throw new Error('Die Datei ist keine gültige Projektdatei.');}
      const next=await readProjectFile(parsed);calculateLayout(currentRoom(next.workspace).project);
      if(sequence!==importSequence.current)return;
      if(next.workspace.floorPlan&&next.pdfBytes){await putPdf(next.workspace.floorPlan.id,next.pdfBytes);if(sequence!==importSequence.current)return;setPdfAsset({id:next.workspace.floorPlan.id,bytes:next.pdfBytes});}
      setPdfStorageError(false);commit(next.workspace,true);setDrawing(false);setEditorEpoch(n=>n+1);setMode('plan');setNotice('Projekt geladen.');
    }catch(e){setNotice(e instanceof Error?e.message:'Die Datei konnte nicht geladen werden.');}
    finally{setPendingImports(n=>n-1);if(input.current)input.current.value='';}
  };
  const exportProject=()=>{try{downloadFile(writeProjectFile(workspace,pdfBytes),`${filename(project.name)}.fugenplan.json`,'application/json');setExportError('');}catch(e){setExportError(e instanceof Error?e.message:'Das Projekt konnte nicht exportiert werden.');}};
  const canExport=!!result&&!pending&&!error;
  const printSvg=useMemo(()=>result?createPlanSvg(displayProject,result,printScale):'',[result,displayProject,printScale]);
  const printSize=result?svgDimensions(result,printScale):{width:0,height:0};
  const printFits=printSize.width<=186&&printSize.height<=190;
  const narrow=result?.pieces.filter(p=>p.cut&&p.minDimension<displayProject.material.minCut).length??0;
  return <>
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#" onClick={event=>{event.preventDefault();setMode('plan');}} aria-label="Fugenplan, zum Plan"><SquaresFour size={28} weight="fill"/><span>fugenplan<span className="brand-dot">.</span></span></a>
        <span className="brand-description">Dein Boden im Plan</span>
        <div className="header-actions">
          <span className={`save-status ${saveState==='error'||pdfStorageError?'text-error':''}`} aria-live="polite"><CheckCircle size={15}/><span>{pdfBusy?'Datei wird geladen …':pdfStorageError?'PDF fehlt':saveState==='saved'?'Lokal gespeichert':saveState==='saving'?'Speichert …':'Nicht gespeichert'}</span></span>
          <div className="history-actions"><button className="icon-button" onClick={undo} disabled={!history.past.length} title="Rückgängig (⌘/Strg Z)" aria-label="Rückgängig"><ArrowCounterClockwise size={18}/></button><button className="icon-button" onClick={redo} disabled={!history.future.length} title="Wiederholen (⌘/Strg ⇧ Z)" aria-label="Wiederholen"><ArrowClockwise size={18}/></button></div>
          <button className="button open-button" aria-label="Öffnen" disabled={pdfBusy} onClick={()=>input.current?.click()}><FolderOpen size={18}/><span>Öffnen</span></button>
          <button className="button primary export-button" aria-label="Exportieren" disabled={!canExport||pdfBusy} onClick={()=>{setExportError('');setModal('export');}}><DownloadSimple size={17}/><span>Exportieren</span></button>
          <button className="icon-button help-button" aria-label="Hilfe öffnen" onClick={()=>setModal('help')}><Info size={21}/></button>
          <input ref={input} className="visually-hidden" type="file" accept=".json,.pdf,application/json,application/pdf" aria-label="Projektdatei öffnen" onChange={event=>void loadFile(event.target.files?.[0])}/>
        </div>
      </header>
      <div className={`workspace ${mode==='floorplan'?'workspace-floorplan':''}`}>
        {mode!=='floorplan'&&<aside className="sidebar" aria-label="Planeinstellungen">
          <div className="room-switcher">
            <label htmlFor="active-room">Räume <span>{workspace.rooms.length}</span></label>
            <div className="room-switcher-row"><select id="active-room" aria-label="Aktiver Raum" value={activeRoom.id} onChange={e=>openRoom(e.target.value)}>{workspace.rooms.map(room=><option key={room.id} value={room.id}>{room.project.name}{room.source?` · Seite ${room.source.page}`:''}</option>)}</select><button className="icon-button" aria-label="Neuen Raum hinzufügen" title="Neuen Raum hinzufügen" disabled={workspace.rooms.length>=MAX_ROOMS} onClick={()=>{commit(addEmptyRoom(workspace));setDrawing(false);setMode('plan');}}><Plus size={18}/></button><button className="icon-button" aria-label="Aktuellen Raum entfernen" title="Aktuellen Raum entfernen" disabled={workspace.rooms.length===1} onClick={()=>deleteRoom(activeRoom.id)}><Trash size={17}/></button></div>
            <button className="room-pdf-link" onClick={()=>{setDrawing(false);setMode('floorplan');}}><FolderOpen size={15}/>{workspace.floorPlan?'Räume im Grundriss bearbeiten':'Räume aus PDF übernehmen'}</button>
          </div>
          <Controls project={project} onChange={change} onPickStart={beginStart} startDisabled={pending||!!error||!result} onCenter={()=>{try{change({...project,layout:getCenteredLayout(project)});setNotice('Verband auf die Raummitte ausgerichtet.');}catch(e){setNotice(e instanceof Error?e.message:'Zentrierung nicht möglich.');}}} onDraw={()=>{setMode('plan');setDrawing(true);}}/>
          <div className="sidebar-footer"><span><FloppyDisk size={15}/>Nur auf diesem Gerät</span><button onClick={()=>setModal('reset')}>Neuer Plan</button></div>
        </aside>}
        <main className="main-content">
          <div className="workspace-heading"><div><span className="eyebrow">{mode==='floorplan'?'PDF · MASSSTAB · RÄUME':'VERLEGEPLAN'}</span><h1>{mode==='floorplan'?'Dein Grundriss':project.name||'Mein Raum'}</h1></div>
            <div className="view-tabs" aria-label="Ansicht"><button aria-pressed={mode==='plan'} className={mode==='plan'?'active':''} onClick={()=>setMode('plan')}><SquaresFour size={16}/>Plan</button><button aria-pressed={mode==='floorplan'} className={mode==='floorplan'?'active':''} onClick={()=>{setDrawing(false);setMode('floorplan');}}><FolderOpen size={16}/>Grundriss</button><button aria-pressed={mode==='variants'} className={mode==='variants'?'active':''} onClick={()=>{setDrawing(false);setMode('variants');}}><Stack size={16}/>Varianten{variants.length>0&&<span className="tab-count">{variants.length}</span>}</button></div>
          </div>
          {mode==='floorplan'?<FloorPlanEditor key={editorEpoch} document={workspace.floorPlan} pdfBytes={pdfBytes} rooms={workspace.rooms} activeRoomId={workspace.activeRoomId} busy={pdfBusy}
            onImport={importPdf} onPageChange={page=>{if(workspace.floorPlan)navigate({...workspace,floorPlan:{...workspace.floorPlan,activePage:page}});}}
            onCalibrate={calibration=>{commit(calibratePage(workspace,calibration));setNotice('Maßstab gespeichert. Die Räume auf dieser Seite wurden angepasst.');}}
            onAddRoom={(name,points)=>{commit(addPdfRoom(workspace,name,points));setDrawing(false);setMode('plan');setNotice('Raum übernommen. Lege jetzt Belag und Verlegung fest.');}}
            onOpenRoom={openRoom} onRemoveRoom={deleteRoom}/>:mode==='plan'?<>
            <div className="plan-toolbar">
              <span className="pattern-description">{PATTERN_NAMES[displayProject.layout.pattern]}<span>·</span>{formatNumber(displayProject.material.width/10)} × {formatNumber(displayProject.material.height/10)} cm</span>
              <div className="view-options">
                <button ref={startButton} className={`start-entry ${pickingStart?'active':''}`} disabled={pending||!!error||!result||drawing} aria-pressed={!!pickingStart} onClick={pickingStart?cancelStart:beginStart}><Crosshair size={17}/><span>{project.layout.start?'Start ändern':'Start wählen'}</span></button>
                <button aria-pressed={showDimensions} className={showDimensions?'active':''} onClick={()=>setShowDimensions(!showDimensions)}><Ruler size={16}/><span>Maße</span></button>
                <button aria-pressed={showCuts} className={showCuts?'active':''} onClick={()=>setShowCuts(!showCuts)}><Scissors size={16}/><span>Zuschnitte</span></button>
                <button aria-pressed={showGuides} className={showGuides?'active':''} onClick={()=>setShowGuides(!showGuides)}><Crosshair size={16}/><span>Achsen</span></button>
              </div>
            </div>
            {pickingStart&&result&&!pending&&!error&&<StartPicker kind={pickingStart} points={result.roomPolygon} room={displayProject.room} onKind={setPickingStart} onPick={chooseStart} onCancel={cancelStart}/>}
            <div className="canvas-frame" aria-busy={pending}>
              {error?<div className="plan-error" role="alert"><WarningCircle size={32}/><h2>Bitte prüfe deine Eingaben</h2><p>{error}</p><button className="button" onClick={undo} disabled={!history.past.length}>Letzte Änderung zurücknehmen</button></div>:result?<PlanCanvas project={displayProject} result={result} showCuts={showCuts} showDimensions={showDimensions} showGuides={showGuides} selected={selected} onSelect={setSelected} pickingStart={pickingStart} onPickStart={chooseStart} drawing={drawing} onCancelDraw={()=>setDrawing(false)}
                onDrawRoom={points=>{const {start:_start,...layout}=project.layout;change({...project,layout:project.layout.start?{...layout,offsetX:0,offsetY:0}:layout,room:{...project.room,shape:'custom',points,obstacles:[]}});setDrawing(false);}}
                onOffset={(x,y)=>change({...project,layout:{...project.layout,offsetX:x,offsetY:y}})}/>:<div className="plan-loading">Der Plan wird berechnet …</div>}
              {pending&&result&&<div className="calculating" role="status">Berechnet …</div>}
            </div>
            {result&&!error&&<>
              {result.start&&<div className="start-summary" aria-label="Gewählter Start">
                <span className="start-summary-number" aria-hidden="true">1</span>
                <span><strong>Start: {result.start.label}</strong><small>{result.pieces[0].cut?'Zuschnitt':'Ganzes Element'} · {formatNumber(result.pieces[0].width,2)} × {formatNumber(result.pieces[0].height,2)} mm</small></span>
                <button className="button" disabled={pending||!!pickingStart} onClick={()=>setSelected(result.start!.pieceId)}>Startfliese prüfen</button>
              </div>}
              <section className="results" aria-label="Materialübersicht">
                <div className="result-value"><span>Raumfläche</span><strong>{formatArea(result.roomArea)}</strong></div>
                <div className="result-value"><span>Ganze Elemente</span><strong>{formatNumber(result.fullCount,0)}<small> Stück</small></strong></div>
                <div className="result-value"><span>Zuschnitte</span><strong>{formatNumber(result.cutCount,0)}<small> Stück</small></strong></div>
                <div className="result-value"><span>Verschnitt</span><strong>{formatNumber(result.wastePercent,1)}<small> %</small></strong></div>
                <button className="variant-save button" disabled={pending||variants.length>=12} onClick={()=>{setVariantName(`Variante ${variants.length+1}`);setModal('variant');}}><Plus size={17}/><span>Variante merken</span></button>
              </section>
              <div className="plan-footnotes">
                <span>{result.recommendedPieces} Elemente inkl. {formatNumber(displayProject.material.reserve)} % Reserve · {result.packs} Pakete à {displayProject.material.piecesPerPack} Stück</span>
                <button onClick={()=>setModal('help')}>Wie wird gerechnet?<Info size={14}/></button>
              </div>
              {(narrow>0||result.warnings.length>0)&&<div className="plan-note"><Info size={16}/><span>{result.warnings.join(' ')}</span>{narrow>0&&<button disabled={pending} onClick={()=>{const p=result.pieces.find(p=>p.cut&&p.minDimension<displayProject.material.minCut);if(p){setSelected(p.id);setShowCuts(true);}}}>Prüfen<ArrowDown size={12}/></button>}</div>}
            </>}
          </>:<section className="variants-view" aria-label="Gespeicherte Varianten">
            <div className="variants-intro"><div><h2>Welche Aufteilung passt?</h2><p>Merke dir einen Stand und vergleiche die Zuschnitte.</p></div><button className="button primary" disabled={!canExport||variants.length>=12} onClick={()=>{setVariantName(`Variante ${variants.length+1}`);setModal('variant');}}><Plus size={17}/>Aktuellen Plan merken</button></div>
            {!variants.length?<div className="empty-variants"><Stack size={40} weight="light"/><h3>Noch keine Varianten</h3><p>Speichere den aktuellen Plan als erste Variante.</p></div>:<div className="variant-grid">{variants.map(v=><VariantCard key={v.id} variant={v} onLoad={()=>{change(structuredClone(v.project),true);setDrawing(false);setMode('plan');setNotice(`${v.name} geladen.`);}} onDelete={()=>storeVariants(variants.filter(s=>s.id!==v.id))}/>)}</div>}
          </section>}
        </main>
      </div>
      {notice&&<div className="toast" role="status"><span>{notice}</span><button className="icon-button" aria-label="Meldung schließen" onClick={()=>setNotice(null)}><X size={16}/></button></div>}
    </div>
    {modal==='variant'&&<Dialog title="Variante merken" onClose={()=>setModal(null)}><form onSubmit={event=>{event.preventDefault();if(variants.length>=12)return;if(storeVariants([...variants,{id:crypto.randomUUID(),name:variantName.trim()||`Variante ${variants.length+1}`,project:structuredClone(project),createdAt:new Date().toISOString()}])){setModal(null);setNotice('Variante gespeichert.');}}}>
      <label className="dialog-label" htmlFor="variant-name">Name der Variante</label><input id="variant-name" autoFocus maxLength={100} value={variantName} onChange={e=>setVariantName(e.target.value)}/><p className="muted">Raum, Belag und Verlegung werden zusammen gespeichert.</p><div className="dialog-actions"><button type="button" className="button" onClick={()=>setModal(null)}>Abbrechen</button><button className="button primary" type="submit">Variante speichern</button></div>
    </form></Dialog>}
    {modal==='export'&&result&&<Dialog title="Plan mitnehmen" onClose={()=>setModal(null)}>
      <p className="muted">Die Projektdatei sichert alle Räume. SVG, Druck und CSV gelten für „{project.name}“.</p>
      <button className="export-row" onClick={exportProject}><FloppyDisk size={23}/><span><strong>Projektdatei</strong><small>{workspace.rooms.length} {workspace.rooms.length===1?'Raum':'Räume'}{workspace.floorPlan?' · Original-PDF und Maßstäbe':' · alle Einstellungen'} · später wieder öffnen</small></span><DownloadSimple size={20}/></button>
      {exportError&&<p className="inline-warning" role="alert">{exportError}</p>}
      <div className="export-scale"><label htmlFor="print-scale">Maßstab für den Plan</label><select id="print-scale" value={printScale} onChange={e=>setPrintScale(Number(e.target.value))}>{[10,20,25,50,100,200,500].map(s=><option value={s} key={s}>1 : {s}</option>)}</select></div>
      <button className="export-row" onClick={()=>downloadFile(printSvg,`${filename(project.name)}-1-${printScale}.svg`,'image/svg+xml')}><FileArrowDown size={23}/><span><strong>Plan als SVG</strong><small>Vektorgrafik · {formatNumber(printSize.width)} × {formatNumber(printSize.height)} mm</small></span><DownloadSimple size={20}/></button>
      <button className="export-row" disabled={!printFits} onClick={()=>window.print()}><Printer size={23}/><span><strong>Drucken / PDF</strong><small>A4 · Im Druckdialog „100 %“ einstellen</small></span><ArrowDown size={20}/></button>
      {!printFits&&<p className="inline-warning">Der Plan ist für A4 zu groß. Wähle einen kleineren Maßstab.</p>}
      <button className="export-row" onClick={()=>downloadFile(createCutCsv(result),`${filename(project.name)}-zuschnitte.csv`,'text/csv;charset=utf-8')}><Scissors size={23}/><span><strong>Elementliste als CSV</strong><small>Hüllmaße, Flächen und Schnittkonturen</small></span><DownloadSimple size={20}/></button>
    </Dialog>}
    {modal==='help'&&<Dialog title="So planst du deinen Boden" onClose={()=>setModal(null)}><div className="help-content">
      <ol><li><strong>Raum eingeben.</strong> Miss die Innenkontur. Nutze Rechteck, L-Form oder eigene Eckpunkte. Unter „Grundriss“ kannst du eine PDF laden.</li><li><strong>PDF ausmessen.</strong> Markiere zwei Endpunkte einer bekannten Wand. Gib die tatsächliche Länge in cm an. Markiere dann die Innenecken eines Raumes. Jede PDF-Seite hat einen eigenen Maßstab.</li><li><strong>Belag festlegen.</strong> Trage das tatsächliche Produktmaß ein. Fuge und Randabstand werden separat ergänzt. Jeder Raum hat eigene Einstellungen.</li><li><strong>Verlegung ausprobieren.</strong> Klicke über dem Raumplan auf „Start wählen“. Wähle „Ecke“ oder „Wandmitte“ und klicke auf den gewünschten Punkt im Plan. Escape bricht die Auswahl ab. „Start 1“ markiert die erste Fliese. Wähle Muster und Richtung. Mit Versatz X/Y kannst du die Zuschnitte anpassen. Zentrieren hebt die Startauswahl auf.</li><li><strong>Zuschnitte prüfen.</strong> Klicke auf ein Element. Speichere Varianten zum Vergleich.</li></ol>
      <h3>Nachvollziehbare Mengen</h3><p>Jedes angeschnittene Element zählt als ein neues Ausgangsstück. Reststücke werden nicht anderen Elementen zugeordnet. Der Bedarf ist deshalb ohne Wiederverwendung berechnet.</p><p>Verschnitt = nicht verlegte Fläche dieser Ausgangsstücke. Die zusätzliche Reserve wird auf die Stückzahl aufgeschlagen. Pakete werden aufgerundet.</p>
      <h3>Genauigkeit und Produktvorgaben</h3><p>Die Geometrie rechnet in Millimetern. Die Bildschirmansicht erhält alle Maßverhältnisse. Die Anzeigegröße auf dem Bildschirm ist kein physischer Maßstab. SVG und Druck nutzen den gewählten Maßstab.</p><p>Bei schrägen Schnitten zeigt das Hüllmaß das umschließende Rechteck in den Elementachsen. Die Kontur und ihre Kantenmaße bestimmen den Schnitt.</p><p>Fugen, Randabstände und Mindestversatz nach Produktvorgabe prüfen. Die Darstellung von Fischgrät bestätigt keine Eignung eines Klicksystems.</p>
      <p>Ein PDF-Maßstab gilt gleichmäßig in beide Richtungen. Verzerrte Scans brauchen vorher eine Korrektur. Die Genauigkeit hängt von der Vorlage und den markierten Punkten ab. Prüfe ein zweites bekanntes Maß am fertigen Raum.</p>
      <h3>Deine Daten bleiben hier</h3><p>Räume, Maßstäbe, PDF und Varianten werden in diesem Browser gespeichert. Die Projektdatei enthält alle Räume und die Original-PDF. Sie enthält keine separat gemerkten Varianten. Die Anwendung benötigt kein Konto und sendet keine Plandaten.</p>
      <p className="muted">Tastatur: Strg/⌘ Z für Rückgängig, mit Umschalt für Wiederholen. Escape beendet das Zeichnen.</p>
    </div></Dialog>}
    {modal==='reset'&&<Dialog title="Neuen Plan beginnen" onClose={()=>setModal(null)}><p>Alle Räume und die PDF-Zuordnung werden durch einen neuen Raum ersetzt. Gespeicherte Varianten bleiben erhalten. Du kannst diesen Schritt rückgängig machen.</p><div className="dialog-actions"><button className="button" onClick={()=>setModal(null)}>Abbrechen</button><button className="button primary" onClick={()=>{importSequence.current++;commit(createWorkspace(),true);setDrawing(false);setEditorEpoch(n=>n+1);setMode('plan');setModal(null);}}>Neuen Plan beginnen</button></div></Dialog>}
    {canExport&&result&&printFits?<article className="print-sheet"><header><h1>{project.name}</h1><p>Fugenplan · {PATTERN_NAMES[project.layout.pattern]} · Maßstab 1 : {printScale}</p></header><div className="print-drawing" dangerouslySetInnerHTML={{__html:printSvg}}/><div className="print-summary">{result.start&&<p>Startfliese 1: {result.start.label} · {result.pieces[0].cut?'Zuschnitt':'Ganzes Element'} · {formatNumber(result.pieces[0].width,2)} × {formatNumber(result.pieces[0].height,2)} mm</p>}<p>Raumfläche: {formatArea(result.roomArea)} · Element: {project.material.width} × {project.material.height} mm · Fuge: {project.material.grout} mm · Randabstand: {project.material.edgeGap} mm</p><p>{result.fullCount} ganze Elemente · {result.cutCount} Zuschnitte · {formatNumber(result.wastePercent)} % Verschnitt · {result.recommendedPieces} Elemente inkl. {project.material.reserve} % Reserve · {result.packs} Pakete</p><p>Berechnung ohne Wiederverwendung von Reststücken. Produktvorgaben und Aufmaß prüfen.</p><div className="print-check"><span/>Kontrollmaß: 50 mm bei Druck mit 100 %.</div></div></article>:<article className="print-sheet"><h1>Der Plan ist noch nicht druckbereit.</h1><p>Schließe die Druckvorschau. {pending?'Warte auf die Berechnung.':!printFits?'Wähle unter „Exportieren“ einen kleineren Maßstab.':'Prüfe die Eingaben im Plan.'}</p></article>}
  </>;
}

function VariantCard({variant,onLoad,onDelete}:{variant:SavedVariant;onLoad:()=>void;onDelete:()=>void}) {
  const r=useMemo(()=>{try{return calculateLayout(variant.project);}catch{return null;}},[variant.project]);
  return <article className="variant-card"><button className="variant-preview" onClick={onLoad} aria-label={`${variant.name} laden`}>{r?<svg viewBox={`${r.bounds.minX-250} ${r.bounds.minY-250} ${r.bounds.width+500} ${r.bounds.height+500}`} role="img" aria-label={variant.name}><FloorDrawing project={variant.project} result={r}/></svg>:<WarningCircle size={32}/>}</button><div className="variant-card-body"><div className="variant-card-title"><h3>{variant.name}</h3><button className="icon-button" aria-label={`${variant.name} löschen`} onClick={onDelete}><Trash size={17}/></button></div><p>{PATTERN_NAMES[variant.project.layout.pattern]} · {formatNumber(variant.project.material.width/10)} × {formatNumber(variant.project.material.height/10)} cm</p>{variant.project.layout.start&&<p>Start: {startLabel(variant.project.room,variant.project.layout.start)}</p>}{r&&<div className="variant-stats"><span><strong>{r.cutCount}</strong> Zuschnitte</span><span><strong>{formatNumber(r.wastePercent)} %</strong> Verschnitt</span></div>}<button className="button" onClick={onLoad}>Variante laden</button></div></article>;
}
