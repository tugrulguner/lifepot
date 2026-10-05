import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test("public README and roadmap render from exact build sources with revision provenance and Markdown downloads", async ({ page, request }) => {
  for (const [slug, sourcePath, heading] of [["readme", "README.md", "Project README"], ["roadmap", "ROADMAP.md", "Roadmap"]]) {
    const canonical = await readFile(resolve(process.cwd(), sourcePath), "utf8");
    const download = await request.get(`/project-docs/${slug}/markdown`);
    expect(download.status()).toBe(200);
    expect(download.headers()["content-type"]).toContain("text/markdown");
    expect(download.headers()["x-source-path"]).toBe(sourcePath);
    expect(download.headers()["x-source-revision"]).toMatch(/^[a-f0-9]{40}$|^[a-f0-9]{7,39}$|^main$/);
    expect(await download.text()).toBe(canonical);

    await page.goto(`/project-docs/${slug}`);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByText(sourcePath, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Download source Markdown" })).toHaveAttribute("href", `/project-docs/${slug}/markdown`);
    await expect(page.getByRole("link", { name: "View exact source on GitHub" })).toHaveAttribute("href", new RegExp(`/blob/[^/]+/${sourcePath.replace(".", "\\.")}$`));
    if (slug === "readme") await expect(page.locator(".learn-prose img").first()).toBeVisible();
  }
});

test("project docs expose the roadmap link and missing roadmap route stays unavailable", async ({ page }) => {
  await page.goto("/learn");
  await expect(page.getByRole("link", { name: "Project README" })).toHaveAttribute("href", "/project-docs/readme");
  await expect(page.getByRole("link", { name: "Roadmap" })).toHaveAttribute("href", "/project-docs/roadmap");
  const missing = await page.request.get("/project-docs/not-a-document/markdown");
  expect(missing.status()).toBe(404);
});