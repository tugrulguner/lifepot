// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {GameCanvas} from './GameCanvas';
import {defaultConfig,hashSetupRequest} from '@/game/setup';

it.each([true,false])('ignores an old custom interpretation after choosing a newer starter (success %s)',async success=>{
 let resolve!:(value:Response)=>void;
 const pending=new Promise<Response>(r=>{resolve=r});
 const fetch=vi.fn(()=>pending);vi.stubGlobal('fetch',fetch);
 render(<GameCanvas/>);
 fireEvent.click(screen.getByRole('button',{name:'Describe your own world'}));
 const answers={world:'My custom ecology',threat:'A drought',reward:'Survival'};
 for(const [index,value] of Object.values(answers).entries()){
  fireEvent.change(screen.getByRole('textbox'),{target:{value}});
  fireEvent.click(screen.getByRole('button',{name:index===2?'Review ecosystem':'Continue'}));
 }
 expect(fetch).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Back to starter worlds'}));
 fireEvent.click(screen.getByRole('button',{name:'Preview Hunters and prey'}));
 fireEvent.click(screen.getByRole('button',{name:'Review this world'}));
 await act(async()=>{resolve(success?new Response(JSON.stringify({source:'jev',model:'test-fixture',config:defaultConfig(),requestHash:hashSetupRequest(answers)}),{status:200}):new Response('',{status:503}));await pending});
 expect(screen.getByTestId('interpreter-source')).toHaveTextContent('Designed starter');
 expect(screen.getByLabelText('World policy')).toHaveValue('fixed');
 expect(screen.getByRole('button',{name:/Seed ecosystem/})).toBeEnabled();
});

it('does not let an abandoned custom request disable a deliberately chosen legacy preset',async()=>{
 let resolve!:(value:Response)=>void;const pending=new Promise<Response>(r=>{resolve=r});
 vi.stubGlobal('fetch',vi.fn(()=>pending));render(<GameCanvas/>);
 fireEvent.click(screen.getByRole('button',{name:'Describe your own world'}));
 for(let index=0;index<3;index++){
  fireEvent.change(screen.getByRole('textbox'),{target:{value:['Custom pond','Drought','Survival'][index]}});
  fireEvent.click(screen.getByRole('button',{name:index===2?'Review ecosystem':'Continue'}));
 }
 fireEvent.click(screen.getByRole('button',{name:'Back'}));
 fireEvent.click(screen.getByRole('button',{name:'Back'}));
 fireEvent.click(screen.getByRole('button',{name:'Explore deterministic preset'}));
 await act(async()=>{resolve(new Response('',{status:503}));await pending});
 expect(screen.getByRole('button',{name:/Seed ecosystem/})).toBeEnabled();
 expect(screen.queryByText(/Jev could not interpret this setup/)).not.toBeInTheDocument();
});

beforeEach(()=>{
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 vi.stubGlobal('scrollTo',vi.fn());
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()});

it('lets a newcomer review a designed food web without submitting prose or requesting inference',()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 render(<GameCanvas/>);
 fireEvent.click(screen.getByRole('button',{name:'Preview Resource competition'}));
 expect(screen.getByRole('img',{name:/Starter habitat preview/})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Review this world'}));
 expect(screen.getByRole('heading',{name:'World conditions'})).toBeInTheDocument();
 expect(screen.getByLabelText('World policy')).toHaveValue('fixed');
 expect(screen.getByTestId('interpreter-source')).toHaveTextContent(/starter|preset|deterministic setup/i);
 expect(screen.queryByText('Deterministic fallback',{exact:true})).not.toBeInTheDocument();
 expect(fetch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:/Seed ecosystem/}));
 expect(screen.getByRole('region',{name:'Run status'})).toHaveTextContent('Fixed world rules');
 expect(fetch).not.toHaveBeenCalled();
});

it('keeps custom world creation available after browsing starters',()=>{
 render(<GameCanvas/>);
 fireEvent.click(screen.getByRole('button',{name:'Preview Hunters and prey'}));
 fireEvent.click(screen.getByRole('button',{name:'Describe your own world'}));
 expect(screen.getByRole('textbox',{name:/world/i})).toHaveFocus();
 expect(screen.queryByRole('button',{name:'Review this world'})).not.toBeInTheDocument();
});
