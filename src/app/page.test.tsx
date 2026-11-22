import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeOverview } from "@/components/HomeOverview";

describe("product overview", () => {
  it("puts the game journey, mechanism, canonical illustration and learning paths on the home page", () => {
    const html = renderToStaticMarkup(<HomeOverview />);
    expect(html).toContain('href="/experiment"');
    expect(html).toContain("Play LifePot");
    expect(html).toContain('href="/play/example"');
    expect(html).toContain("Play example");
    expect(html).not.toContain("<video");
    expect(html).not.toContain(".mp4");
    expect(html).toContain('href="/learn/player-guide"');
    expect(html).toContain('href="https://github.com/tugrulguner/lifepot"');
    expect(html).toContain('src="/docs/assets/lifepot-architecture.png"');
    expect(html).toContain('href="/learn/developer-reference"');
  });
});
