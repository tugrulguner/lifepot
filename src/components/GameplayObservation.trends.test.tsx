// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {createSimulation} from '@/game/world';
import {defaultConfig} from '@/game/setup';
import {createRunEvidence} from '@/game/run-evidence';
import {GameplayObservation} from './GameplayObservation';
afterEach(cleanup);
it('groups co-occurring species and family losses under one recorded generation',()=>{
 const state={...createSimulation({seed:7,config:defaultConfig()}),generation:18};
 const evidence={...createRunEvidence(state),firstExtinction:[{speciesId:'A',generation:18}],lineageExtinction:[{lineage:24,generation:18}]};
 render(<GameplayObservation state={state} evidence={evidence} followed={24} decision={null}/>);
 const notice=screen.getByRole('status',{name:'Latest retained extinction'});
 expect(notice).toHaveTextContent('Species A first observed extinct');expect(notice).toHaveTextContent('Founder lineage #24 first observed extinct');
 expect(notice.textContent?.match(/Generation 18/g)).toHaveLength(1);
});
it('shows neutral per-species recent changes beside current counts with the actual interval',()=>{
 const state={...createSimulation({seed:7,config:defaultConfig()}),generation:10};
 const first=createRunEvidence(state).samples[0];
 const evidence={...createRunEvidence(state),samples:[{...first,generation:4,species:[{speciesId:'A',role:'grazer',population:14},{speciesId:'B',role:'hunter',population:9}]},first]};
 const before=JSON.stringify({state,evidence});
 render(<GameplayObservation state={state} evidence={evidence} followed={null} decision={null}/>);
 const legend=screen.getByLabelText('Configured species counts');
 expect(within(legend).getByRole('img',{name:'Species A population: 14 to 18, generations 4–10. Recorded change, not a prediction.'})).toHaveTextContent('↑4 /6g');
 expect(within(legend).getByRole('img',{name:'Species B population: 9 to 8, generations 4–10. Recorded change, not a prediction.'})).toHaveTextContent('↓1 /6g');
 expect(legend).not.toHaveTextContent(/healthy|winning|improving|because/i);
 expect(JSON.stringify({state,evidence})).toBe(before);
});

it('reports the observed shorter opening interval rather than claiming six generations',()=>{
 const state={...createSimulation({seed:7,config:defaultConfig()}),generation:2};
 const first=createRunEvidence(state).samples[0];
 const evidence={...createRunEvidence(state),samples:[{...first,generation:0,species:first.species.map(s=>({...s,population:s.population-1}))},first]};
 render(<GameplayObservation state={state} evidence={evidence} followed={null} decision={null}/>);
 expect(screen.getByRole('img',{name:/Species A population:/})).toHaveTextContent('↑1 /2g');
});
it('does not infer a trend from missing, stale, sparse or mismatched current evidence',()=>{
 const state={...createSimulation({seed:7,config:defaultConfig()}),generation:10};
 const evidence=createRunEvidence(state),last=evidence.samples[0];
 const {rerender}=render(<GameplayObservation state={state} evidence={null} followed={null} decision={null}/>);
 const assertAbsent=()=>expect(screen.queryByRole('img',{name:/population:/})).not.toBeInTheDocument();assertAbsent();
 for(const samples of [[],[{...last,generation:9}], [{...last,generation:0},last], [{...last,generation:4},{...last,species:last.species.map(s=>({...s,population:s.population+1}))}]]){
  rerender(<GameplayObservation state={state} evidence={{...evidence,samples}} followed={null} decision={null}/>);assertAbsent();
 }
 rerender(<GameplayObservation state={{...state,generation:0}} evidence={{...evidence,samples:[{...last,generation:4},last]}} followed={null} decision={null}/>);assertAbsent();
});
it('shows equal endpoint counts without claiming the intervening population was stable',()=>{
 const state={...createSimulation({seed:7,config:defaultConfig()}),generation:10};
 const evidence=createRunEvidence(state),last=evidence.samples[0];
 const samples=[{...last,generation:4},{...last,generation:7,species:last.species.map(s=>({...s,population:100}))},last];
 render(<GameplayObservation state={state} evidence={{...evidence,samples}} followed={null} decision={null}/>);
 expect(screen.getByRole('img',{name:/Species A population:/})).toHaveTextContent('→0 /6g');
 expect(screen.getByLabelText('Configured species counts')).not.toHaveTextContent(/stable|unchanged population/i);
});
