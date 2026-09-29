import { describe, expect, it } from "vitest";
import { councilRegistry, validateCouncilManifest } from "./council";
import { defaultRuleGraph } from "./rules";
describe("dynamic council authority",()=>{
 it("binds registry responsibilities to exact scopes and rejects invented authority",()=>{
 const rules=defaultRuleGraph(), registry=councilRegistry(rules);
 const members=registry.slice(0,2).map(member=>({...member,activation:"always"}));
 expect(validateCouncilManifest({version:1,members},rules).members).toHaveLength(2);
 expect(()=>validateCouncilManifest({version:1,members:[members[0],{...members[1],scope:"D"}]},rules)).toThrow();
 expect(()=>validateCouncilManifest({version:1,members:[members[0],members[0]]},rules)).toThrow();
 });
});
