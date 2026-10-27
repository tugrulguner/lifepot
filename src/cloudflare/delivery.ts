import { demoVideo, legacyDemoVideo, serveDemoVideo, type AssetBinding } from "../lib/demo-video";
export type PublicRoute = { asset: string; headers: Record<string, string>; rsc?: string; segments?: Record<string, string> };
const vary = "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Next-Url";

/** Only explicit build-time public routes bypass Next; API requests stay unchanged. */
export async function servePublicRequest(request: Request, assets: AssetBinding, routes: Record<string, PublicRoute>): Promise<Response | undefined> {
  if (request.method !== "GET" && request.method !== "HEAD") return;
  const path = new URL(request.url).pathname;
  if (path === demoVideo.route || path === legacyDemoVideo.route) return serveDemoVideo(request, assets);
  if (!Object.hasOwn(routes, path)) return;
  const route = routes[path];
  const isRsc = route.rsc !== undefined && request.headers.get("RSC") === "1";
  const segment = request.headers.get("Next-Router-Segment-Prefetch");
  if (isRsc && segment && (!route.segments || !Object.hasOwn(route.segments, segment))) return;
  const asset = isRsc ? (segment ? route.segments?.[segment] : route.rsc) : route.asset;
  if (!asset) return;
  const requestHeaders = new Headers();
  // No private input or query string is forwarded to the static asset binding.
  for (const name of ["If-None-Match", "If-Modified-Since"]) {
    const value = request.headers.get(name);
    if (value) requestHeaders.set(name, value);
  }
  const response = await assets.fetch(new Request(new URL(asset, request.url), { method: request.method, headers: requestHeaders }));
  if (response.status !== 200 && response.status !== 304) {
    await response.body?.cancel();
    return new Response("Page temporarily unavailable.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(route.headers)) headers.set(name, value);
  headers.set("Content-Type", isRsc ? "text/x-component" : (route.headers["content-type"] ?? "text/html; charset=utf-8"));
  headers.set("Cache-Control", route.headers["cache-control"] ?? "public, max-age=0, must-revalidate");
  if (route.rsc) headers.set("Vary", vary);
  return new Response(request.method === "HEAD" || response.status === 304 ? null : response.body, { status: response.status, headers });
}
