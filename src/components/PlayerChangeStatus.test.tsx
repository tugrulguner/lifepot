// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,test} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {PlayerChangeStatus,PlayerChangeHistory} from './PlayerChangeStatus';
import {createStarterWorld} from '@/game/starter-worlds';
import {createSimulation,stepSimulation} from '@/game/world';
import {createRunEvidence,observeRun} from '@/game/run-evidence';
import {ENVIRONMENT_PRESSURES} from '@/game/rules';
import {stepWithPlayerEvents,worldFingerprint} from '@/game/runtime';
import type {AcceptedPlayerEvent} from '@/game/player-proposal';
afterEach(cleanup);
const event={acceptedGeneration:0,generation:1,previousPressure:'stability',proposal:{version:1,source:'jev',model:'fixture',usage:{input_tokens:1,output_tokens:1},pressure:'drought',duration:6,evidence:{choice:'drought',confidence:1,probabilities:Object.fromEntries(['unsupported',...ENVIRONMENT_PRESSURES].map(k=>[k,k==='drought'?1:0]))}}} as AcceptedPlayerEvent;
function observed(){let state=createSimulation({seed:241,config:createStarterWorld('resource-competition').config});let evidence=createRunEvidence(state);for(let i=0;i<10;i++){state=stepSimulation(state);evidence=observeRun(evidence,state)}return evidence;}
test('an actual aged-population extinction ends the pressure window without inventing restoration',()=>{
 const state=createSimulation({seed:241,config:createStarterWorld('resource-competition').config});
 // Explicit aged-population engine fixture, not a fabricated gameplay outcome.
 state.age.fill(65534);
 const accepted={...event,actor:'player' as const,worldFingerprint:worldFingerprint(state),ruleGraphVersion:state.config.rules!.version};
 const ended=stepWithPlayerEvents(state,[],[accepted]);expect(ended.outcome).toBe('extinct');
 const evidence=observeRun(createRunEvidence(state),ended,[accepted]);expect(evidence.playerChanges![0].restoredAt).toBeNull();
 render(<><PlayerChangeStatus events={[accepted]} generation={ended.generation} outcome={ended.outcome} evidence={evidence}/><PlayerChangeHistory events={[accepted]} generation={ended.generation} outcome={ended.outcome} evidence={evidence}/></>);
 expect(screen.getByLabelText('Player change status')).toHaveTextContent('World ended');
 expect(screen.getByRole('region',{name:'Player-directed changes'})).toHaveTextContent('restoration not observed');
 expect(screen.queryByText(/Active ·/)).not.toBeInTheDocument();
 expect(screen.getAllByLabelText('Recorded response to player change')[0]).toHaveTextContent(`generations 0–${ended.generation}`);
});
test('an ended observation before activation does not call a queued pressure active or restored',()=>{
 render(<PlayerChangeStatus events={[event]} generation={0} outcome="extinct"/>);
 expect(screen.getByLabelText('Player change status')).toHaveTextContent('activation not observed');
 expect(screen.getByLabelText('Player change status')).not.toHaveTextContent('still paused');
});
test('near-board feedback compares actual samples through restoration, not the later whole run',()=>{
 const evidence=observed(),before=evidence.samples[0],after=evidence.samples[7];
 render(<PlayerChangeStatus events={[event]} generation={10} outcome="running" evidence={evidence}/>);
 const measurements=screen.getByLabelText('Recorded response to player change');
 expect(measurements).toHaveTextContent(`Population ${before.population} → ${after.population}`);
 expect(measurements).toHaveTextContent(`${(before.resources/2500).toFixed(1)} → ${(after.resources/2500).toFixed(1)}`);
 expect(measurements).toHaveTextContent('generations 0–7');
 expect(measurements).toHaveTextContent('not proof of cause');
 expect(screen.getByLabelText('Player change status')).toHaveTextContent('restored');
});
test('missing exact window samples are unavailable, never invented from a nearby point',()=>{
 const evidence=observed();evidence.samples=evidence.samples.filter(s=>s.generation!==0);
 render(<PlayerChangeStatus events={[event]} generation={10} outcome="running" evidence={evidence}/>);
 expect(screen.queryByLabelText('Recorded response to player change')).not.toBeInTheDocument();
 expect(screen.getByLabelText('Player change status')).toHaveTextContent('restored');
});
test('ending retains observed intervention window before a next investigation without causal claims',()=>{
 const evidence=observed();render(<PlayerChangeHistory events={[event]} generation={10} outcome="running" evidence={evidence}/>);
 const history=screen.getByRole('region',{name:'Player-directed changes'});
 expect(history).toHaveTextContent('Recorded window');
 expect(history).toHaveTextContent('Species A:');
 expect(history).toHaveTextContent('not proof of cause');
});
