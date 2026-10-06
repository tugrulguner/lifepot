// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render,screen,cleanup } from "@testing-library/react";
import { afterEach,it,expect } from "vitest";
import { RunComparison } from "./RunComparison";
import { defaultConfig } from "@/game/setup";
import { createSimulation } from "@/game/world";
import { createRunEvidence } from "@/game/run-evidence";
afterEach(cleanup);
it("does not connect a species trajectory across missing observations",()=>{
 const config=defaultConfig();const evidence=createRunEvidence(createSimulation({seed:7,config}));const first=evidence.samples[0];
 const before={...evidence,samples:[first,{...first,generation:2}]};const after={...evidence,samples:[first,{...first,generation:1},{...first,generation:2}]};
 render(<RunComparison before={{config,evidence:before}} after={{config,evidence:after}} adaptive/>);
 const graph=screen.getAllByRole("img",{name:/Compared population history for species/})[0];
 expect(graph.querySelectorAll('polyline[stroke-dasharray]')).toHaveLength(2);
});
it("shows exact changed conditions and separate aligned species histories",()=>{
 const config=defaultConfig(),after=structuredClone(config);after.environment.abundance="scarce";
 const evidence=createRunEvidence(createSimulation({seed:7,config}));
 render(<RunComparison before={{config,evidence}} after={{config:after,evidence}} adaptive/>);
 expect(screen.getByText(/Resource abundance/)).toHaveTextContent("balanced → scarce");
 expect(screen.getAllByRole("img",{name:/Compared population history for species/})).toHaveLength(config.rules!.species.length);
 expect(screen.getByText(/does not establish/)).toBeInTheDocument();
});
