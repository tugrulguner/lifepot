// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RunReflectionPanel } from "./RunReflectionPanel";
import { createRunEvidence } from "@/game/run-evidence";
import { createSimulation } from "@/game/world";
import { defaultConfig } from "@/game/setup";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("requests Jev only on demand and lets the player review a bounded next experiment", async () => {
 const state=createSimulation({seed:7,config:defaultConfig()});const evidence=createRunEvidence(state);const onExperiment=vi.fn();
 const result={observations:[{text:"Population remained observable",evidenceRefs:["population"]}],nextExperiment:{title:"Try scarce resources",rationale:"Compare recorded populations under a different resource condition",evidenceRefs:["population"],changes:[{path:"environment.abundance",value:"scarce"}]},caveat:"Fresh adaptive policies can differ"};
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>result});vi.stubGlobal("fetch",fetcher);
 render(<RunReflectionPanel evidence={evidence} config={state.config} onExperiment={onExperiment}/>);
 expect(fetcher).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Ask Jev about this run"}));
 await screen.findByText("Population remained observable");
 expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({evidence,config:state.config});
 fireEvent.click(screen.getByRole("button",{name:"Review suggested experiment"}));expect(onExperiment).toHaveBeenCalledWith(result.nextExperiment);
});
it("reports a failed reflection without manufacturing an explanation", async()=>{
 const state=createSimulation({seed:7,config:defaultConfig()});vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false}));
 render(<RunReflectionPanel evidence={createRunEvidence(state)} config={state.config} onExperiment={vi.fn()}/>);
 fireEvent.click(screen.getByRole("button",{name:"Ask Jev about this run"}));
 await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("Jev reflection unavailable"));
 expect(screen.queryByRole("button",{name:"Review suggested experiment"})).not.toBeInTheDocument();
});
