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

it('shows a generated habitat and returns to the world description from starter mode', () => {
  const onChoose = vi.fn();
  const onDescribeOwn = vi.fn();
  render(<StarterWorldPicker onChoose={onChoose} onDescribeOwn={onDescribeOwn} />);

  fireEvent.click(screen.getByRole('button', { name: 'Preview Hunters and prey' }));
  expect(screen.getByRole('img', { name: /Starter habitat preview: Hunters and prey/ })).toHaveAttribute('data-starter-id', 'hunters-and-prey');
  expect(screen.getByText(/Starting population: \d+ organisms/)).toBeInTheDocument();
  expect(screen.getByText(/Relationship: B consumes A/)).toBeInTheDocument();

  expect(screen.getByRole('heading', { name: 'Choose a living world' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Describe your own world' }));
  expect(onDescribeOwn).toHaveBeenCalledOnce();
});

it('keeps the world question first and does not autofocus it', () => {
  render(<GameCanvas />);
  expect(screen.getByRole('heading', { name: 'What exists in your world?' })).toBeVisible();
  const textbox = screen.getByRole('textbox', { name: /What exists in your world/ });
  expect(textbox).not.toHaveFocus();
  expect(screen.queryByRole('heading', { name: 'Choose a living world' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Custom world' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Starter worlds' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Use a starter world instead' }));
  expect(screen.getByRole('heading', { name: 'Choose a living world' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Describe your own world' })).toBeVisible();
});

it('retains custom prose when switching to and from starter browsing', () => {
  render(<GameCanvas />);
  const worldAnswer = screen.getByRole('textbox', { name: /What exists in your world/ });
  fireEvent.change(worldAnswer, { target: { value: 'My saved custom habitat' } });
  fireEvent.click(screen.getByRole('button', { name: 'Use a starter world instead' }));
  fireEvent.click(screen.getByRole('button', { name: 'Describe your own world' }));
  expect(screen.getByRole('textbox', { name: /What exists in your world/ })).toHaveValue('My saved custom habitat');
});
