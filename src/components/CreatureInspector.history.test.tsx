// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { createSimulation } from '@/game/world';
import { defaultConfig } from '@/game/setup';
import { CreatureInspector } from './CreatureInspector';

afterEach(cleanup);
test('historical inspection has its own identity and never offers to resume the past', () => {
  const state = createSimulation({ seed: 41, config: defaultConfig() });
  const props = { state, index: null, followed: null, onFollow: vi.fn(), onClear: vi.fn(), onPick: vi.fn() };
  const { container } = render(<><CreatureInspector {...props} /><CreatureInspector {...props} historical /></>);
  const ids = [...container.querySelectorAll('[id]')].map(node => node.id);
  expect(new Set(ids).size).toBe(ids.length);
  const historical = screen.getByRole('region', { name: 'Historical creature inspector' });
  expect(historical).toHaveTextContent('recorded frame');
  expect(historical).not.toHaveTextContent(/then resume|Resuming/);
  expect(screen.getByRole('region', { name: /^Creature inspector$/ })).toHaveTextContent('then resume');
});
