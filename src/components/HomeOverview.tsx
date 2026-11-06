import { CreatorSocialLinks } from "./CreatorSocialLinks";
import { FamilyHeader } from "@/components/FamilyHeader";
import Link from "next/link";
import ExamplePreview from "./ExamplePreview";
import { ProductWalkthrough } from "./ProductWalkthrough";
export function HomeOverview() {
  return <main id="main-content" tabIndex={-1} className="overview-shell">
    <FamilyHeader feedbackPath="/" skipTarget="overview-content" />
    <section id="overview-content" tabIndex={-1} className="overview-hero">
      <div className="overview-copy">
        <p className="overview-kicker">An artificial-life sandbox</p>
        <h1>Shape a world.<br />Watch life unfold.</h1>
        <p>Shape an ecosystem. Watch organisms feed, reproduce and change as life unfolds.</p>
        <nav className="overview-actions" aria-label="Explore LifePot">
          <Link className="overview-primary" href="/play" prefetch={false}>Create your own world <span aria-hidden="true">→</span></Link>
          <Link className="overview-secondary" href="/learn">Documentation</Link>
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
        <div className="example-media"><ExamplePreview /></div>
        <div className="example-copy">
          <p className="overview-kicker">Recorded example · exact replay</p>
          <h2 id="example-title">The little pond.</h2>
          <p>Pause, inspect a creature, follow a family.</p>
          <Link className="overview-secondary example-action" href="/play#example" prefetch={false}>Explore this example <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </section>
    <ProductWalkthrough />
    <section className="overview-mechanism" aria-labelledby="mechanism-title"><div><p className="overview-kicker">HOW THE WORLD WORKS</p><h2 id="mechanism-title">Jev shapes conditions. Life unfolds.</h2><p>In adaptive worlds, Jev responds to the ecology with bounded changes to environmental conditions, species strategies and mutation policies—not direct control of individual organisms. LifePot validates those decisions; local simulation rules govern movement, feeding, reproduction and death.</p><p>Fixed-rule starters run without Jev decisions. Replay uses the same starting state and recorded decisions to reproduce what happened, rather than asking Jev to decide again. This is an experiment, not a biological forecast.</p><nav className="overview-links" aria-label="Learning and reference"><Link href="/learn/player-guide">Player guide</Link><Link href="/learn/developer-reference">Developer reference</Link><Link href="/learn">All learning guides</Link><Link href="/learn/engine-internals">Engine internals</Link></nav></div><figure><a href="/docs/assets/lifepot-architecture.png"><img src="/docs/assets/lifepot-architecture.png" alt="LifePot architecture: player intent, typed model proposals, validation, deterministic simulation and replay" width="1600" height="900" loading="lazy" /></a><figcaption>Architecture overview · <Link href="/learn/developer-reference">Read the developer reference</Link></figcaption></figure></section><section className="overview-more"><h2>Play, observe, compare.</h2><p>Inspect organisms and decisions, adjust supported conditions, then compare a new trial with a recorded replay. The guides explain the player flow, practical experiments, API boundaries and engine internals.</p><Link className="overview-primary" href="/learn">Explore the guides →</Link></section><footer className="overview-footer">LifePot · <Link href="/learn">Learn</Link> · <a href="https://github.com/tugrulguner/lifepot">Source on GitHub</a></footer></main>;
}
