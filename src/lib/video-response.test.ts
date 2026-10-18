import { describe, expect, it } from "vitest";
import { videoResponse } from "./video-response";

const bytes = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
const etag = '"test-video"';
const request = (headers: HeadersInit = {}, method = "GET") => new Request("https://example.test/demo.mp4", { headers, method });

describe("bounded demo video byte ranges", () => {
  it("serves a full, cacheable MP4 and a bodyless HEAD", async () => {
    const response = videoResponse(bytes, request(), etag);
    expect(response.status).toBe(200);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-length")).toBe("10");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    const head = videoResponse(bytes, request({ Range: "bytes=1-3" }, "HEAD"), etag);
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe("10");
    expect((await head.arrayBuffer()).byteLength).toBe(0);
  });
  it.each([
    ["bytes=2-4", 2, 4], ["bytes=7-", 7, 9], ["bytes=-3", 7, 9],
    ["bytes=8-100", 8, 9], ["bytes=-100", 0, 9],
  ])("serves %s as a genuine partial response", async (range, start, end) => {
    const response = videoResponse(bytes, request({ Range: range }), etag);
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe(`bytes ${start}-${end}/10`);
    expect(response.headers.get("content-length")).toBe(String(end - start + 1));
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes.slice(start, end + 1));
  });
  it.each(["bytes=10-", "bytes=4-2", "bytes=-0", "bytes=-", "bytes=0-1,4-5", "bytes=999999999999999999999-", "other=0-1"])("rejects invalid/unsupported %s", range => {
    const response = videoResponse(bytes, request({ Range: range }), etag);
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */10");
  });
  it("honors cache validation and only applies a range to the matching representation", async () => {
    expect(videoResponse(bytes, request({ "If-None-Match": etag }), etag).status).toBe(304);
    expect(videoResponse(bytes, request({ "If-None-Match": `"older", ${etag}` }), etag).status).toBe(304);
    expect(videoResponse(bytes, request({ Range: "bytes=1-3", "If-Range": etag }), etag).status).toBe(206);
    const stale = videoResponse(bytes, request({ Range: "bytes=1-3", "If-Range": '"old"' }), etag);
    expect(stale.status).toBe(200);
    expect(new Uint8Array(await stale.arrayBuffer())).toEqual(bytes);
  });
});
