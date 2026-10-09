// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render,screen,cleanup } from "@testing-library/react";
import { afterEach,it,expect } from "vitest";
import { RunComparison } from "./RunComparison";
import { defaultConfig } from "@/game/setup";
import { createSimulation } from "@/game/world";
import { createRunEvidence } from "@/game/run-evidence";
import recorded from "@/game/fixtures/ca7-replay.json";
import type { EvolutionLedger } from "@/game/decisions";
afterEach(cleanup);
it("discloses whether accepted Jev decision records differ",()=>{
 const config=defaultConfig(),jev=(recorded.ledger as EvolutionLedger).filter(entry=>entry.source==="jev");
 expect(jev.length).toBeGreaterThan(1);
 const before={...run(config,7,"adaptive"),decisions:[jev[0]]};
 const {rerender}=render(<RunComparison before={before} after={{...run(config,7,"adaptive"),decisions:[jev[1]]}} />);
 expect(screen.getByText(/Accepted Jev decision records differ/i)).toBeInTheDocument();
 rerender(<RunComparison before={before} after={{...run(config,7,"adaptive"),decisions:structuredClone(before.decisions)}} />);
 expect(screen.getByText(/Accepted Jev decision records match/i)).toBeInTheDocument();
});
it("does not relabel a recorded replay as a fresh fixed-policy control",()=>{
 const config=defaultConfig(),changed=structuredClone(config);changed.environment.abundance="scarce";
 render(<RunComparison before={{...run(config,7),policy:"recorded"}} after={run(changed,7)} />);
 expect(screen.getByText(/Recorded replay.*not a fresh fixed-rule control/i)).toBeInTheDocument();
});
it("discloses adaptive policy differences even when seeds also differ",()=>{
 const config=defaultConfig();
 render(<RunComparison before={run(config,7,"adaptive")} after={run(config,8,"fixed")} />);
 expect(screen.getByText(/Different initial seeds/i)).toBeInTheDocument();
 expect(screen.getByText(/Adaptive exploration/i)).toBeInTheDocument();
});
const run=(config: ReturnType<typeof defaultConfig>, seed:number, policy:"fixed"|"adaptive"="fixed")=>({config,evidence:createRunEvidence(createSimulation({seed,config})),seed,policy});
it("reports single-condition fixed same-seed comparisons honestly",()=>{
 const config=defaultConfig(),after=structuredClone(config);after.environment.abundance="scarce";
 render(<RunComparison before={run(config,7)} after={run(after,7)} />);
 expect(screen.getByText(/Single-condition fixed comparison.*same initial seed/i)).toBeInTheDocument();
});
it("does not claim a shared seed when seeds differ or are unknown",()=>{
 const config=defaultConfig();
 const {rerender}=render(<RunComparison before={run(config,7)} after={run(config,8)} />);
 expect(screen.getByText(/Different initial seeds/i)).toBeInTheDocument();
 rerender(<RunComparison before={{...run(config,7),seed:null}} after={run(config,7)} />);
 expect(screen.getByText(/Seed provenance unknown/i)).toBeInTheDocument();
});
it("labels adaptive, multiple-change, and unchanged trials without causal claims",()=>{
 const config=defaultConfig(),changed=structuredClone(config);changed.environment.abundance="scarce";changed.environment.hazard="toxin";
 const {rerender}=render(<RunComparison before={run(config,7,"adaptive")} after={run(changed,7,"adaptive")} />);
 expect(screen.getByText(/Adaptive exploration/i)).toBeInTheDocument();
 rerender(<RunComparison before={run(config,7)} after={run(changed,7)} />);
 expect(screen.getByText(/Multiple conditions changed/i)).toBeInTheDocument();
 rerender(<RunComparison before={run(config,7)} after={run(config,7)} />);
 expect(screen.getByText(/No recorded condition changes.*repeat observation/i)).toBeInTheDocument();
});
it("does not connect a species trajectory across missing observations",()=>{
 const config=defaultConfig();const evidence=createRunEvidence(createSimulation({seed:7,config}));const first=evidence.samples[0];
 const before={...evidence,samples:[first,{...first,generation:2}]};const after={...evidence,samples:[first,{...first,generation:1},{...first,generation:2}]};
 render(<RunComparison before={{config,evidence:before,seed:7,policy:"adaptive"}} after={{config,evidence:after,seed:7,policy:"adaptive"}}/>);
 const graph=screen.getAllByRole("img",{name:/Compared population history for species/})[0];
 expect(graph.querySelectorAll('polyline[stroke-dasharray]')).toHaveLength(2);
});
it("shows exact changed conditions and separate aligned species histories",()=>{
 const config=defaultConfig(),after=structuredClone(config);after.environment.abundance="scarce";
 const evidence=createRunEvidence(createSimulation({seed:7,config}));
 render(<RunComparison before={{config,evidence,seed:7,policy:"adaptive"}} after={{config:after,evidence,seed:7,policy:"adaptive"}}/>);
 expect(screen.getByText(/Resource abundance/)).toHaveTextContent("balanced → scarce");
 expect(screen.getAllByRole("img",{name:/Compared population history for species/})).toHaveLength(config.rules!.species.length);
 expect(screen.getByText(/does not establish/)).toBeInTheDocument();
});
