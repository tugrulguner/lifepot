import { expect, test } from "vitest";
import { metadata } from "./layout";

test("publishes the canonical LifePot domain and share metadata", () => {
  expect(metadata.metadataBase?.toString()).toBe("https://lifepot.modepot.io/");
  expect(metadata.alternates?.canonical).toBe("/");
  expect(metadata.openGraph?.url).toBe("https://lifepot.modepot.io");
  expect(metadata.openGraph?.siteName).toBe("LifePot");
  expect(metadata.twitter).toBeDefined();
  expect(metadata.alternates?.types).toEqual({ "text/plain": "/llms.txt" });
  expect(metadata.description?.length).toBeLessThanOrEqual(160);
});

test("describes safe Jev integration and artificial-life limits", () => {
  expect(metadata.description).toContain("Jev proposes typed ecology");
  expect(metadata.description).toContain("LifePot validates it");
});
