import { getCloudflareContext } from "@opennextjs/cloudflare";
import { videoResponse } from "@/lib/video-response";

const assetPath = "/media/lifepot-explained-demo-537cbbf6.mp4";
const size = 5_202_349;
const etag = '"537cbbf6a4bfbf5ee775fe4b3f693488ffcca6d2b075d319f7580f9db57782f9"';
export const dynamic = "force-dynamic";

// Workers static assets ignore Range; serve only this pinned public file with
// real partial responses. Never accept a visitor-supplied asset path or URL.
export async function GET(request: Request) {
  try {
    let bytes: Uint8Array;
    let assets: { fetch(request: Request): Promise<Response> } | undefined;
    try {
      assets = (getCloudflareContext().env as unknown as { ASSETS?: typeof assets }).ASSETS;
    } catch { /* Ordinary Next.js development/start has no Cloudflare context. */ }
    if (assets) {
      // A new request deliberately excludes visitor cookies, auth and ranges.
      const response = await assets.fetch(new Request(new URL(assetPath, request.url)));
      if (!response.ok) throw new Error("Missing demo asset");
      bytes = new Uint8Array(await response.arrayBuffer());
    } else {
      const { readFile } = await import("node:fs/promises");
      bytes = await readFile(`${process.cwd()}/public${assetPath}`);
    }
    if (bytes.byteLength !== size) throw new Error("Invalid demo asset size");
    return videoResponse(bytes, request, etag);
  } catch {
    return new Response("Demo video temporarily unavailable.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
export const HEAD = GET;
