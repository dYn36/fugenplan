import { useEffect, useRef, useState } from 'react';
import type { LayoutResult, Project } from '../types';

export function usePlan(project:Project) {
  const worker=useRef<Worker | null>(null);
  const sequence=useRef(0);
  const latest=useRef(project);
  const [state,setState]=useState<{result:LayoutResult|null;calculatedProject:Project|null;error:string|null;pending:boolean}>({result:null,calculatedProject:null,error:null,pending:true});
  useEffect(()=>{
    const w=new Worker(new URL('./geometry.worker.ts',import.meta.url),{type:'module'}); worker.current=w;
    w.onmessage=(event:MessageEvent<{id:number;result?:LayoutResult;error?:string}>)=>{
      if(event.data.id!==sequence.current) return;
      setState({result:event.data.result??null,calculatedProject:latest.current,error:event.data.error??null,pending:false});
    };
    w.onerror=()=>setState({result:null,calculatedProject:latest.current,error:'Die Berechnung konnte nicht gestartet werden. Lade die Seite erneut.',pending:false});
    return ()=>{w.terminate();worker.current=null;};
  },[]);
  useEffect(()=>{
    sequence.current+=1;
    latest.current=project;
    setState(s=>({...s,pending:true,error:null}));
    worker.current?.postMessage({project,id:sequence.current});
  },[project]);
  return {...state,pending:state.pending||state.calculatedProject!==project};
}
