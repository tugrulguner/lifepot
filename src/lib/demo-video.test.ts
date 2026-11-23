import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { demoVideo } from "./demo-video";
it("publishes the smaller immutable video with metadata matching its actual bytes", async () => {
  expect(demoVideo.route).toBe("/demo/lifepot-explained-demo-8e6e10b2.mp4");
  const bytes=await readFile(`public${demoVideo.asset}`);
  expect(bytes.length).toBe(2125192);
  expect(demoVideo.size).toBe(bytes.length);
  expect(demoVideo.etag).toBe(`"${createHash("sha256").update(bytes).digest("hex")}"`);
});
