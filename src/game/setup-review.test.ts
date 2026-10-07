import { describe, it, expect } from 'vitest';
import { setupFidelitySchema } from './setup-review';
describe('safe setup failure transport', () => {
 it('preserves correction failure stage without accepting arbitrary diagnostics', () => {
  const input = { verdict: 'reselect', model: 'jev-test', usage: { input_tokens: 1, output_tokens: 1 }, repairFailure: 'invalid_response', failure: { stage: 'repair_council', code: 'invalid_response' } };
  expect(setupFidelitySchema.parse(input)).toMatchObject({ failure: input.failure });
  expect(setupFidelitySchema.safeParse({ ...input, failure: { ...input.failure, raw: 'private payload' } }).success).toBe(false);
 });
});
