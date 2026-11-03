// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StarterWorldPicker from './StarterWorldPicker';
import { GameCanvas } from './GameCanvas';

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('shows a generated habitat from the selected starter and can switch to custom questions', () => {
  const onChoose = vi.fn();
  const onDescribeOwn = vi.fn();
  render(<StarterWorldPicker onChoose={onChoose} onDescribeOwn={onDescribeOwn} />);

  fireEvent.click(screen.getByRole('button', { name: 'Preview Hunters and prey' }));
  expect(screen.getByRole('img', { name: /Starter habitat preview: Hunters and prey/ })).toHaveAttribute('data-starter-id', 'hunters-and-prey');
  expect(screen.getByText(/Starting population: \d+ organisms/)).toBeInTheDocument();
  expect(screen.getByText(/Relationship: B consumes A/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Describe your own world' }));
  expect(onDescribeOwn).toHaveBeenCalledOnce();
});

it('retains custom prose when switching between starter browsing and custom setup', () => {
  render(<GameCanvas />);
  fireEvent.click(screen.getByRole('button', { name: 'Describe your own world' }));
  const worldAnswer = screen.getByRole('textbox', { name: /What exists in this world/ });
  fireEvent.change(worldAnswer, { target: { value: 'My saved custom habitat' } });
  fireEvent.click(screen.getByRole('button', { name: 'Back to starter worlds' }));
  fireEvent.click(screen.getByRole('button', { name: 'Describe your own world' }));
  expect(screen.getByRole('textbox', { name: /What exists in this world/ })).toHaveValue('My saved custom habitat');
});
