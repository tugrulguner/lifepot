// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
