import Link from "next/link";
import { FamilyHeader } from "@/components/FamilyHeader";
import { guideGroups, guides } from "./content";
import { publicDocuments } from "../project-docs/content";

export const metadata = { title: "Learn · LifePot", description: "Quick start, practical player guides, developer reference and deterministic engine internals." };
export default function LearnIndex() {
  return <main className="learn-shell"><FamilyHeader />
    <div className="learn-toolbar"><Link href="/">← LifePot overview</Link><Link href="/play">Play the game →</Link></div>
    <section className="learn-intro"><p className="learn-kicker">PLAY · UNDERSTAND · BUILD</p><h1>Learn LifePot</h1><p>Start with a first world, investigate its history, then explore the contracts and internals. Jev proposes bounded choices; application validation and deterministic code own what executes. Replay proves reproducibility, not biological validity.</p></section>
    {guideGroups.map(group => <section key={group} className="learn-group" aria-label={group}><h2>{group}</h2><nav className="learn-grid" aria-label={`${group} pages`}>{guides.filter(guide => guide.group === group).map(guide => <article className="learn-card" key={guide.slug}><h3><Link href={`/learn/${guide.slug}`}>{guide.title}</Link></h3><p>{guide.description}</p><Link className="learn-card-link" href={`/learn/${guide.slug}`}>Read guide ↗</Link><Link className="learn-download" href={`/learn/${guide.slug}/markdown`}>Download Markdown ↓</Link></article>)}</nav></section>)}
    <nav className="learn-footer" aria-label="Project source documents">{publicDocuments.map(document => <Link key={document.slug} href={`/project-docs/${document.slug}`}>{document.title} ↗</Link>)}</nav>
    <footer className="learn-footer"><Link href="/">← Return to overview</Link><Link href="/learn/quick-start">Next — Quick start →</Link><Link href="/llms.txt">Agent documentation map</Link></footer>
  </main>;
}
