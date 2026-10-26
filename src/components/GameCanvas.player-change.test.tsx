// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,test,vi} from 'vitest';
import {GameCanvas} from './GameCanvas';
import type {SimulationState} from '@/game/world';
const {states}=vi.hoisted(()=>({states:[] as SimulationState[]}));
vi.mock('@/game/world',async original=>{const actual=await original<typeof import('@/game/world')>();return {...actual,createSimulation:(...args:Parameters<typeof actual.createSimulation>)=>{const state=actual.createSimulation(...args);states.push(state);return state}}});
vi.mock('next/link',()=>({default:({children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement>)=><a {...props}>{children}</a>}));
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();states.length=0});
function seed(){
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('scrollTo',vi.fn());vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 render(<GameCanvas/>);fireEvent.click(screen.getByRole('button',{name:'Explore deterministic preset'}));fireEvent.click(screen.getByRole('button',{name:/Seed ecosystem/}));
}
test('requesting an optional Jev change pauses the exact running world without advancing it',()=>{
 seed();const before=JSON.stringify(states.at(-1));
 fireEvent.click(screen.getByRole('button',{name:'Ask Jev to change this world'}));
 expect(screen.getByRole('button',{name:'Resume'})).toBeInTheDocument();
 expect(screen.getByRole('textbox',{name:'Request a temporary world change'})).toBeInTheDocument();
 expect(JSON.stringify(states.at(-1))).toBe(before);
 expect(screen.getByTestId('generation')).toHaveTextContent('0 / 180');
});
test('a reviewed request stays queued while paused and reports actual activation and restoration',async()=>{
 seed();const before=JSON.stringify(states.at(-1));
 const proposed={version:1,source:'jev',model:'test',usage:{input_tokens:1,output_tokens:1},pressure:'nutrient_bloom',duration:6,evidence:{choice:'nutrient_bloom',confidence:.7,probabilities:{unsupported:0,stability:0,drought:0,toxin_wave:0,heat_wave:0,fragmentation:0,nutrient_bloom:1}}};
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({outcome:'proposed',proposal:proposed})}));
 fireEvent.click(screen.getByRole('button',{name:'Ask Jev to change this world'}));
 fireEvent.change(screen.getByRole('textbox',{name:'Request a temporary world change'}),{target:{value:'Increase nutrients temporarily'}});fireEvent.click(screen.getByRole('button',{name:'Ask Jev for a proposal'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Accept this change'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Accept this change'}));
 expect(JSON.stringify(states.at(-1))).toBe(before);expect(screen.getByTestId('generation')).toHaveTextContent('0 / 180');expect(screen.getByLabelText('Player change status')).toHaveTextContent('Accepted');
 for(let i=1;i<=6;i++){fireEvent.click(screen.getByRole('button',{name:'Step one generation'}));expect(screen.getByTestId('generation')).toHaveTextContent(`${i} / 180`)}
 expect(screen.getByLabelText('Player change status')).toHaveTextContent('Active');
 fireEvent.click(screen.getByRole('button',{name:'Step one generation'}));expect(screen.getByLabelText('Player change status')).toHaveTextContent('restored');
});
