// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { WatchingOrganism } from "./WatchingOrganism";
import { afterEach, expect, it } from "vitest";
import { createSimulation } from "@/game/world";
import { deterministicSetup } from "@/game/setup";
import { speciesColor } from "@/game/species-colors";
import { organismPath } from "@/game/organism-glyphs";
import { GameplayObservation } from "./GameplayObservation";
afterEach(cleanup);
it.each([false, true])("keeps the live species color/shape key directly available with inspection=%s", inspecting => {
 const state=createSimulation({seed:7,config:deterministicSetup({world:"pond",threat:"drought",reward:"observe"})});
 const before=JSON.stringify(state);
 render(<GameplayObservation state={state} evidence={null} followed={null} decision={null} inspection={inspecting?<p>Selected organism</p>:undefined}/>);
 const legend=screen.getByLabelText("Configured species counts");
 expect(legend.closest("details")).toBeNull();
 for(const species of state.config.rules!.species){
  const row=screen.getByLabelText(`Species ${species.id} count`);
  expect(row.querySelector(`svg path[fill="${speciesColor(species.id)}"]`)).toHaveAttribute("d",organismPath(species.role,50,50,36));
  expect(row).toHaveTextContent(species.role);
 }
 expect(JSON.stringify(state)).toBe(before);
});

it("composes paused activity into the inspected subject's action row without duplicating the legend", () => {
 const state=createSimulation({seed:7,config:deterministicSetup({world:"pond",threat:"drought",reward:"observe"})});
 const index=state.guild.findIndex(Boolean), before=JSON.stringify(state);
 render(<GameplayObservation state={state} evidence={null} followed={null} decision={null} inspection={(context: ReactNode)=><WatchingOrganism state={state} index={index} followed={null} onFollow={()=>{}} onDetails={()=>{}} context={context}/>}/>);
 const subject=screen.getByRole("region",{name:"Watching organism"});
 const summary=screen.getByLabelText("World activity & species");
 expect(subject.querySelector(".watching-organism-actions")).toContainElement(summary);
 expect(screen.getByLabelText("Configured species counts").closest("details")).toBeNull();
 fireEvent.click(summary);
 expect(summary.closest("details")).toHaveAttribute("open");
 expect(screen.getByRole("region",{name:"Recorded activity"})).toBeVisible();
 expect(JSON.stringify(state)).toBe(before);
});
