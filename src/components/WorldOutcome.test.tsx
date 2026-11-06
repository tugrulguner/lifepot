// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createSimulation } from '@/game/world';
import { defaultConfig } from '@/game/setup';
import { createRunEvidence, followRunLineage } from '@/game/run-evidence';
import { WorldOutcome } from './WorldOutcome';
afterEach(cleanup);

it('retains the living family and hands its recorded observation into review', () => {
  const state = createSimulation({ seed: 7, config: defaultConfig() });
  const followed = state.lineage[state.guild.findIndex(Boolean)];
  const evidence = followRunLineage(createRunEvidence(state), state, followed);
  const onReview = vi.fn(), onInvestigate = vi.fn();
  render(<WorldOutcome state={state} evidence={evidence} followed={followed} onInvestigate={onInvestigate} onReview={onReview} />);
  expect(screen.getByLabelText('Near-board family outcome').textContent).toContain(`Lineage #${followed} · 1 living member`);
  fireEvent.click(screen.getByRole('button', { name: 'Review next trial' }));
  expect(onReview).toHaveBeenCalledWith(expect.objectContaining({ reference: `family-observation:${followed}`, generation: 0, kind: 'family' }));
  fireEvent.click(screen.getByRole('button', { name: 'Investigate this outcome' }));
  expect(onInvestigate).toHaveBeenCalledOnce();
});

it('does not invent an extinction time for an unrecorded missing family', () => {
  const state = createSimulation({ seed: 7, config: defaultConfig() });
  render(<WorldOutcome state={state} evidence={createRunEvidence(state)} followed={99999} onInvestigate={() => {}} />);
  expect(screen.getByLabelText('Near-board family outcome').textContent).toContain('extinction time not recorded');
  expect(screen.queryByRole('button', { name: 'Review next trial' })).toBeNull();
});

it('preserves a named species when presenting a recorded extinction', () => {
  const state = createSimulation({ seed: 7, config: defaultConfig() }), evidence = createRunEvidence(state);
  const first = evidence.samples[0];
  evidence.samples.push({ ...first, generation: 1, species: first.species.map(s => s.speciesId === 'A' ? { ...s, population: 0 } : s) });
  evidence.firstExtinction = [{ speciesId: 'A', generation: 1 }];
  render(<WorldOutcome state={state} evidence={evidence} followed={null} names={{ A: 'Pond snails' }} onInvestigate={() => {}} />);
  expect(screen.getByText('Pond snails (Species A) first observed extinct at generation 1.')).toBeTruthy();
});
