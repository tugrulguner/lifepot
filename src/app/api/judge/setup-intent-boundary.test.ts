import { describe, it, expect, vi } from 'vitest';
import { selectSetupIntent } from './setup-intent';
type Request = { questions: Record<string,{criteria:Record<string,string>}> };
function fixture(names: string[]) {
 return { systemOne: vi.fn(async (r:Request) => ({model:'fixture',usage:{input_tokens:1,output_tokens:1}, answers:Object.fromEntries(Object.entries(r.questions).map(([key,q]) => {
  const slot=['A','B','C','D'].indexOf(key.slice(-1));
  const pick=key.startsWith('intent_identity_') ? names[slot] ? Object.keys(q.criteria).find(k=>q.criteria[k]===`${names[slot]} [world]`)! : 'none' : key.startsWith('intent_role_') ? 'grazer' : 'neutral';
  return [key,{type:'choice',choice:pick,confidence:1,probabilities:Object.fromEntries(Object.keys(q.criteria).map(k=>[k,k===pick?1:0]))}];
 }))})) };
}
describe('intent identity boundaries',()=>{
 it('rejects identities in reverse source order',async()=>{
  const client=fixture(['grazers','algae']);
  await expect(selectSetupIntent({world:'algae grazers hunters',threat:'drought',reward:'observe'},client as never)).rejects.toThrow(/order/);
  expect(client.systemOne).toHaveBeenCalledTimes(1);
 });
 it('rejects overlapping spans that count the same mention twice',async()=>{
  const client=fixture(['algae grazers','grazers']);
  await expect(selectSetupIntent({world:'algae grazers hunters',threat:'drought',reward:'observe'},client as never)).rejects.toThrow(/overlap/);
  expect(client.systemOne).toHaveBeenCalledTimes(1);
 });
});
