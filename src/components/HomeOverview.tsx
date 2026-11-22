import { CreatorSocialLinks } from "./CreatorSocialLinks";
import { FamilyHeader } from "@/components/FamilyHeader";
import Link from "next/link";
import "./HomeOverview.css";

export function HomeOverview() {
  return <main id="main-content" tabIndex={-1} className="overview-shell">
    <FamilyHeader feedbackPath="/" skipTarget="overview-content" />
    <section id="overview-content" tabIndex={-1} className="overview-hero" aria-labelledby="home-title">
      <div className="overview-copy">
        <p className="overview-kicker">An artificial-life sandbox</p>
        <h1 id="home-title">Shape a world.<br />Watch life unfold.</h1>
        <p>Build an ecosystem, then watch organisms feed, reproduce and change.</p>
        <nav className="overview-actions" aria-label="Explore LifePot">
          <Link className="overview-primary" href="/experiment" prefetch={false}>Play LifePot <span aria-hidden="true">→</span></Link>
          <Link className="overview-secondary" href="/play/example" prefetch={false}>Play example</Link>
        </nav>
        <div className="creator-row"><p className="overview-credit">
          <a href="https://tugrul.modepot.io/">Created by Tugrul Guner</a>
          <span aria-hidden="true">·</span>
          <a href="https://modepot.io/">Part of ModePot</a>
        </p><CreatorSocialLinks /></div>
      </div>
      <div className="overview-brand">
        <img className="overview-lockup" src="/lifepot-lockup.png?v=adaptive-life-1" width="1200" height="900" alt="LifePot — artificial life in a changing world" />
      </div>
    </section>
    <section className="overview-example" aria-labelledby="example-title">
      <div className="example-card">
        <div className="example-media"><img src="/life-example-poster.jpg" width="600" height="600" alt="A recorded LifePot pond world with organisms and vegetation" /></div>
        <div className="example-copy">
          <p className="overview-kicker">Recorded example · exact replay</p>
          <h2 id="example-title">The little pond.</h2>
          <p>Pause, inspect a creature, follow a family.</p>
        </div>
      </div>
    </section>
    <details className="home-disclosure home-reference">
      <summary>How LifePot works &amp; learning resources <span aria-hidden="true">＋</span></summary>
      <section className="overview-mechanism" aria-labelledby="mechanism-title">
        <div>
          <p className="overview-kicker">HOW THE WORLD WORKS</p>
          <h2 id="mechanism-title">Jev shapes conditions. Life unfolds.</h2>
          <p>In adaptive worlds, Jev responds to the ecology with bounded changes to environmental conditions, species strategies and mutation policies—not direct control of individual organisms. LifePot validates those decisions; local simulation rules govern movement, feeding, reproduction and death.</p>
          <p>Fixed-rule starters run without Jev decisions. Replay uses the same starting state and recorded decisions to reproduce what happened, rather than asking Jev to decide again. This is an experiment, not a biological forecast.</p>
          <nav className="overview-links" aria-label="Learning and reference">
            <Link href="/learn/player-guide">Player guide</Link><Link href="/learn/developer-reference">Developer reference</Link><Link href="/learn">All learning guides</Link><Link href="/learn/engine-internals">Engine internals</Link>
          </nav>
        </div>
        <figure><a href="/docs/assets/lifepot-architecture.png"><img src="/docs/assets/lifepot-architecture.png" alt="LifePot architecture: player intent, typed model proposals, validation, deterministic simulation and replay" width="1600" height="900" loading="lazy" /></a><figcaption>Architecture overview · <Link href="/learn/developer-reference">Read the developer reference</Link></figcaption></figure>
      </section>
    </details>
    <footer className="overview-footer">LifePot · <Link className="overview-preset" href="/play" prefetch={false}>Open observatory</Link> · <Link href="/learn">Learn</Link> · <a href="https://github.com/tugrulguner/lifepot">Source on GitHub</a></footer>
  </main>;
}
