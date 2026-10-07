import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INFERENCE_BUDGET } from "./inference-budget";

const config = JSON.parse(readFileSync(new URL("../../../wrangler.jsonc", import.meta.url), "utf8"));

describe("inference budget configuration", () => {
  it("aligns Wrangler limits with canonical gameplay-sized budgets", () => {
    expect(config.ratelimits.find((limit: { name: string }) => limit.name === "JUDGE_RATE_LIMIT")?.simple).toEqual({ limit: INFERENCE_BUDGET.perIp, period: INFERENCE_BUDGET.windowSeconds });
    expect(config.ratelimits.find((limit: { name: string }) => limit.name === "JUDGE_GLOBAL_RATE_LIMIT")?.simple).toEqual({ limit: INFERENCE_BUDGET.global, period: INFERENCE_BUDGET.windowSeconds });
  });
});
