import { describe, expect, it } from "vitest";
import { documentsFromSources } from "./content";

describe("source-backed project documents", () => {
  it("exposes a roadmap only when the source file exists", () => {
    const sources = { "README.md": "# Project" };
    expect(documentsFromSources(sources).map(({ slug }) => slug)).toEqual(["readme"]);
    expect(documentsFromSources({ ...sources, "ROADMAP.md": "# Roadmap" }).map(({ slug }) => slug)).toEqual(["readme", "roadmap"]);
  });
});
