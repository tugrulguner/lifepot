import Link from "next/link";
import { FamilyHeader } from "@/components/FamilyHeader";
import { ProductWalkthrough } from "@/components/ProductWalkthrough";

export const metadata = {
  title: "LifePot walkthrough · LifePot Learn",
  description: "An optional guided video introduction to LifePot, with chapters and transcript.",
  alternates: { canonical: "/learn/walkthrough" },
};

export default function WalkthroughPage() {
  return <main className="learn-shell">
    <FamilyHeader feedbackPath="/learn" skipTarget="walkthrough-content" />
    <div className="learn-toolbar"><Link href="/learn">← All documentation</Link><Link href="/experiment">Play LifePot →</Link></div>
    <article id="walkthrough-content" tabIndex={-1} className="learn-prose">
      <p className="learn-kicker">OPTIONAL VIDEO GUIDE</p>
      <h1>LifePot product walkthrough</h1>
      <p>This guided introduction is optional documentation. The video loads only when you start playback; chapters and a full transcript are available below.</p>
      <ProductWalkthrough />
    </article>
    <footer className="learn-footer"><Link href="/learn">← LifePot documentation</Link><Link href="/play/example">Explore the recorded example →</Link></footer>
  </main>;
}
