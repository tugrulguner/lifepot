import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("README uses a 600px hero and links to the ModePot family", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const hero = readme.match(/<img\b[^>]+>/)?.[0];
  expect(hero).toContain('width="600"');
  const resource = readme.match(/<p align="center">(Part of [\s\S]*?)<\/p>/)?.[1];
  expect(resource).toContain('Part of <a href="https://modepot.io/">ModePot</a>.');
  expect(resource).toContain('<a href="https://lifepot.modepot.io/">Project website</a>');
  expect(resource).toContain('<a href="https://tugrul.modepot.io/">Created by Tugrul Guner</a>');
  expect(readme.slice(0, 1800)).toContain("Three answers shape your world.");
  expect(readme.slice(0, 1800)).toContain('href="https://lifepot.modepot.io/learn/player-guide"');
  expect(readme.slice(0, 1800)).toContain('href="https://lifepot.modepot.io/learn/developer-reference"');
  expect(readme.slice(0, 1800)).toContain("not a biological forecast");
});
