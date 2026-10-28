import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { decodeReplay, playReplay } from "./replay";
it("ships the exact recorded three-role example with reproducible outcomes", async () => {
  const example = JSON.parse(readFileSync("public/example-world.json", "utf8"));
  const replay = decodeReplay(example.replay);
  expect(replay.config.rules?.species.map(s => s.role)).toEqual(["producer", "grazer", "hunter"]);
  const { state } = await playReplay(replay);
  expect(state.generation).toBe(example.endpoint.generation);
  expect(state.stats.population).toBe(example.endpoint.population);
  expect(state.stats.births).toBe(example.endpoint.births);
  expect(state.stats.deaths).toBe(example.endpoint.deaths);
  expect(state.stats.kills).toBe(example.endpoint.kills);
});
