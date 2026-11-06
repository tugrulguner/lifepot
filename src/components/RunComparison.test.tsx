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
it('distinguishes recorded player pressure windows from unchanged starting conditions',()=>{
 const config=defaultConfig(),before=run(config,241,'adaptive'),after=run(config,241,'adaptive');
 after.evidence.playerChanges=[{acceptedGeneration:6,activatedAt:7,restoredAt:13,pressure:'drought',previousPressure:'stability'}];
 render(<RunComparison before={{...before,decisions:[]}} after={{...after,decisions:[]}}/>);
 expect(screen.getByText('No recorded starting-condition changes.')).toBeInTheDocument();
 const changes=screen.getByRole('region',{name:'Compared player-directed conditions'});
 expect(changes).toHaveTextContent('Previous trial: no player changes recorded');
 expect(changes).toHaveTextContent('This trial: drought');
 expect(changes).toHaveTextContent('activated at 7');expect(changes).toHaveTextContent('restored at 13');
 expect(changes).toHaveTextContent('not proof of cause');
 expect(screen.getByText('No accepted automatic Jev decision records in either trial.')).toBeInTheDocument();
});
it('names automatic records separately when both council and player observations exist',()=>{
 const config=defaultConfig(),before=run(config,241,'adaptive'),after=run(config,241,'adaptive');
 after.evidence.playerChanges=[{acceptedGeneration:6,activatedAt:7,restoredAt:13,pressure:'drought',previousPressure:'stability'}];
 const automatic=(recorded.ledger as EvolutionLedger).filter(entry=>entry.source==='jev').slice(0,1);
 render(<RunComparison before={{...before,decisions:automatic}} after={{...after,decisions:structuredClone(automatic)}}/>);
 expect(screen.getByText(/Accepted automatic Jev decision records match/)).toBeInTheDocument();
});
it('does not invent activation or restoration for a player window not observed to execute',()=>{
 const config=defaultConfig(),before=run(config,241,'adaptive'),after=run(config,241,'adaptive');
 after.evidence.playerChanges=[{acceptedGeneration:6,activatedAt:null,restoredAt:null,pressure:'drought',previousPressure:'stability'}];
 render(<RunComparison before={before} after={after}/>);
 const changes=screen.getByRole('region',{name:'Compared player-directed conditions'});
 expect(changes).toHaveTextContent('activation not observed');expect(changes).toHaveTextContent('restoration not observed');
 expect(changes).not.toHaveTextContent('activated at 7');
});
it('does not call recorded player conditions an unchanged fixed control',()=>{
 const config=defaultConfig(),before=run(config,241),after=run(config,241);
 after.evidence.playerChanges=[{acceptedGeneration:6,activatedAt:7,restoredAt:13,pressure:'drought',previousPressure:'stability'}];
 render(<RunComparison before={before} after={after}/>);
 expect(screen.getByText(/Player-directed exploration/)).toBeInTheDocument();
 expect(screen.queryByText(/repeat observation/)).not.toBeInTheDocument();
});
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
it("shows supplied species names alongside canonical IDs in comparison plots",()=>{
 const config=defaultConfig(),evidence=createRunEvidence(createSimulation({seed:7,config}));
 render(<RunComparison before={{config,evidence,seed:7,policy:"fixed"}} after={{config,evidence,seed:7,policy:"fixed"}} speciesNames={{A:"Algae & friends"}}/>);
 expect(screen.getByRole("img",{name:/Compared population history for Algae & friends \(species A\)/i})).toBeInTheDocument();
 expect(screen.getByText(/Algae & friends.*Species A.*population by generation/i)).toBeInTheDocument();
});

it("keeps an optional previous focus anchored to a recorded fact in the before trial", () => {
 const config = defaultConfig(), evidence = createRunEvidence(createSimulation({ seed: 7, config }));
 const focus = { id: "population", reference: "population", generation: 0, description: "Population recorded", kind: "end" as const };
 render(<RunComparison before={{ config, evidence, seed: 7, policy: "fixed", focus }} after={{ config, evidence, seed: 7, policy: "fixed" }} />);
 expect(screen.getByRole("region", { name: "Observation being investigated" })).toHaveTextContent("Population: 26 at generation 0; 26 at generation 0.");
 expect(screen.getByText(/repeat observation, not a changed-condition experiment/)).toBeInTheDocument();
});

it("anchors a third-trial comparison to the previous recorded focus without causal claims", () => {
 const first = defaultConfig(), previous = structuredClone(first), current = structuredClone(first);
 previous.environment.abundance = "scarce"; current.environment.abundance = "rich";
 const evidence = createRunEvidence(createSimulation({ seed: 7, config: previous }));
 const focus = { id: "population", reference: "population", generation: 0, description: "older summary", kind: "end" as const };
 render(<RunComparison before={{ config: previous, evidence, seed: 7, policy: "fixed", focus }} after={{ config: current, evidence, seed: 7, policy: "fixed" }} />);
 expect(screen.getByRole("region", { name: "Observation being investigated" })).toHaveTextContent("Population: 26 at generation 0; 26 at generation 0.");
 expect(screen.getByText(/Resource abundance/)).toHaveTextContent("scarce → rich");
 expect(screen.getByRole("region", { name: "Observation being investigated" })).toHaveTextContent("The outcomes below describe each whole trial; they do not establish what caused this observation.");
 expect(screen.queryByText(/because of/i)).not.toBeInTheDocument();
});
