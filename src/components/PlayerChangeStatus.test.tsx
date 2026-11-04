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
import type {AcceptedPlayerEvent} from '@/game/player-proposal';
afterEach(cleanup);
const event={acceptedGeneration:0,generation:1,previousPressure:'stability',proposal:{version:1,source:'jev',model:'fixture',usage:{input_tokens:1,output_tokens:1},pressure:'drought',duration:6,evidence:{choice:'drought',confidence:1,probabilities:Object.fromEntries(['unsupported',...ENVIRONMENT_PRESSURES].map(k=>[k,k==='drought'?1:0]))}}} as AcceptedPlayerEvent;
function observed(){let state=createSimulation({seed:241,config:createStarterWorld('resource-competition').config});let evidence=createRunEvidence(state);for(let i=0;i<10;i++){state=stepSimulation(state);evidence=observeRun(evidence,state)}return evidence;}
test('near-board feedback compares actual samples through restoration, not the later whole run',()=>{
 const evidence=observed(),before=evidence.samples[0],after=evidence.samples[7];
 render(<PlayerChangeStatus events={[event]} generation={10} evidence={evidence}/>);
 const measurements=screen.getByLabelText('Recorded response to player change');
 expect(measurements).toHaveTextContent(`Population ${before.population} → ${after.population}`);
 expect(measurements).toHaveTextContent(`${(before.resources/2500).toFixed(1)} → ${(after.resources/2500).toFixed(1)}`);
 expect(measurements).toHaveTextContent('generations 0–7');
 expect(measurements).toHaveTextContent('not proof of cause');
 expect(screen.getByLabelText('Player change status')).toHaveTextContent('restored');
});
test('missing exact window samples are unavailable, never invented from a nearby point',()=>{
 const evidence=observed();evidence.samples=evidence.samples.filter(s=>s.generation!==0);
 render(<PlayerChangeStatus events={[event]} generation={10} evidence={evidence}/>);
 expect(screen.queryByLabelText('Recorded response to player change')).not.toBeInTheDocument();
 expect(screen.getByLabelText('Player change status')).toHaveTextContent('restored');
});
test('ending retains observed intervention window before a next investigation without causal claims',()=>{
 const evidence=observed();render(<PlayerChangeHistory events={[event]} generation={10} evidence={evidence}/>);
 const history=screen.getByRole('region',{name:'Player-directed changes'});
 expect(history).toHaveTextContent('Recorded window');
 expect(history).toHaveTextContent('Species A:');
 expect(history).toHaveTextContent('not proof of cause');
});
