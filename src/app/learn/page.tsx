import Link from "next/link";
import { guides } from "./content";

export const metadata = { title: "Learn · LifePot", description: "Player guides and developer references for LifePot." };

export default function LearnIndex() {
  return <main className="learn-shell"><header className="learn-head"><Link href="/" className="learn-brand">LifePot</Link><a className="learn-family" href="https://modepot.io/">ModePot ↗</a><span>FIELD NOTES / DOCUMENTATION</span></header><section className="learn-intro"><p className="learn-kicker">PLAY · UNDERSTAND · BUILD</p><h1>Learn LifePot</h1><p>Two paths into the same bounded, replayable artificial-life game. Read online or download the authoritative Markdown.</p></section><nav className="learn-grid" aria-label="Guides">{guides.map((guide) => <article className="learn-card" key={guide.slug}><span className="learn-kicker">GUIDE / {guide.slug === "player-guide" ? "01" : "02"}</span><h2><Link href={`/learn/${guide.slug}`}>{guide.title}</Link></h2><p>{guide.description}</p><Link className="learn-card-link" href={`/learn/${guide.slug}`}>Read guide <span aria-hidden="true">↗</span></Link><Link className="learn-download" href={`/learn/${guide.slug}/markdown`}>Download Markdown ↓</Link></article>)}</nav><footer className="learn-footer"><Link href="/">← Return to the living world</Link><Link href="/llms.txt">Agent documentation map</Link></footer></main>;
}
