import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createElement } from "react";
import { FamilyHeader } from "@/components/FamilyHeader";
import { renderInline } from "@/app/learn/inline";
import { renderMarkdown } from "@/app/learn/content";
import { publicDocuments } from "../content";

export function generateStaticParams() { return publicDocuments.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = publicDocuments.find((item) => item.slug === slug);
  return doc ? { title: `${doc.title} · LifePot`, alternates: { canonical: `/project-docs/${slug}`, types: { "text/markdown": `/project-docs/${slug}/markdown` } } } : {};
}

export default async function ProjectDocument({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = publicDocuments.find((item) => item.slug === slug);
  if (!doc) notFound();
  const blocks = renderMarkdown(doc.markdown);
  return <main className="learn-shell"><FamilyHeader /><div className="learn-toolbar"><Link href="/learn">← Learn LifePot</Link><a href={`/project-docs/${slug}/markdown`}>Download source Markdown ↓</a></div><article className="learn-document"><p className="learn-kicker">PUBLIC SOURCE DOCUMENT</p><h1>{doc.title}</h1><p>Rendered directly from <a href={doc.sourceUrl}>{doc.sourcePath}</a> at source revision <code>{doc.sourceUrl.split("/").at(-2)}</code>. This page reflects that repository source; roadmap items are proposals, not shipped behavior.</p><div className="learn-prose">{blocks.map((block, i) => {
    if (block.kind === "code") return <pre key={i} data-language={block.lang}><code>{block.text}</code></pre>;
    if (block.kind === "ul") return <ul key={i}>{(JSON.parse(block.text) as string[]).map((item, j) => <li key={j}>{renderInline(item, doc.sourceUrl)}</li>)}</ul>;
    if (block.kind === "table") {
      const rows = (JSON.parse(block.text) as string[]).filter((row) => !row.startsWith("|---"));
      return <div key={i} className="learn-table-wrap"><table><thead><tr>{rows[0]?.split("|").slice(1, -1).map((cell, ci) => <th key={ci}>{renderInline(cell.trim(), doc.sourceUrl)}</th>)}</tr></thead><tbody>{rows.slice(1).map((row, ri) => <tr key={ri}>{row.split("|").slice(1, -1).map((cell, ci) => <td key={ci}>{renderInline(cell.trim(), doc.sourceUrl)}</td>)}</tr>)}</tbody></table></div>;
    }
    if (block.kind === "quote") return <blockquote key={i}>{renderInline(block.text, doc.sourceUrl)}</blockquote>;
    const tag = block.kind as "h1" | "h2" | "h3" | "h4" | "p";
    const id = tag.startsWith("h") ? block.text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-") : undefined;
    return createElement(tag, { key: i, id }, renderInline(block.text, doc.sourceUrl));
  })}</div><p><a href={doc.sourceUrl}>View exact source on GitHub ↗</a></p></article></main>;
}