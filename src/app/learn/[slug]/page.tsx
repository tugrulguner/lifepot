import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createElement, Fragment } from "react";
import { guideMarkdown, guides, renderMarkdown } from "../content";
import { renderInline } from "../inline";

export async function generateStaticParams() { return guides.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const guide = guides.find((item) => item.slug === slug);
  return guide ? { title: `${guide.title} · LifePot Learn`, description: guide.description, alternates: { canonical: `/learn/${slug}`, types: { "text/markdown": `/learn/${slug}/markdown` } } } : {};
}
function table(rows: string[]) {
  const cells = rows.filter((row) => !/^\|\s*:?-{2,}/.test(row)).map((row) => row.split("|").slice(1, -1).map((cell) => cell.trim()));
  const [head, ...body] = cells;
  return <div className="learn-table-wrap"><table><thead><tr>{head.map((cell, i) => <th key={i}>{renderInline(cell)}</th>)}</tr></thead><tbody>{body.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{renderInline(cell)}</td>)}</tr>)}</tbody></table></div>;
}
export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const markdown = await guideMarkdown(slug); const guide = guides.find((item) => item.slug === slug);
  if (!markdown || !guide) notFound();
  const blocks = renderMarkdown(markdown);
  return <main className="learn-shell"><header className="learn-head"><Link href="/" className="learn-brand">LifePot</Link><a className="learn-family" href="https://modepot.io/">ModePot ↗</a><span>FIELD NOTES / DOCUMENTATION</span></header><div className="learn-toolbar"><Link href="/learn">← All guides</Link><a href={`/learn/${slug}/markdown`}>Download source Markdown ↓</a></div><article className="learn-document"><nav className="learn-docnav"><Link href="/learn/player-guide">Player guide</Link><Link href="/learn/developer-reference">Developer reference</Link></nav><div className="learn-prose">{blocks.map((block, i) => {
    if (block.kind === "code") return <pre key={i} data-language={block.lang}><code>{block.text}</code></pre>;
    if (block.kind === "ul") return <ul key={i}>{(JSON.parse(block.text) as string[]).map((item, j) => <li key={j}>{renderInline(item)}</li>)}</ul>;
    if (block.kind === "table") return <Fragment key={i}>{table(JSON.parse(block.text) as string[])}</Fragment>;
    if (block.kind === "quote") return <blockquote key={i}>{renderInline(block.text)}</blockquote>;
    const tag = block.kind as "h1" | "h2" | "h3" | "h4" | "p";
    const id = tag.startsWith("h") ? block.text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-") : undefined;
    return createElement(tag, { key: i, id }, renderInline(block.text));
  })}</div></article><footer className="learn-footer"><Link href="/">← Return to the living world</Link><Link href="/llms.txt">Agent documentation map</Link></footer></main>;
}
