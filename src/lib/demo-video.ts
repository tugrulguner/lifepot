import { videoResponsePlan } from "./video-response";

export const demoVideo = {
  route: "/demo/lifepot-explained-demo-537cbbf6.mp4",
  asset: "/media/lifepot-explained-demo-537cbbf6.mp4",
  size: 5_202_349,
  etag: '"537cbbf6a4bfbf5ee775fe4b3f693488ffcca6d2b075d319f7580f9db57782f9"',
} as const;
export type AssetBinding = { fetch(request: Request): Promise<Response> };
export function unavailableVideo() {
  return new Response("Demo video temporarily unavailable.", { status: 503, headers: { "Cache-Control": "no-store" } });
}

/** Keep memory bounded to asset-stream chunks, including for chapter seeks. */
function rangeStream(body: ReadableStream<Uint8Array>, start: number, end: number) {
  const reader = body.getReader();
  let position = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) throw new Error("Incomplete demo asset");
          const offset = position;
          position += value.byteLength;
          if (position <= start) continue;
          const chunk = value.subarray(Math.max(0, start - offset), Math.min(value.byteLength, end + 1 - offset));
          controller.enqueue(chunk);
          if (position > end) {
            controller.close();
            await reader.cancel();
          }
          return;
        }
      } catch (error) {
        controller.error(error);
        await reader.cancel().catch(() => {});
      }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
}

/** This path also runs ahead of Next.js in the production Worker. */
export async function serveDemoVideo(request: Request, assets: AssetBinding) {
  const plan = videoResponsePlan(demoVideo.size, request, demoVideo.etag);
  if (plan instanceof Response) return plan;
  try {
    // Deliberately do not forward visitor cookies, authorization or ranges.
    const asset = await assets.fetch(new Request(new URL(demoVideo.asset, request.url)));
    const length = asset.headers.get("Content-Length");
    if (asset.status !== 200 || (length !== null && Number(length) !== demoVideo.size) || !asset.body) {
      await asset.body?.cancel();
      return unavailableVideo();
    }
    return new Response(rangeStream(asset.body, plan.start, plan.end), {
      status: plan.status, headers: plan.headers,
    });
  } catch {
    return unavailableVideo();
  }
}
