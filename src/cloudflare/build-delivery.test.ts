import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, expect, it } from "vitest";
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
it("publishes only immutable build outputs, preserving HTML, RSC, segment and download bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "lifepot-delivery-")); roots.push(root);
  const put = async (path: string, text: string) => { const full = join(root, path); await mkdir(join(full, ".."), { recursive: true }); await writeFile(full, text); };
  await put(".next/BUILD_ID", "test-build");
  await put(".next/prerender-manifest.json", JSON.stringify({ routes: {
    "/": { initialRevalidateSeconds: false, routeType: "page", dataRoute: "/index.rsc" },
    "/guide/markdown": { initialRevalidateSeconds: false, routeType: "route", dataRoute: null },
    "/changing": { initialRevalidateSeconds: 60, routeType: "page" },
  } }));
  await put(".next/server/app/index.html", "<main>Prepared overview</main>");
  await put(".next/server/app/index.rsc", "prepared flight");
  await put(".next/server/app/index.meta", JSON.stringify({ headers: {}, segmentPaths: ["/_tree"] }));
  await put(".next/server/app/index.segments/_tree.segment.rsc", "prepared tree");
  await put(".next/server/app/guide/markdown.body", "# Original guide");
  await put(".next/server/app/guide/markdown.meta", JSON.stringify({ headers: { "content-type": "text/markdown", "x-source-revision": "source-sha", "x-next-cache-tags": "internal" } }));
  execFileSync(process.execPath, ["scripts/prepare-worker-delivery.mjs", root]);
  const manifest = JSON.parse(await readFile(join(root, ".open-next/delivery-manifest.json"), "utf8"));
  expect(Object.keys(manifest).sort()).toEqual(["/", "/guide/markdown"]);
  for (const [asset, expected] of [[manifest["/"].asset, "<main>Prepared overview</main>"], [manifest["/"].rsc, "prepared flight"], [manifest["/"].segments["/_tree"], "prepared tree"], [manifest["/guide/markdown"].asset, "# Original guide"]]) {
    expect(await readFile(join(root, ".open-next/assets", asset), "utf8")).toBe(expected);
  }
  expect(manifest["/guide/markdown"].headers).toEqual({ "content-type": "text/markdown", "x-source-revision": "source-sha" });
  const entry = await readFile(join(root, ".open-next/delivery-worker.js"), "utf8");
  expect(entry).toContain("servePublicRequest");
  expect(entry).toContain('import("./worker.js")');
});
