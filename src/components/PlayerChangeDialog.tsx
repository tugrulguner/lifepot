"use client";
import {useEffect,useRef} from 'react';
import {PlayerChangePanel,type PlayerChangePanelProps} from './PlayerChangePanel';
export function PlayerChangeDialog({onClose,...props}:PlayerChangePanelProps&{onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');return()=>{dialog.close?.()}},[]);
 return <dialog ref={ref} className="player-change-dialog ph-no-capture" data-ph-no-capture="true" aria-label="Review a player-directed world change" onCancel={onClose}>
  <button type="button" className="player-change-close" onClick={onClose}>Close proposal</button>
  <PlayerChangePanel {...props}/>
 </dialog>
}
