import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

test("social destinations and deliberate issue route stay visible, touchable and private", async ({ page }) => {
  for (const width of [1280, 1050, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    for (const path of ["/", "/learn", "/play"]) {
      await page.goto(path);
      if (width <= 1100) await page.getByRole("button", { name: "Menu" }).click();
      await expect(page.locator('.family-header a[href*="linkedin.com"], .family-header a[href*="x.com/"], #family-menu a[href*="linkedin.com"], #family-menu a[href*="x.com/"]')).toHaveCount(0);
      if (path === "/") {
        if (width <= 1100) await page.getByRole("button", { name: "Menu" }).click();
        const credit = page.locator(".overview-hero .creator-row");
        await expect(credit).toContainText("Created by Tugrul Guner");
        const links=credit.locator(".creator-social-links a");
        await expect(links).toHaveText(["GitHub","LinkedIn","X"]);
        const expected=["https://github.com/tugrulguner","https://www.linkedin.com/in/tugrulguner/","https://x.com/Tugrul_Guner"];
        for(let i=0;i<3;i++){
          const link=links.nth(i);await expect(link).toHaveAttribute("href",expected[i]);await expect(link).toHaveCSS("font-size","15px");await expect(link).toHaveCSS("font-weight","400");await expect(link).toHaveAttribute("target","_blank");await expect(link).toHaveAttribute("rel","noopener noreferrer");await expect(link).toHaveAttribute("data-ph-no-autocapture","true");await link.scrollIntoViewIfNeeded();await link.focus();await expect(link).toBeFocused();
        }
        if (width <= 1100) await page.getByRole("button", { name: "Menu" }).click();
      }
      const issue = page.getByRole("link", { name: /Feedback \/ report an issue/ }).last();
      const issueUrl = await issue.getAttribute("href");
      expect(await issue.getAttribute("data-ph-no-autocapture")).toBe("true");
      expect(await issue.getAttribute("rel")).toBe("noopener noreferrer");
      const parsed = new URL(issueUrl!);
      expect(parsed.pathname).toBe("/tugrulguner/lifepot/issues/new");
      expect(parsed.searchParams.get("title")).toBe(`LifePot feedback — ${path}`);
      expect(parsed.searchParams.get("body")).toBe(`LifePot page: ${path}\n\nPlease describe the issue or feedback. Avoid including private questions, replay data, saved-world names, or other personal information.`);
      expect(issueUrl).not.toContain("PRIVATE_SENTINEL");
      expect(issueUrl).not.toMatch(/(?:[?&](?:replay|world|question|identity|output)=)|#[^&]/i);
      const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, body: document.body.scrollWidth, client: document.documentElement.clientWidth, offenders: [...document.querySelectorAll<HTMLElement>(".family-header > *, .family-header-actions > *")].map(node => ({ tag: node.tagName, className: node.className, left: Math.round(node.getBoundingClientRect().left), right: Math.round(node.getBoundingClientRect().right), width: Math.round(node.getBoundingClientRect().width) })) }));
      expect(overflow.width, JSON.stringify(overflow.offenders)).toBeLessThanOrEqual(width);
      if (width <= 1100) await page.getByRole("button", { name: "Menu" }).click();
    }
  }
});

test("overview feedback link is keyboard activatable and screenshot evidence is retained", async ({ page }) => {
  const evidenceDir = process.env.FEEDBACK_EVIDENCE_DIR ?? test.info().outputDir;
  await mkdir(evidenceDir, { recursive: true });
  for (const width of [1280, 1050, 768, 390, 320]) {
    for (const theme of ["light", "dark", "auto"] as const) {
      await page.setViewportSize({ width, height: 850 });
      await page.emulateMedia({ colorScheme: theme === "dark" ? "dark" : "light" });
      await page.goto("/");
      await page.getByLabel("Color theme").selectOption(theme);
      const filename = join(evidenceDir, `lifepot-social-feedback-${theme}-${width}.png`);
      await page.screenshot({ path: filename, fullPage: true });
      if (width <= 768) {
        await page.getByRole("button", { name: "Menu" }).click();
        await page.screenshot({ path: join(evidenceDir, `lifepot-social-feedback-${theme}-${width}-menu.png`), fullPage: true });
      }
    }
  }
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto("/");
  const issue = page.getByRole("link", { name: /Feedback \/ report an issue for \/ / });
  await issue.focus();
  await expect(issue).toBeFocused();
  const opened = page.waitForEvent("popup");
  await page.keyboard.press("Enter");
  const popup = await opened;
  await popup.waitForLoadState();
  const popupUrl = new URL(popup.url());
  const issueDestination = popupUrl.pathname === "/login" ? new URL(popupUrl.searchParams.get("return_to")!) : popupUrl;
  expect(issueDestination.origin + issueDestination.pathname).toBe("https://github.com/tugrulguner/lifepot/issues/new");
  expect(issueDestination.searchParams.get("title")).toBe("LifePot feedback — /");
  await popup.close();
});
