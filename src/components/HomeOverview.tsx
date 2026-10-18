import { FamilyHeader } from "@/components/FamilyHeader";
import Link from "next/link";
import ExamplePreview from "./ExamplePreview";
import productDemo from "@/data/product-demo.json";
export function HomeOverview() {
  return <main className="overview-shell">
    <FamilyHeader />
    <section className="overview-hero">
      <div className="overview-copy">
        <p className="overview-kicker">A replayable artificial-life playground</p>
        <h1>Shape a world.<br />Watch life unfold.</h1>
        <p>Describe a small ecosystem. Watch it feed, reproduce and change, then replay what happened.</p>
        <nav className="overview-actions" aria-label="Explore LifePot">
          <Link className="overview-primary" href="/play" prefetch={false}>Create your own world <span aria-hidden="true">→</span></Link>
          <Link className="overview-secondary" href="/learn">Documentation</Link>
        </nav>
        <p className="overview-credit">
          <a href="https://tugrul.modepot.io/">Created by Tugrul Guner</a>
          <span aria-hidden="true">·</span>
          <a href="https://modepot.io/">Part of ModePot</a>
        </p>
      </div>
      <div className="overview-brand">
        <img className="overview-lockup" src="/lifepot-lockup.png?v=wordmark-accent-1" width="1200" height="900" alt="LifePot — deterministic artificial life with replayable evolution" />
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
    <section className="overview-demo" id="watch-demo" aria-labelledby="demo-title">
      <p className="overview-kicker">The guided walkthrough</p>
      <h2 id="demo-title">Watch how it works</h2>
      <p id="demo-description">Create a food web, inspect a creature, follow a family, then change the conditions and compare what happens.</p>
      <p className="demo-meta" id="demo-format">Silent · on-screen explanations · 2 min 48 sec</p>
      <video aria-label="LifePot explained product demo" aria-describedby="demo-description demo-format" controls playsInline preload="none" width="1920" height="1080" poster="/media/lifepot-explained-demo-537cbbf6.jpg">
        <source src="/demo/lifepot-explained-demo-537cbbf6.mp4" type="video/mp4" />
        <track kind="captions" src="/media/lifepot-explained-demo-537cbbf6.vtt" srcLang="en" label="English on-screen text" />
        <a href="/demo/lifepot-explained-demo-537cbbf6.mp4">Open the LifePot demo video</a>
      </video>
      <p className="demo-meta">Use fullscreen for the close-ups. <a href="/demo/lifepot-explained-demo-537cbbf6.mp4">Open video separately</a></p>
      <details className="demo-transcript">
        <summary>Read the demo transcript</summary>
        <ol>{productDemo.map((scene, index) => <li key={index}>
          <h3><span>{scene.time}</span> {scene.title}</h3>
          <p>{scene.caption}</p>
          <ul>{scene.notes.map(note => <li key={note}>{note}</li>)}</ul>
          <p>{scene.hint}</p>
        </li>)}</ol>
      </details>
    </section>
    <section className="overview-mechanism" aria-labelledby="mechanism-title"><div><p className="overview-kicker">HOW THE WORLD WORKS</p><h2 id="mechanism-title">Model proposes. Code decides.</h2><p>Jev interprets a setup and may propose bounded interventions. LifePot checks those typed rules; the simulation engine owns movement, feeding, reproduction, mutation and death. A recorded decision ledger makes a world replayable—not a biological forecast.</p><nav className="overview-links" aria-label="Learning and reference"><Link href="/learn/player-guide">Player guide</Link><Link href="/learn/developer-reference">Developer reference</Link><Link href="/learn">All learning guides</Link><Link href="/learn/engine-internals">Engine internals</Link></nav></div><figure><a href="/docs/assets/lifepot-architecture.png"><img src="/docs/assets/lifepot-architecture.png" alt="LifePot architecture: player intent, typed model proposals, validation, deterministic simulation and replay" /></a><figcaption>Architecture overview · <Link href="/learn/developer-reference">Read the developer reference</Link></figcaption></figure></section><section className="overview-more"><h2>Play, observe, compare.</h2><p>Inspect organisms and decisions, adjust supported conditions, then compare a new trial with a recorded replay. The guides explain the player flow, practical experiments, API boundaries and engine internals.</p><Link className="overview-primary" href="/learn">Explore the guides →</Link></section><footer className="overview-footer">LifePot · <Link href="/learn">Learn</Link> · <a href="https://github.com/tugrulguner/lifepot">Source on GitHub</a></footer></main>;
}
