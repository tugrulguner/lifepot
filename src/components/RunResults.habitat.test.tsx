// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { RunResults } from './RunResults';
import { createFixedHabitat, advanceFixedHabitat } from '@/game/fixed-habitat';
import { defaultConfig } from '@/game/setup';
import { createRunEvidence, observeRun } from '@/game/run-evidence';
afterEach(cleanup);
test('fixed habitat results describe the actual window without offering a fabricated legacy replay',()=>{
 let state=createFixedHabitat({seed:41,config:defaultConfig(),observationLimit:3});
 let evidence=createRunEvidence(state);
 state=advanceFixedHabitat(state,3,next=>{evidence=observeRun(evidence,next)});
 render(<RunResults state={state} evidence={evidence} question="" onNew={vi.fn()} onInspect={vi.fn()} />);
 expect(screen.getByText('Reached the 3-generation observation limit')).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Replay this run'})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Edit this world'})).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Inspect final world'})).toBeInTheDocument();
});
