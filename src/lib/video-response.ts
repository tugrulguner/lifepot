/** Resolve metadata before opening the pinned video asset. */
export function videoResponsePlan(size: number, request: Request, etag: string): Response | { start: number; end: number; status: number; headers: Headers } {
  const headers = new Headers({
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "ETag": etag,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  const matches = request.headers.get("if-none-match")?.split(",").map(value => value.trim());
  if (matches?.includes(etag) || matches?.includes("*")) return new Response(null, { status: 304, headers });
  if (request.method === "HEAD") {
    headers.set("Content-Length", String(size));
    return new Response(null, { headers });
  }
  const range = request.headers.get("range");
  const ifRange = request.headers.get("if-range");
  if (range && (!ifRange || ifRange === etag)) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    let start = NaN, end = NaN;
    if (match && (match[1] || match[2])) {
      if (!match[1]) {
        const suffix = Number(match[2]);
        if (Number.isSafeInteger(suffix) && suffix > 0) { start = Math.max(0, size - suffix); end = size - 1; }
      } else {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : size - 1;
      }
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    end = Math.min(end, size - 1);
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return { start, end, status: 206, headers };
  }
  headers.set("Content-Length", String(size));
  return { start: 0, end: size - 1, status: 200, headers };
}

/** In-memory development fallback; the Worker uses the streaming asset path. */
export function videoResponse(bytes: Uint8Array, request: Request, etag: string): Response {
  const plan = videoResponsePlan(bytes.byteLength, request, etag);
  if (plan instanceof Response) return plan;
  return new Response(Uint8Array.from(bytes.subarray(plan.start, plan.end + 1)), { status: plan.status, headers: plan.headers });
}
