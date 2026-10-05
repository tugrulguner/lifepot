import { publicDocuments } from "../../content";

export function generateStaticParams() { return publicDocuments.map(({ slug }) => ({ slug })); }

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const document = publicDocuments.find((item) => item.slug === slug);
  if (!document) return new Response("Not found", { status: 404 });
  return new Response(document.markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${document.sourcePath}"`, "Cache-Control": "public, max-age=3600", "X-Source-Revision": document.sourceUrl.split("/").at(-2) ?? "main", "X-Source-Path": document.sourcePath } });
}