import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
const binding = vi.hoisted(() => ({ fetch: vi.fn(), context: vi.fn() }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: binding.context }));
import { GET, HEAD } from "./route";

const file = "public/media/lifepot-explained-demo-537cbbf6.mp4";
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
describe("pinned demo video route", () => {
  it("serves exact asset bytes through Cloudflare without forwarding visitor headers", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const video = await readFile(file);
    binding.context.mockReturnValue({ env: { ASSETS: { fetch: binding.fetch } } });
    binding.fetch.mockResolvedValue(new Response(video));
    const response = await GET(new Request("https://lifepot.example/demo/lifepot-explained-demo-537cbbf6.mp4", { headers: { Range: "bytes=0-1023", Cookie: "private=sentinel", Authorization: "Bearer sentinel" } }));
    expect(response.status).toBe(206);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(video.subarray(0, 1024)));
    const [assetRequest] = binding.fetch.mock.calls[0] as [Request];
    expect(new URL(assetRequest.url).pathname).toBe("/media/lifepot-explained-demo-537cbbf6.mp4");
    expect([...assetRequest.headers]).toEqual([]);
  });
  it("supports HEAD with the genuine file size", async () => {
    const response = await HEAD(new Request("http://localhost/demo/lifepot-explained-demo-537cbbf6.mp4", { method: "HEAD" }));
    expect(response.headers.get("content-length")).toBe("5202349");
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });
  it.each([404, 200])("fails closed for unavailable or truncated assets (%s)", async status => {
    vi.stubEnv("NODE_ENV", "production");
    binding.context.mockReturnValue({ env: { ASSETS: { fetch: binding.fetch } } });
    binding.fetch.mockResolvedValue(new Response("truncated", { status }));
    const response = await GET(new Request("https://example.test/demo/lifepot-explained-demo-537cbbf6.mp4"));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("Demo video temporarily unavailable.");
  });
});
