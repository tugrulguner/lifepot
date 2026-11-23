import { expect, it } from "vitest";
import { roleColor } from "./world-presentation";

it("uses role contrast for every configured trophic role without collapsing species identity", () => {
  expect(roleColor("hunter", "A")).not.toBe(roleColor("omnivore", "A"));
  for (const role of ["producer", "grazer", "scavenger", "hunter", "omnivore"]) {
    expect(new Set(["A", "B", "C", "D"].map(id => roleColor(role, id))).size).toBe(4);
  }
  expect(roleColor("unknown", "D")).toBe("#d9a3ff");
});
