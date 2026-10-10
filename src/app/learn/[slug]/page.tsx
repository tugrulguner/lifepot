import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createElement, Fragment } from "react";
import { FamilyHeader } from "@/components/FamilyHeader";
import { guideGroups, guideMarkdown, guides, renderMarkdown } from "../content";
import { projectSourceRevision } from "../../project-docs/generated-content";
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
  const sourceUrl = guide.source === "architecture" ? `https://github.com/tugrulguner/lifepot/blob/${projectSourceRevision}/docs/architecture.md` : undefined;
  const toc = blocks.filter(block => block.kind === "h2");
  const anchor = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
  return <main className="learn-shell"><FamilyHeader /><div className="learn-toolbar"><Link href="/learn">← All guides</Link><Link href="/play">Play the game →</Link><a href={`/learn/${slug}/markdown`}>Download source Markdown ↓</a></div><article className="learn-document"><nav className="learn-docnav" aria-label="Documentation navigation">{guideGroups.map(group => <section key={group}><h2>{group}</h2>{guides.filter(item => item.group === group).map(item => <Link key={item.slug} aria-current={item.slug === slug ? "page" : undefined} href={`/learn/${item.slug}`}>{item.title}</Link>)}</section>)}</nav><div className="learn-prose"><nav className="learn-toc" aria-label="On this page">{toc.map(block => <a key={block.text} href={`#${anchor(block.text)}`}>{block.text}</a>)}</nav>{blocks.map((block, i) => {
    if (block.kind === "code") return <pre key={i} data-language={block.lang}><code>{block.text}</code></pre>;
    if (block.kind === "ul") return <ul key={i}>{(JSON.parse(block.text) as string[]).map((item, j) => <li key={j}>{renderInline(item)}</li>)}</ul>;
    if (block.kind === "table") return <Fragment key={i}>{table(JSON.parse(block.text) as string[])}</Fragment>;
    if (block.kind === "quote") return <blockquote key={i}>{renderInline(block.text, sourceUrl)}</blockquote>;
    const tag = block.kind as "h1" | "h2" | "h3" | "h4" | "p";
    const id = tag.startsWith("h") ? block.text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-") : undefined;
    return createElement(tag, { key: i, id }, renderInline(block.text, sourceUrl));
  })}</div></article><footer className="learn-footer"><Link href="/">← Return to overview</Link><Link href="/learn/quick-start">Next — Quick start →</Link><Link href="/llms.txt">Agent documentation map</Link></footer></main>;
}
