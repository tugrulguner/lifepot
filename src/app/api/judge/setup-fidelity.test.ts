import { expect, it, vi } from "vitest";
import { reviewSetupFidelity } from "./setup-fidelity";
import { defaultConfig } from "@/game/setup";

const answers = { world: "A fox hunts a rabbit", threat: "", reward: "coexist" };
it("passes the frozen graph and original answers to the fidelity gate without changing it", async () => {
  const config = defaultConfig();
  const client = { systemOne: vi.fn().mockResolvedValue({ model: "jev-test", usage: { input_tokens: 1, output_tokens: 1 }, answers: { verdict: { type: "choice", choice: "needs_clarification", confidence: 1, probabilities: { approve: 0, reselect: 0, reject: 0, needs_clarification: 1 } } } }) };
  const result = await reviewSetupFidelity(answers, config, client);
  expect(result.verdict).toBe("needs_clarification");
  expect(client.systemOne).toHaveBeenCalledTimes(1);
  expect(client.systemOne.mock.calls[0][0].state).toMatchObject({ original_prose: answers, interpreted_config: config, assembled_graph: config.rules });
  expect(client.systemOne.mock.calls[0][0].state.readable_food_web).toEqual({ species: ["A: grazer", "B: hunter"], relationships: ["B consumes A"] });
  expect(client.systemOne.mock.calls[0][0].questions.verdict.criteria.reject).toContain("Unsupported");
  expect(client.systemOne.mock.calls[0][0].questions.verdict.criteria.reselect).toContain("Correct");
});
it("rejects a verdict that omits alternatives from its probability palette", async () => {
 const client = { systemOne: vi.fn().mockResolvedValue({ model: "jev-test", usage: { input_tokens: 1, output_tokens: 1 }, answers: { verdict: { type: "choice", choice: "approve", confidence: .8, probabilities: { approve: 1 } } } }) };
 await expect(reviewSetupFidelity(answers, defaultConfig(), client)).rejects.toThrow();
});
