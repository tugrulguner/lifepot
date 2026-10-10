import {test,expect} from "@playwright/test";
import {defaultConfig} from "../src/game/setup";
test("Jev fidelity mismatch cannot silently seed the wrong food web",async({page})=>{
 await page.route("**/api/judge",async route=>{const input=route.request().postDataJSON();await route.fulfill({json:{config:defaultConfig(),source:"jev",requestHash:input.requestHash,model:"test-jev",fidelity:{verdict:"reselect",model:"test-jev",usage:{input_tokens:10,output_tokens:1}},provenance:{outcome:"needs_clarification",reason:"setup_fidelity"}}});});
 await page.goto("/play");for(const answer of ["Hunters eat grazers","Drought","Let them evolve"]){await page.locator("input").fill(answer);await page.getByRole("button",{name:/Continue|Review ecosystem/}).click();}
 await expect(page.getByText(/Our proposed world still needs review/)).toBeVisible();await expect(page.getByRole("button",{name:/Seed ecosystem/})).toBeDisabled();await expect(page.getByRole("button",{name:"Ask Jev to reinterpret"})).toBeEnabled();
});
