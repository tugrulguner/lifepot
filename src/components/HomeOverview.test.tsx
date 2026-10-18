// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { HomeOverview } from "./HomeOverview";
function overview() { const root = document.createElement("div"); root.innerHTML = renderToStaticMarkup(<HomeOverview />); return root; }
it("keeps canonical artwork in the family hero and creator/family attribution immediately after aligned actions", () => {
  const root = overview();
  expect(root.querySelector('.overview-hero img[src="/lifepot-lockup.png?v=wordmark-accent-1"]')).not.toBeNull();
  const actions = root.querySelector(".overview-actions")!;
  expect(actions.querySelector('.overview-primary[href="/play"]')).not.toBeNull();
  expect(actions.querySelector('.overview-secondary[href="/learn"]')).not.toBeNull();
  const credit = actions.nextElementSibling!;
  expect(credit.classList.contains("creator-row")).toBe(true);
  expect(credit.querySelector(".overview-credit")).not.toBeNull();
  expect(Array.from(credit.querySelectorAll(".creator-social-links a")).map(a=>a.textContent)).toEqual(["GitHub","LinkedIn","X"]);
  expect(root.querySelector('.family-header a[href*="linkedin.com"], .family-header a[href*="x.com/"]')).toBeNull();
  expect(credit.querySelector('a[href="https://tugrul.modepot.io/"]')?.textContent).toContain("Tugrul Guner");
  expect(credit.querySelector('a[href="https://modepot.io/"]')?.textContent).toContain("ModePot");
});
it("separates the recorded preview from the hero without a competing filled primary action", () => {
  const root = overview(), card = root.querySelector(".example-card")!;
  expect(card.closest(".overview-hero")).toBeNull();
  expect(card.querySelector(".example-media video[data-example-video]")).not.toBeNull();
  expect(card.querySelector('.example-copy a.overview-secondary[href="/play#example"]')).not.toBeNull();
  expect(card.querySelectorAll(".overview-primary")).toHaveLength(0);
  expect(card.textContent).toContain("Recorded example · exact replay");
});
