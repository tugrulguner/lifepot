import { expect, it, vi } from "vitest";
import { reviewSetupFidelity } from "./setup-fidelity";
import { defaultConfig } from "@/game/setup";

const answers = { world: "A fox hunts a rabbit", threat: "", reward: "coexist" };
it("rejects mismatched assembled graph based on the original prose", async () => {
  const config = defaultConfig();
  const client = { systemOne: vi.fn().mockResolvedValue({ model: "jev-test", usage: { input_tokens: 1, output_tokens: 1 }, answers: { verdict: { type: "choice", choice: "needs_clarification", confidence: 1, probabilities: { approve: 0, reselect: 0, reject: 0, needs_clarification: 1 } } } }) };
  const result = await reviewSetupFidelity(answers, config.rules!, client);
  expect(result.verdict).toBe("needs_clarification");
  expect(client.systemOne).toHaveBeenCalledTimes(1);
});
