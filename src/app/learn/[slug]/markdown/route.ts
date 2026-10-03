import { guideMarkdown } from "../../content";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const markdown = await guideMarkdown(slug);
  if (!markdown) return new Response("Not found", { status: 404 });
  return new Response(markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}.md"`, "Cache-Control": "public, max-age=3600" } });
}
