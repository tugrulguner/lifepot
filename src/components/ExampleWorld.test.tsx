import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeOverview } from "./HomeOverview";

describe("homepage recorded example", () => {
  it("offers a labelled, explicit example replay beside the lightweight video preview", () => {
    const html = renderToStaticMarkup(<HomeOverview />);
    expect(html).toContain("Recorded example · exact replay");
    expect(html).toContain('href="/play#example"');
    expect(html).toContain('poster="/life-example-poster.jpg"');
    expect(html).toContain('data-example-video');
    expect(html).toContain("Explore this example");
    expect(html).toContain("Create your own world");
  });
});
