// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { deepStrictEqual } from 'node:assert';
import { createFixedHabitat, advanceFixedHabitat } from '@/game/fixed-habitat';
import { createRunEvidence, observeRun } from '@/game/run-evidence';
import { createHabitatCheckpoint } from '@/game/habitat-checkpoint';
import { defaultConfig } from '@/game/setup';
import { loadHabitat, saveHabitat } from '@/game/habitat-storage';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GameCanvas } from './GameCanvas';
vi.mock('next/link', () => ({ default: ({children, ...props}: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
const nativeClone = structuredClone;
beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  // JSDOM delegates structuredClone to Node, whose typed arrays belong to a
  // different realm. Rehome only those cloned views to match a real browser.
  const rehome = (value: unknown): unknown => {
    if (ArrayBuffer.isView(value)) {
      const constructors = { Uint8Array, Uint16Array, Uint32Array, Float32Array };
      const name = value.constructor.name as keyof typeof constructors;
      if (name in constructors) return new constructors[name](value as unknown as ArrayLike<number>);
    }
    if (Array.isArray(value)) return value.map(rehome);
    if (value && typeof value === "object") for (const key of Object.keys(value)) (value as Record<string, unknown>)[key] = rehome((value as Record<string, unknown>)[key]);
    return value;
  };
  vi.stubGlobal("structuredClone", (value: unknown) => rehome(nativeClone(value)));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function renderCanvas() {
  vi.stubGlobal('matchMedia', () => ({matches:false,addEventListener(){},removeEventListener(){}}));
  vi.stubGlobal('ResizeObserver', class {observe(){} disconnect(){}});
  vi.stubGlobal('scrollTo', vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{value:vi.fn(),configurable:true});
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('No model calls allowed')));
  render(<GameCanvas/>);
}
function checkpoint() {
  const config=defaultConfig();
  const state=createFixedHabitat({seed:241,config});
  const evidence=createRunEvidence(state);
  const setup={source:'fallback' as const,namedIntent:{species:config.rules!.species.map(item=>({id:item.id,name:`Species ${item.id} name`,role:item.role}))}};
  return createHabitatCheckpoint({id:'61c539c3-ef4d-4425-a567-803a89d3e099',name:'Pond family',createdAt:100,savedAt:200,parentId:null,state,evidence,setup});
}
function setup() {
  renderCanvas();
  fireEvent.click(screen.getByRole('button',{name:'Explore deterministic preset'}));
  fireEvent.change(screen.getByRole('combobox',{name:'World policy'}),{target:{value:'fixed'}});
}
test('saved habitat library is available before starting a run', () => {
  renderCanvas();
  expect(screen.getByRole('region',{name:/Saved habitats/})).toBeInTheDocument();
});
test('opens the exact stored checkpoint paused, steps once, and saves the same identity and full state', async () => {
  const original=checkpoint();
  await saveHabitat(original,null);
  renderCanvas();
  const openButton=await screen.findByRole('button',{name:'Open paused habitat: Pond family'});
  fireEvent.click(openButton);
  expect(await screen.findByText('Saved fixed habitat opened paused at generation 0.')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Resume'})).toBeInTheDocument();
  expect(screen.getByTestId('generation')).toHaveTextContent('0 / 180');
  expect(screen.getAllByText('Species A name').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button',{name:'Step one generation'}));
  await waitFor(()=>expect(screen.getByTestId('generation')).toHaveTextContent('1 / 180'));
  fireEvent.click(screen.getByRole('button',{name:'Pause and save habitat'}));
  await waitFor(()=>expect(Boolean(screen.queryByText(/Habitat saved at generation 1\./))).toBe(true));
  const saved=await loadHabitat(original.id);
  let expectedEvidence=original.evidence;
  const expectedState=advanceFixedHabitat(original.state,1,next=>{ expectedEvidence=observeRun(expectedEvidence,next); });
  expect(saved.id).toBe(original.id);
  expect(saved.createdAt).toBe(original.createdAt);
  expect(saved.parentId).toBe(original.parentId);
  deepStrictEqual(saved.state,expectedState);
  deepStrictEqual(saved.evidence,expectedEvidence);
  deepStrictEqual(saved.setup,original.setup);
});
test('all occurrences of an opted-in fixed habitat name stay inside the privacy capture boundary', async () => {
  setup();
  fireEvent.click(screen.getByRole('checkbox',{name:'Enable same-world save and continuation'}));
  fireEvent.click(screen.getByRole('button',{name:/Seed ecosystem/}));
  const privateName = 'private habitat name';
  fireEvent.change(screen.getByRole('textbox',{name:'Habitat name'}),{target:{value:privateName}});

  const occurrences: Array<{ description: string; protected: boolean }> = [];
  const isProtected = (element: Element | null) => Boolean(element?.closest('.ph-no-capture, [data-ph-no-capture]'));
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      for (const attribute of Array.from(element.attributes)) {
        if (attribute.value.includes(privateName)) occurrences.push({description: `${element.tagName}[${attribute.name}]`, protected: isProtected(element)});
      }
    } else if (node.textContent?.includes(privateName)) {
      occurrences.push({description: `text:${node.textContent}`, protected: isProtected(node.parentElement)});
    }
  }

  expect(occurrences.length).toBeGreaterThan(0);
  expect(occurrences.every(occurrence => occurrence.protected), JSON.stringify(occurrences)).toBe(true);
});

test('same-world continuation is explicitly opted into, not silently enabled for every fixed trial', async () => {
  setup();
  const choice=screen.getByRole('checkbox',{name:'Enable same-world save and continuation'});
  expect(choice).not.toBeChecked();
  fireEvent.click(choice);
  fireEvent.click(screen.getByRole('button',{name:/Seed ecosystem/}));
  expect(screen.getByRole('button',{name:'Pause and save habitat'})).toBeInTheDocument();
  expect(screen.getByRole('region',{name:'Habitat continuity'})).toHaveTextContent('1,800');
  expect(screen.queryByRole('button',{name:'Ask Jev to change this world'})).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox",{name:"Habitat name"}),{target:{value:"Returning pond"}});
  fireEvent.click(screen.getByRole("button",{name:"Pause and save habitat"}));
  await waitFor(()=>{ expect(screen.queryAllByRole('alert').map(node=>node.textContent)).toEqual([]); expect(Boolean(screen.queryByText("Habitat saved at generation 0. It will reopen paused; nothing advances while closed."))).toBe(true); });
  expect(screen.getByRole("button",{name:"Resume"})).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});
