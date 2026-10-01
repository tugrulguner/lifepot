import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("README uses a 600px hero and links to the ModePot family", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const hero = readme.match(/<img\b[^>]+>/)?.[0];
  expect(hero).toContain('width="600"');
  expect(readme.slice(0, 1000)).toContain('Part of <a href="https://modepot.io/">ModePot</a>.');
});
