// @vitest-environment jsdom
import React from 'react';
import {afterEach, expect, test, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {defaultConfig} from '@/game/setup';
afterEach(()=>{cleanup();vi.unstubAllGlobals()});

test('a paused-world request is private and requires review before acceptance',async()=>{
 const modules=import.meta.glob('./PlayerChangePanel.tsx');
 expect(modules['./PlayerChangePanel.tsx'],'the optional paused-world proposal panel must exist').toBeTypeOf('function');
 const {PlayerChangePanel}=await modules['./PlayerChangePanel.tsx']() as typeof import('./PlayerChangePanel');
 const onAccept=vi.fn();
 render(<PlayerChangePanel bindingKey="run7-gen4" enabled config={defaultConfig()} generation={4} onAccept={onAccept}/>);
 const input=screen.getByRole('textbox',{name:'Request a temporary world change'});
 expect(input.closest('[data-ph-no-capture="true"]')).not.toBeNull();
 fireEvent.change(input,{target:{value:'Temporarily increase nutrients'}});
 expect(screen.getByRole('button',{name:'Ask Jev for a proposal'})).toBeEnabled();
 expect(onAccept).not.toHaveBeenCalled();
});

test('editable environmental shortcuts only fill the private request and never ask or accept', async () => {
 const PlayerChangePanel=await panel();const onAccept=vi.fn();const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 render(<PlayerChangePanel bindingKey="run7-gen4" enabled config={defaultConfig()} generation={4} onAccept={onAccept}/>);
 const input=screen.getByRole('textbox',{name:'Request a temporary world change'});
 for(const [name,request] of [
  ['Drought','Temporarily reduce regeneration with a drought'],
  ['Nutrient bloom','Temporarily increase regeneration with a nutrient bloom'],
  ['Stability','Temporarily reduce hazard contribution with a stability pressure'],
 ] as const){
  const shortcut=screen.getByRole('button',{name});
  expect(shortcut).toBeEnabled();expect(shortcut).toHaveAttribute('aria-pressed','false');
  fireEvent.click(shortcut);expect(input).toHaveValue(request);expect(shortcut).toHaveAttribute('aria-pressed','true');
  expect(fetcher).not.toHaveBeenCalled();expect(onAccept).not.toHaveBeenCalled();
 }
 fireEvent.change(input,{target:{value:'My own request'}});
 expect(screen.getByRole('button',{name:'Nutrient bloom'})).toHaveAttribute('aria-pressed','false');
 expect(input).toHaveValue('My own request');expect(fetcher).not.toHaveBeenCalled();
});

const proposed={version:1 as const,source:'jev' as const,model:'jev-test',usage:{input_tokens:20,output_tokens:4},pressure:'nutrient_bloom' as const,duration:6 as const,evidence:{choice:'nutrient_bloom',confidence:.6,probabilities:{unsupported:0,stability:0,drought:0,toxin_wave:0,heat_wave:0,fragmentation:0,nutrient_bloom:1}}};
async function panel(){return (await import('./PlayerChangePanel')).PlayerChangePanel}
for(const failure of [false,true])test(`a stale ${failure?'failed':'successful'} proposal cannot overwrite a newer journey`,async()=>{
 const PlayerChangePanel=await panel();const onAccept=vi.fn();let resolve!:(v:unknown)=>void,reject!:(e:Error)=>void;
 const pending=new Promise((yes,no)=>{resolve=yes;reject=no});const fetcher=vi.fn().mockReturnValue(pending);vi.stubGlobal('fetch',fetcher);
 const view=render(<PlayerChangePanel bindingKey="run7-gen4" enabled config={defaultConfig()} generation={4} onAccept={onAccept}/>);
 fireEvent.change(screen.getByRole('textbox',{name:'Request a temporary world change'}),{target:{value:'More nutrients'}});fireEvent.click(screen.getByRole('button',{name:'Ask Jev for a proposal'}));
 view.rerender(<PlayerChangePanel bindingKey="run8-gen0" enabled config={defaultConfig()} generation={0} onAccept={onAccept}/>);
 expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
 if(failure)reject(new Error('old response'));else resolve({ok:true,status:200,json:async()=>({outcome:'proposed',proposal:proposed})});
 await waitFor(()=>expect(screen.getByRole('textbox',{name:'Request a temporary world change'})).toHaveValue(''));
 await new Promise(r=>setTimeout(r,0));
 expect(screen.queryByRole('region',{name:'Review Jev proposal'})).not.toBeInTheDocument();expect(screen.queryByRole('status')).not.toBeInTheDocument();expect(onAccept).not.toHaveBeenCalled();
});
for(const outcome of ['unsupported','quota','invalid','cancel'] as const)test(`${outcome} leaves the world without an accepted change`,async()=>{
 const PlayerChangePanel=await panel();const onAccept=vi.fn();let resolve!:(v:unknown)=>void;
 const pending=new Promise(yes=>{resolve=yes});vi.stubGlobal('fetch',vi.fn().mockReturnValue(pending));
 render(<PlayerChangePanel bindingKey="run7-gen4" enabled config={defaultConfig()} generation={4} onAccept={onAccept}/>);
 fireEvent.change(screen.getByRole('textbox',{name:'Request a temporary world change'}),{target:{value:'More nutrients'}});fireEvent.click(screen.getByRole('button',{name:'Ask Jev for a proposal'}));
 if(outcome==='cancel')fireEvent.click(screen.getByRole('button',{name:'Cancel proposal'}));
 resolve({ok:outcome!=='quota',status:outcome==='quota'?429:200,json:async()=>outcome==='unsupported'?{outcome:'unsupported'}:outcome==='invalid'?{outcome:'proposed',proposal:{...proposed,pressure:'bogus'}}:{outcome:'proposed',proposal:proposed}});
 await waitFor(()=>expect(screen.getByRole('status')).toBeVisible());
 expect(screen.queryByRole('button',{name:'Accept this change'})).not.toBeInTheDocument();expect(onAccept).not.toHaveBeenCalled();
});
test('a returned Jev proposal is previewed and only explicit acceptance applies it once',async()=>{
 const PlayerChangePanel=await panel();const onAccept=vi.fn();const fetcher=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({outcome:'proposed',proposal:proposed})});vi.stubGlobal('fetch',fetcher);
 render(<PlayerChangePanel bindingKey="run7-gen4" enabled config={defaultConfig()} generation={4} onAccept={onAccept}/>);
 fireEvent.change(screen.getByRole('textbox',{name:'Request a temporary world change'}),{target:{value:'More nutrients for a short time'}});
 fireEvent.click(screen.getByRole('button',{name:'Ask Jev for a proposal'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Accept this change'})).toBeEnabled());
 expect(onAccept).not.toHaveBeenCalled();
 expect(screen.getByRole('region',{name:'Review Jev proposal'})).toHaveTextContent('nutrient bloom');
 expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({request:'More nutrients for a short time',generation:4,config:defaultConfig()});
 fireEvent.click(screen.getByRole('button',{name:'Accept this change'}));
 expect(onAccept).toHaveBeenCalledExactlyOnceWith(proposed);
 expect(screen.queryByRole('button',{name:'Accept this change'})).not.toBeInTheDocument();
});

for(const [pressure,mechanism] of [
 ['drought','Drought reduces regeneration'],
 ['nutrient_bloom','Nutrient bloom increases regeneration'],
 ['stability','Stability reduces hazard contribution, not every hazard'],
 ['toxin_wave','Toxin waves periodically raise hazards in bands and lower them elsewhere'],
 ['heat_wave','Heat waves raise hazards across the grid'],
 ['fragmentation','Fragmentation reduces regeneration in habitat bands'],
] as const)test(`review explains the returned ${pressure} pressure without promising an outcome`,async()=>{
 const config=defaultConfig();config.rules!.environment.pressure=pressure==='stability'?'fragmentation':'stability';
 const PlayerChangePanel=await panel();const returned={...proposed,pressure,evidence:{...proposed.evidence,choice:pressure,probabilities:{unsupported:0,stability:0,drought:0,toxin_wave:0,heat_wave:0,fragmentation:0,nutrient_bloom:0,[pressure]:1}}};
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({outcome:'proposed',proposal:returned})}));
 render(<PlayerChangePanel bindingKey="run7-gen4" enabled config={config} generation={4} onAccept={vi.fn()}/>);
 fireEvent.change(screen.getByRole('textbox',{name:'Request a temporary world change'}),{target:{value:'Try something'}});
 fireEvent.click(screen.getByRole('button',{name:'Ask Jev for a proposal'}));
 const review=await screen.findByRole('region',{name:'Review Jev proposal'});
 expect(review).toHaveTextContent(mechanism);
 expect(review).toHaveTextContent('cannot guarantee survival');
 expect(review).toHaveTextContent('Nothing has been applied');
});
