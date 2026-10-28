"use client";
import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import type {LifeConfig} from '@/game/world';
import {validatePlayerProposal,type PlayerProposal} from '@/game/player-proposal';
export type PlayerChangePanelProps={bindingKey:string;enabled:boolean;disabledReason?:string;config:LifeConfig;generation:number;onAccept:(proposal:PlayerProposal)=>void};
const envelope=z.discriminatedUnion('outcome',[
 z.object({outcome:z.literal('proposed'),proposal:z.unknown()}).strict(),
 z.object({outcome:z.literal('unsupported')}).strict(),
]);
export function PlayerChangePanel(props:PlayerChangePanelProps){
 // A new player journey invalidates both pending success and pending failure.
 return <ProposalJourney key={`${props.bindingKey}:${props.enabled}`} {...props}/>;
}
function ProposalJourney({enabled,disabledReason,config,generation,onAccept}:PlayerChangePanelProps){
 const [request,setRequest]=useState('');
 const [proposal,setProposal]=useState<PlayerProposal|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const pending=useRef<AbortController|null>(null),alive=useRef(true),serial=useRef(0),consumed=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;pending.current?.abort()}},[]);
 const cancel=()=>{serial.current++;pending.current?.abort();pending.current=null;setBusy(false);setProposal(null);setRequest('');setMessage('Proposal cancelled. The paused world is unchanged.')};
 async function ask(){
  if(!enabled||busy||!request.trim())return;
  const token=++serial.current,controller=new AbortController();pending.current=controller;
  const current=()=>alive.current&&serial.current===token&&!controller.signal.aborted;
  setBusy(true);setProposal(null);setMessage('');consumed.current=false;
  const timeout=setTimeout(()=>controller.abort(),20_000);
  try{
   const result=await fetch('/api/player-proposal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request:request.trim(),generation,config}),signal:controller.signal});
   if(!current())return;
   if(!result.ok)throw new Error(result.status===429?'Proposal quota reached. No change was accepted.':'Jev could not produce a proposal. No change was accepted.');
   const decoded=envelope.parse(await result.json());if(!current())return;
   if(decoded.outcome==='unsupported'){setMessage('Jev could not express that request as a supported six-generation environmental pressure. The world is unchanged.');return}
   const selected=validatePlayerProposal(decoded.proposal);
   if(selected.pressure===config.rules?.environment.pressure)throw new Error('That pressure is already selected. No new change was accepted.');
   setProposal(selected);
  }catch(error){
   if(alive.current&&serial.current===token){setMessage(controller.signal.aborted?'Jev did not respond in time. No change was accepted.':error instanceof Error&&['Proposal quota reached. No change was accepted.','Jev could not produce a proposal. No change was accepted.','That pressure is already selected. No new change was accepted.'].includes(error.message)?error.message:'Jev returned an invalid proposal. No change was accepted.')}
  }finally{clearTimeout(timeout);if(alive.current&&serial.current===token){setBusy(false);pending.current=null}}
 }
 function accept(){
  if(!enabled||!proposal||consumed.current)return;
  consumed.current=true;setProposal(null);setRequest('');
  try{onAccept(proposal);setMessage('Change accepted for the next generation. The world remains paused; resume or step to execute it.')}catch{setMessage('This proposal no longer matches the paused world. Request a new proposal; nothing was applied.')}
 }
 const label=(value:string)=>value.replaceAll('_',' ');
 return <section className="player-change ph-no-capture" data-ph-no-capture="true" aria-label="Player-directed Jev change">
  <h3>Ask Jev to change this world</h3>
  <p>Optional: request a temporary environmental pressure for six generations. Your request is sent to Jev only when you ask; it is omitted from replay and exports. Species, relationships, intensity and existing organisms are not rewritten.</p>
  {!enabled&&<p>{disabledReason??'Pause this live world to request a change.'}</p>}
  <label>Request a temporary world change<input value={request} onChange={e=>{setRequest(e.target.value);setProposal(null)}} maxLength={280} disabled={!enabled||busy}/></label>
  <div className="player-change-actions"><button type="button" onClick={()=>void ask()} disabled={!enabled||busy||!request.trim()}>{busy?'Jev is considering the request…':'Ask Jev for a proposal'}</button>{(busy||proposal)&&<button type="button" onClick={cancel}>Cancel proposal</button>}</div>
  {proposal&&<section aria-label="Review Jev proposal"><h4>Review Jev proposal</h4><p>Environmental pressure: {label(config.rules!.environment.pressure)} → <strong>{label(proposal.pressure)}</strong>.</p><p>Starts on the next generation after acceptance, lasts six engine generations, then restores the previous pressure. Existing intensity stays {config.rules!.environment.intensity}. Automatic decisions wait while this change is active; existing birth policies continue. This changes conditions, not a guaranteed population outcome.</p><p>Jev · {proposal.model}. Nothing has been applied.</p><button type="button" onClick={accept}>Accept this change</button></section>}
  {message&&<p role="status">{message}</p>}
 </section>
}
