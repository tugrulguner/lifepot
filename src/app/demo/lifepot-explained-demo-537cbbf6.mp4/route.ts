import { getCloudflareContext } from "@opennextjs/cloudflare";
import { videoResponse, videoResponsePlan } from "@/lib/video-response";
import { demoVideo, serveDemoVideo, unavailableVideo, type AssetBinding } from "@/lib/demo-video";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const plan = videoResponsePlan(demoVideo.size, request, demoVideo.etag);
  if (plan instanceof Response) return plan;
  let assets: AssetBinding | undefined;
  try {
    assets = (getCloudflareContext().env as unknown as { ASSETS?: AssetBinding }).ASSETS;
  } catch { /* Ordinary Next.js development/start has no Cloudflare context. */ }
  if (assets) return serveDemoVideo(request, assets);
  try {
    const { readFile } = await import("node:fs/promises");
    const bytes = await readFile(`${process.cwd()}/public${demoVideo.asset}`);
    if (bytes.byteLength !== demoVideo.size) return unavailableVideo();
    return videoResponse(bytes, request, demoVideo.etag);
  } catch {
    return unavailableVideo();
  }
}
export const HEAD = GET;
