import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

// Copy only build-proven immutable public routes. Never snapshot runtime/API data.
const root = resolve(process.argv[2] ?? ".");
const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const buildId = (await readFile(join(root, ".next/BUILD_ID"), "utf8")).trim();
if (!/^[\w-]+$/.test(buildId)) throw new Error("Invalid Next build identifier");
const manifest = await readJson(join(root, ".next/prerender-manifest.json"));
const routes = {};
const headerNames = new Set(["content-type", "content-disposition", "cache-control", "x-source-path", "x-source-revision", "x-nextjs-stale-time", "x-nextjs-prerender"]);
const copy = async relative => {
  // A non-HTML suffix prevents ASSETS from redirecting internal .html requests.
  const asset = `/_lifepot/${buildId}/${relative}.bin`;
  const target = join(root, ".open-next/assets", asset);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(root, ".next/server/app", relative), target);
  return asset;
};
for (const [path, entry] of Object.entries(manifest.routes)) {
  if (entry.initialRevalidateSeconds !== false || path.startsWith("/_") || path.startsWith("/api/") || entry.initialStatus && entry.initialStatus !== 200) continue;
  if (!path.startsWith("/") || path.split("/").includes("..")) throw new Error("Invalid prerendered route");
  const name = path === "/" ? "index" : path.slice(1);
  const meta = await readJson(join(root, `.next/server/app/${name}.meta`));
  const headers = Object.fromEntries(Object.entries(meta.headers ?? {}).filter(([key]) => headerNames.has(key)));
  const route = { asset: await copy(`${name}.${entry.routeType === "route" ? "body" : "html"}`), headers };
  if (entry.dataRoute) {
    route.rsc = await copy(`${name}.rsc`);
    route.segments = {};
    for (const segment of meta.segmentPaths ?? []) {
      if (!segment.startsWith("/") || segment.split("/").includes("..")) throw new Error("Invalid prerendered segment");
      route.segments[segment] = await copy(`${name}.segments${segment}.segment.rsc`);
    }
  }
  routes[path] = route;
}
if (!routes["/"]) throw new Error("Homepage must be prerendered, not request-rendered");
await mkdir(join(root, ".open-next"), { recursive: true });
await writeFile(join(root, ".open-next/delivery-manifest.json"), JSON.stringify(routes));
await writeFile(join(root, ".open-next/delivery-worker.js"), `import { servePublicRequest } from "../src/cloudflare/delivery.ts";
import routes from "./delivery-manifest.json";
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./worker.js";
export default {
  async fetch(request, env, ctx) {
    const response = await servePublicRequest(request, env.ASSETS, routes);
    if (response) return response;
    const { default: next } = await import("./worker.js");
    return next.fetch(request, env, ctx);
  }
};
`);
console.log(`Prepared low-CPU delivery for ${Object.keys(routes).length} immutable routes.`);
