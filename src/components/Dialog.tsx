import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from '@phosphor-icons/react';
export default function Dialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  useLayoutEffect(()=>{
    const dialog=ref.current;
    const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('form input:not([type="hidden"]), form select, form textarea')?.focus();
    return()=>{
      dialog?.close();
      if(trigger?.isConnected)trigger.focus({preventScroll:true});
    };
  },[]);
  return <dialog className="dialog" ref={ref} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===ref.current)onClose();}} aria-labelledby="dialog-title">
    <div className="dialog-header"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Dialog schließen" onClick={onClose}><X size={20}/></button></div>
    {children}
  </dialog>;
}
