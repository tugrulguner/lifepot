import { expect, it, vi } from "vitest";
import { servePublicRequest } from "./delivery";

it("serves the matching RSC representation for client navigation", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("prepared flight"));
  const response = await servePublicRequest(new Request("https://example.test/?_rsc=cache-key", { headers: { RSC: "1" } }), { fetch }, routes);
  expect(new URL(fetch.mock.calls[0][0].url).pathname).toBe("/_lifepot/site/index.rsc");
  expect(response?.headers.get("content-type")).toBe("text/x-component");
  expect(response?.headers.get("vary")).toContain("RSC");
});
it("preserves Markdown download headers and conditional responses", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 304, headers: { ETag: "build" } }));
  const response = await servePublicRequest(new Request("https://example.test/guide/markdown", { headers: { "If-None-Match": "build" } }), { fetch }, {
    "/guide/markdown": { asset: "/_lifepot/guide.body", headers: { "content-type": "text/markdown", "content-disposition": "attachment; filename=guide.md", "x-source-revision": "revision" } },
  });
  expect(response?.status).toBe(304);
  expect(response?.headers.get("content-type")).toBe("text/markdown");
  expect(response?.headers.get("x-source-revision")).toBe("revision");
  expect(fetch.mock.calls[0][0].headers.get("if-none-match")).toBe("build");
});
it("serves immutable downloads directly even when Next speculatively requests RSC", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("# Prepared guide"));
  const response = await servePublicRequest(new Request("https://example.test/guide/markdown", { headers: { RSC: "1" } }), { fetch }, {
    "/guide/markdown": { asset: "/_lifepot/guide.body", headers: { "content-type": "text/markdown" } },
  });
  expect(response?.headers.get("content-type")).toBe("text/markdown");
  expect(await response?.text()).toBe("# Prepared guide");
});
it("passes API, mutations, unknown routes and unsupported segments to Next", async () => {
  const fetch = vi.fn();
  for (const request of [new Request("https://example.test/api/judge"), new Request("https://example.test/", { method: "POST" }), new Request("https://example.test/missing"), new Request("https://example.test/", { headers: { RSC: "1", "Next-Router-Segment-Prefetch": "__proto__" } })]) {
    expect(await servePublicRequest(request, { fetch }, routes)).toBeUndefined();
  }
  expect(fetch).not.toHaveBeenCalled();
});
const routes = { "/": { asset: "/_lifepot/site/index.html", rsc: "/_lifepot/site/index.rsc", segments: {}, headers: {} } };
it("serves build-time HTML without invoking the Next server or forwarding private input", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("prepared overview"));
  const response = await servePublicRequest(new Request("https://example.test/?replay=private", { headers: { Cookie: "secret", Authorization: "Bearer secret" } }), { fetch }, routes);
  expect(response?.status).toBe(200);
  expect(await response?.text()).toBe("prepared overview");
  const assetRequest = fetch.mock.calls[0][0] as Request;
  expect(assetRequest.url).toBe("https://example.test/_lifepot/site/index.html");
  expect([...assetRequest.headers]).toEqual([]);
  expect(response?.headers.get("content-type")).toBe("text/html; charset=utf-8");
});
