import {test,expect} from "@playwright/test";
test("completed run offers Jev-selected evidence and a reviewable next experiment without sending private prediction",async({page})=>{
 test.setTimeout(240000);
 const privateText="PRIVATE prediction must stay local";let calls=0;
 await page.route("**/api/reflect",async route=>{calls++;const payload=route.request().postDataJSON();expect(JSON.stringify(payload)).not.toContain(privateText);await route.fulfill({json:{observations:[{text:"Recorded population warrants a resource comparison",evidenceRefs:["population"]}],nextExperiment:{title:"Try scarce resources",rationale:"Compare the same species under another abundance",evidenceRefs:["population"],changes:[{path:"environment.abundance",value:"scarce"}]},caveat:"Adaptive policies can differ"}});});
 await page.goto("/");await page.getByRole("button",{name:"Explore deterministic preset"}).click();await page.getByLabel("World policy").selectOption("fixed");await page.getByLabel("Your question or prediction (optional)").fill(privateText);await page.getByRole("button",{name:/Seed ecosystem/}).click();await page.getByRole("button",{name:"3× speed"}).click();
 await expect(page.getByRole("region",{name:"Run results"})).toBeVisible({timeout:180000});expect(calls).toBe(0);
 await page.getByRole("button",{name:"Ask Jev about this run"}).click();await expect(page.getByText("Try scarce resources")).toBeVisible();await page.getByRole("button",{name:"Review suggested experiment"}).click();
 await page.getByText("Edit world conditions",{exact:true}).click();await expect(page.getByLabel("Resource abundance")).toHaveValue("scarce");await expect(page.getByText(/previous run.*baseline/i)).toBeVisible();
});
