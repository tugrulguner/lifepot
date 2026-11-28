// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { createSimulation } from '@/game/world';
import { defaultConfig } from '@/game/setup';
import { EnvironmentReadout } from './EnvironmentReadout';
afterEach(cleanup);
it('compares recorded food at stable boundaries, including the final partial interval', () => {
  const state = createSimulation({ seed: 7, config: defaultConfig() });
  state.generation = 8;
  state.history = [1000, 1600, 1400].map((resources,i) => ({ ...state.history[0], generation: [0,6,8][i], resources }));
  state.events = [
    { kind: 'feeding', source: 'resource', generation: 7, organismId: 1, at: 0, energy: 8 },
    { kind: 'feeding', source: 'prey', generation: 8, organismId: 1, at: 0, energy: 8 },
    { kind: 'feeding', source: 'resource', generation: 3, organismId: 1, at: 0, energy: 8 },
  ];
  const { rerender } = render(<EnvironmentReadout state={state} showHazards={true}/>);
  const note = screen.getByRole('note', {name:'Habitat readout'});
  expect(note).toHaveTextContent('World food: up 600 units · Last interval: Gen 0–6');
  expect(note).not.toHaveTextContent(/feeding event/);
  expect(note).toHaveTextContent('Possible mechanism, not measured here: food can regrow each generation and organisms can consume it when feeding.');
  expect(note).toHaveTextContent('Low');
  expect(note).toHaveTextContent('Rich');
  expect(note).toHaveTextContent('Pale warm sediment → green beds');
  expect(note).toHaveTextContent('Hazard · coral hatching shown');
  expect(note).not.toHaveAttribute('aria-live');
  state.outcome = 'surviving';
  rerender(<EnvironmentReadout state={state} showHazards={false}/>);
  expect(note).toHaveTextContent('World food: down 200 units · Last interval: Gen 6–8');
  expect(note).not.toHaveTextContent(/feeding event/);
  expect(note).toHaveTextContent('Hazard · coral hatching off');
  state.history[2].resources = 1600;
  rerender(<EnvironmentReadout state={state} showHazards={false}/>);
  expect(note).toHaveTextContent('the same at both readings');
  state.history = [];
  rerender(<EnvironmentReadout state={state} showHazards={false}/>);
  expect(note).toHaveTextContent('Waiting for two recorded food measurements');
});
