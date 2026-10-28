import { expect, test } from "@playwright/test";
test("landing preview actually plays and stays paused after deliberate pause", async ({ page }) => {
 const errors: string[]=[];page.on("pageerror", e=>errors.push(e.message));
 await page.goto("/");
 const video=page.locator("video[data-example-video]");
 await video.scrollIntoViewIfNeeded();
 await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>!v.paused && v.currentTime>0)).toBe(true);
 await page.getByRole("button",{name:"Pause preview",exact:true}).click();
 const time=await video.evaluate((v:HTMLVideoElement)=>v.currentTime);
 await page.locator("footer").scrollIntoViewIfNeeded();await video.scrollIntoViewIfNeeded();
 expect(await video.evaluate((v:HTMLVideoElement)=>v.paused)).toBe(true);
 expect(await video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBe(time);
 expect(errors).toEqual([]);
});
test("reduced motion and data saver do not download video or game until requested", async ({ page })=>{
 await page.emulateMedia({reducedMotion:"reduce"});
 await page.addInitScript(()=>Object.defineProperty(navigator,"connection",{value:{saveData:true,addEventListener(){},removeEventListener(){}}}));
 const requests:string[]=[];page.on("request",r=>requests.push(r.url()));
 await page.goto("/");
 await expect(page.locator("video[data-example-video]")).not.toHaveAttribute("src");
 expect(requests.some(url=>url.includes("life-example.mp4")||url.includes("example-world.json"))).toBe(false);
 await page.getByRole("button",{name:"Play preview",exact:true}).click();
 await expect.poll(()=>page.locator("video[data-example-video]").evaluate((v:HTMLVideoElement)=>!v.paused&&v.currentTime>0)).toBe(true);
 await page.getByRole("link",{name:/Explore this example/}).click();
 await expect(page.locator("canvas.life-canvas")).toBeVisible();
});
