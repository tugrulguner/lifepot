// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { defaultConfig } from '@/game/setup';
import { PlayerChangeDialog } from './PlayerChangeDialog';

const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
const persistent: HTMLElement[] = [];
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) {
    this.setAttribute('open', '');
    this.querySelector<HTMLButtonElement>('button')?.focus();
  } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) {
    this.removeAttribute('open');
  } });
});
afterEach(() => {
  cleanup(); persistent.splice(0).forEach(element => element.remove()); vi.unstubAllGlobals();
  for (const [key, descriptor] of [['showModal', originalShow], ['close', originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
  }
});

for (const action of ['Escape', 'Close'] as const) test(`${action} closes before unmount and restores the invoking control`, () => {
  const onClose = vi.fn();
  function Journey() {
    const [open, setOpen] = useState(false);
    return <><button onClick={() => setOpen(true)}>Ask Jev</button>{open && <PlayerChangeDialog bindingKey="current" enabled config={defaultConfig()} generation={0}
      onAccept={vi.fn()} onClose={() => {
        expect(screen.getByRole('button', { name: /^Ask Jev$/ })).toHaveFocus();
        expect(document.querySelector('dialog')).not.toHaveAttribute('open');
        onClose(); setOpen(false);
      }} />}</>;
  }
  render(<Journey />);
  const opener = screen.getByRole('button', { name: /^Ask Jev$/ });
  opener.focus(); fireEvent.click(opener);
  if (action === 'Escape') fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
  else fireEvent.click(screen.getByRole('button', { name: 'Close proposal' }));
  expect(onClose).toHaveBeenCalledOnce(); expect(opener).toHaveFocus(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('replacement-journey unmount does not restore a still-connected old opener', () => {
  const opener = document.createElement('button'), replacement = document.createElement('input');
  document.body.append(opener, replacement); persistent.push(opener, replacement); opener.focus();
  const view = render(<PlayerChangeDialog bindingKey="old" enabled config={defaultConfig()} generation={0} onAccept={vi.fn()} onClose={vi.fn()} />);
  replacement.focus(); view.unmount(); expect(replacement).toHaveFocus();
});
