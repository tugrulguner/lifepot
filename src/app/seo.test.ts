import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { metadata } from "./layout";
import { generateMetadata as guideMetadata } from "./learn/[slug]/page";
import { generateMetadata as docsMetadata } from "./project-docs/[slug]/page";

test("publishes the canonical LifePot domain and share metadata", () => {
  expect(metadata.metadataBase?.toString()).toBe("https://lifepot.modepot.io/");
  expect(metadata.alternates?.canonical).toBe("/");
  expect(metadata.openGraph?.url).toBe("https://lifepot.modepot.io");
  expect(metadata.openGraph?.siteName).toBe("LifePot");
  expect(JSON.stringify(metadata.openGraph?.images)).toContain("/lifepot-lockup.png");
  expect(JSON.stringify(metadata.openGraph?.images)).not.toContain("lifepot-social.png");
  expect(JSON.stringify(metadata.twitter)).toContain("/lifepot-lockup.png");
  expect(metadata.twitter).toBeDefined();
  expect(metadata.alternates?.types).toEqual({ "text/plain": "/llms.txt" });
  expect(metadata.description?.length).toBeLessThanOrEqual(160);
});

test("uses HTML routes as canonical and keeps Markdown as an alternate representation", async () => {
  expect((await guideMetadata({ params: Promise.resolve({ slug: "quick-start" }) })).alternates).toEqual({ canonical: "/learn/quick-start", types: { "text/markdown": "/learn/quick-start/markdown" } });
  expect((await docsMetadata({ params: Promise.resolve({ slug: "readme" }) })).alternates).toEqual({ canonical: "/project-docs/readme", types: { "text/markdown": "/project-docs/readme/markdown" } });
});
test("describes safe Jev integration and artificial-life limits", () => {
  expect(metadata.description).toContain("Jev proposes typed ecology");
  expect(metadata.description).toContain("LifePot validates it");
});

test("states the supported interface boundary accurately for agents", () => {
  const llms = readFileSync(new URL("../../public/llms.txt", import.meta.url), "utf8");
  expect(llms).toContain("no installable package or supported public API");
  expect(llms).toContain("`/api/judge` is an internal application endpoint");
});
