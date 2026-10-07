import { describe, it, expect, vi } from 'vitest';
import { hashSetupRequest } from '@/game/setup';
import { interpretSetup } from './service';
import { validSdkResponse, councilSdkResponse } from './setup-test-fixtures';
const answers = { world: 'A pond with algae, algae-eating grazers, and hunters that eat grazers.', threat: 'Moderate drought', reward: 'Observe coexistence' };
type Request = { state: Record<string, unknown>; questions: Record<string, { criteria: Record<string, unknown> }> };
function selected(request: Request, choices: Record<string,string>) {
 return { model: 'jev-test', usage: { input_tokens: 1, output_tokens: 1 }, answers: Object.fromEntries(Object.entries(request.questions).map(([key,q]) => { const pick = choices[key] ?? Object.keys(q.criteria)[0]; return [key, { type: 'choice', choice: pick, confidence: 1, probabilities: Object.fromEntries(Object.keys(q.criteria).map(id => [id, id===pick ? 1 : 0])) }]; })) };
}
function client(poisonUnusedRole = false, invalidStage?: "initial_council" | "fidelity_review") { return { systemOne: vi.fn(async (request: Request) => {
 const keys = Object.keys(request.questions);
 if (keys.some(k => k.startsWith('intent_identity_'))) {
  const choices: Record<string,string> = {};
  for (const id of ['A','B','C','D']) {
   const name = { A:'algae', B:'grazers', C:'hunters' }[id as 'A'|'B'|'C'];
   choices[`intent_identity_${id}`] = name ? Object.keys(request.questions[`intent_identity_${id}`].criteria).find(k => request.questions[`intent_identity_${id}`].criteria[k] === `${name} [world]`)! : 'none';
  }
  return selected(request, choices);
 }
 if (keys.some(k => k.startsWith('intent_role_'))) return selected(request, { intent_role_A:'producer',intent_role_B:'grazer',intent_role_C:'hunter' });
 if (keys.some(k => k.startsWith('intent_pair_'))) return selected(request, { intent_pair_A_B:'b_consumes_a',intent_pair_A_C:'neutral',intent_pair_B_C:'b_consumes_a' });
 if (keys.includes('abundance')) { const response = validSdkResponse(); if (poisonUnusedRole) response.answers.roleA.probabilities = {}; return response; }
 if (invalidStage === 'fidelity_review' && keys.includes('verdict') || invalidStage === 'initial_council' && !keys.includes('verdict')) return { model: 'fixture', usage: { input_tokens: 1, output_tokens: 1 }, answers: {} };
 if (keys.includes('verdict')) return selected(request, { verdict:'approve' });
 return councilSdkResponse(request as never);
 }) }; }
describe('shared setup food-web contract integration', () => {
 it.each(['initial_council','fidelity_review'] as const)('classifies invalid output at %s without leaking payloads', async stage => {
  const c=client(false,stage);
  const result=await interpretSetup({answers,requestHash:hashSetupRequest(answers)},{apiKey:'test',client:c as never});
  expect(result).toMatchObject({source:'fallback',fallbackReason:'invalid_response',failure:{stage,code:'invalid_response'}});
  expect(Object.keys(result.failure!)).toEqual(['stage','code']);
 });
 it('does not request or validate unused independent initial roles and links', async () => {
  const c=client(true);
  const result=await interpretSetup({answers,requestHash:hashSetupRequest(answers)},{apiKey:'test',client:c as never});
  expect(result.source).toBe('jev');
  expect(result.config.rules?.species.map(s=>s.role)).toEqual(['producer','grazer','hunter']);
  expect(Object.keys(c.systemOne.mock.calls[0][0].questions)).not.toContain('roleA');
 });
 it('assembles the named pond intent rather than accepting an independently approved wrong graph', async () => {
  const c=client(), beforeCall=vi.fn();
  const result=await interpretSetup({answers, requestHash:hashSetupRequest(answers)}, {apiKey:'test',client:c as never,beforeCall});
  expect(result.source).toBe('jev'); expect(result.fidelity?.verdict).toBe('approve');
  expect(result.config.rules?.species.map(s=>s.role)).toEqual(['producer','grazer','hunter']);
  expect(result.config.rules?.interactions).toEqual([{pair:'A:B',mode:'b_consumes_a'},{pair:'A:C',mode:'neutral'},{pair:'B:C',mode:'b_consumes_a'}]);
  expect(beforeCall).toHaveBeenCalledTimes(c.systemOne.mock.calls.length);
  expect(c.systemOne).toHaveBeenCalledTimes(6);
 });
});
