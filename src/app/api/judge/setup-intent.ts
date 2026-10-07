import { choice, type TypeSafeClient } from "@typesafe-ai/sdk";
import { z } from "zod";
import type { SetupAnswers } from "@/game/setup";
import { PAIR_INTERACTIONS, TROPHIC_ROLES, validateRuleGraph, type WorldRuleGraph } from "@/game/rules";

const usageSchema = z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }).strict();
const modelResponse = z.object({ model: z.string().min(1), usage: usageSchema, answers: z.record(z.string(), z.unknown()) }).passthrough();
type Client = Pick<TypeSafeClient, "systemOne">;
type Usage = z.infer<typeof usageSchema>;
type Candidate = { id: string; text: string; source: "world" | "threat"; start: number; end: number };
type SpeciesIntent = { id: "A" | "B" | "C" | "D"; name: string; role: (typeof TROPHIC_ROLES)[number]; source: Candidate };
export type SetupIntent = { species: SpeciesIntent[]; graph: WorldRuleGraph; usage: Usage; model: string; evidence: { candidates: Candidate[]; identityChoices: Array<{ id: string; name: string }> } };
const ids = ["A", "B", "C", "D"] as const;
const roles = TROPHIC_ROLES;
const pairs = PAIR_INTERACTIONS;
const probabilities = z.record(z.string(), z.number().finite().min(0).max(1));
function candidates(answers: SetupAnswers): Candidate[] {
 const out: Candidate[] = []; const seen = new Set<string>();
 for (const source of ["world", "threat"] as const) {
  const text = answers[source]; if (text.length > 280) throw new Error("Setup source exceeds supported intent-span limit");
  const words = [...text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)];
  for (let start = 0; start < words.length; start++) for (let length = 1; length <= 4 && start + length <= words.length; length++) {
   const end = start + length - 1; const raw = text.slice(words[start].index!, words[end].index! + words[end][0].length); const normalized = raw.toLocaleLowerCase();
   const key = normalized;
   if (seen.has(key)) continue; seen.add(key);
   out.push({ id: `span_${out.length}`, text: raw, source, start: words[start].index!, end: words[end].index! + words[end][0].length });
   if (out.length > 256) throw new Error("Setup source yields too many organism-span candidates");
  }
 }
 return out;
}
function answer(response: z.infer<typeof modelResponse>, key: string, options: readonly string[]) {
 const schema = z.object({ type: z.literal("choice"), choice: z.enum(options as [string, ...string[]]), confidence: z.number().finite().min(0).max(1), probabilities }).strict();
 const parsed = schema.parse(response.answers[key]); const values = Object.values(parsed.probabilities);
 if (Object.keys(parsed.probabilities).length !== options.length || options.some((option) => !(option in parsed.probabilities)) || Math.abs(values.reduce((a, b) => a + b, 0) - 1) > .011 || parsed.probabilities[parsed.choice] !== Math.max(...values)) throw new Error(`Invalid setup intent response: ${key}`);
 return parsed.choice;
}
async function call(client: Client, beforeCall: (() => Promise<void>) | undefined, state: unknown, questions: Record<string, unknown>) {
 await beforeCall?.();
 const response = modelResponse.parse(await client.systemOne({ state, questions } as never));
 if (Object.keys(response.answers).length !== Object.keys(questions).length || Object.keys(response.answers).some(key => !(key in questions))) throw new Error("Invalid setup intent answer keys");
 return response;
}
function selectedIdentities(identityResponse: z.infer<typeof modelResponse>, source: Candidate[], answers: SetupAnswers, palettes: Record<string, string[]> = {}): Candidate[] {
 const selected: Candidate[] = []; let ended = false;
 for (const id of ids) { const picked = answer(identityResponse, `intent_identity_${id}`, palettes[id] ?? [...source.map((item) => item.id), "none"]); if (picked === "none") { ended = true; continue; } if (ended) throw new Error("Invalid setup intent: noncontiguous species selection"); const candidate = source.find((item) => item.id === picked); if (!candidate || selected.some((item) => item.id === picked || item.text.toLocaleLowerCase() === candidate.text.toLocaleLowerCase())) throw new Error("Invalid setup intent: duplicate or missing identity"); selected.push(candidate); }
 const ordered = selected.map(item => ({ ...item, position: (item.source === "world" ? 0 : answers.world.length + 1) + item.start }));
 for (let index = 1; index < ordered.length; index++) {
  const previous = ordered[index-1], current = ordered[index];
  if (current.position < previous.position) throw new Error("Invalid setup intent: identity source order");
  if (current.source === previous.source && current.start < previous.end) throw new Error("Invalid setup intent: overlapping identities");
 }
 if (selected.length < 2) throw new Error("Invalid setup intent: at least two distinct source identities are required");
 return selected;
}
export async function selectSetupIntent(answers: SetupAnswers, client: Client, beforeCall?: () => Promise<void>, onStage?: (stage: "intent_mapping" | "intent_roles" | "intent_pairs") => void): Promise<SetupIntent> {
 const source = candidates(answers); const identityQuestions: Record<string, unknown> = {};
 for (const id of ids) identityQuestions[`intent_identity_${id}`] = choice(`Select the ${["first", "second", "third", "fourth"][ids.indexOf(id)]} distinct organism mentioned in the original world followed by threat, for slot ${id}. Select none only if fewer than ${ids.indexOf(id)+1} distinct organisms are requested. Choose only an original word or adjacent-word span supplied here. Use two to four distinct named species, in first-mentioned order. Do not treat repeated mentions, resource chemistry, or environmental hazards as species.`, { ...Object.fromEntries(source.map((item) => [item.id, `${item.text} [${item.source}]`])), none: "No further named species" });
 onStage?.("intent_mapping");
 let identityResponse = await call(client, beforeCall, { original_world: answers.world, original_threat: answers.threat, candidate_spans: source }, identityQuestions);
 let selected: Candidate[];
 try { selected = selectedIdentities(identityResponse, source, answers); }
 catch (error) {
  if (!(error instanceof Error) || error.message !== "Invalid setup intent: duplicate or missing identity") throw error;
  const prefix: Candidate[] = [];
  for (const id of ids) {
   const picked = answer(identityResponse, `intent_identity_${id}`, [...source.map(item => item.id), "none"]);
   const candidate = source.find(item => item.id === picked), previous = prefix.at(-1);
   if (!candidate || prefix.some(item => item.id === picked || item.text.toLocaleLowerCase() === candidate.text.toLocaleLowerCase()) || previous && (candidate.source === previous.source && candidate.start < previous.end || candidate.source === "world" && previous.source === "threat")) break;
   prefix.push(candidate);
  }
  const available = source.filter(candidate => !prefix.some(item => item.id === candidate.id || item.text.toLocaleLowerCase() === candidate.text.toLocaleLowerCase()) && prefix.every(item => candidate.source === "threat" && item.source === "world" || candidate.source === item.source && candidate.start >= item.end));
  const repairQuestions: Record<string, unknown> = {};
  for (const id of ids.slice(prefix.length)) repairQuestions[`intent_identity_${id}`] = choice(`Correct slot ${id}: select the ${["first", "second", "third", "fourth"][ids.indexOf(id)]} DISTINCT organism from the original world and threat, or none if no further organism is requested. Preserve fixed_prefix. Do not select a synonym or repeated mention of an organism already assigned. Prefer its shortest unambiguous noun phrase, not an entire feeding statement. Each remaining slot must be distinct, in first-mentioned order. This corrects the application's duplicate mapping, not the user's answers.`, { ...Object.fromEntries(available.map(item => [item.id, `${item.text} [${item.source}]`])), none: "No further named species" });
  const repaired = await call(client, beforeCall, { original_world: answers.world, original_threat: answers.threat, fixed_prefix: prefix.map((item,index) => ({ id:ids[index], name:item.text })), mismatch: "Duplicate organism identity in the initial mapping", rejected_choices: Object.fromEntries(ids.map(id => [id, (identityResponse.answers[`intent_identity_${id}`] as {choice?:unknown})?.choice])), candidate_spans: available }, repairQuestions);
  // Validate the corrective answer against its narrowed palette before merging.
  for (const id of ids.slice(prefix.length)) answer(repaired, `intent_identity_${id}`, [...available.map(item=>item.id), "none"]);
  identityResponse = { ...repaired, answers: { ...identityResponse.answers, ...repaired.answers }, usage: { input_tokens: identityResponse.usage.input_tokens + repaired.usage.input_tokens, output_tokens: identityResponse.usage.output_tokens + repaired.usage.output_tokens } };
  selected = selectedIdentities(identityResponse, source, answers, Object.fromEntries(ids.slice(prefix.length).map(id=>[id,[...available.map(item=>item.id),"none"]])));
 }
 const roleQuestions: Record<string, unknown> = {}; selected.forEach((species, index) => { const id = ids[index]; roleQuestions[`intent_role_${id}`] = choice(`Choose the supported trophic role for the exact named species “${species.text}”. Producer/grazer/omnivore use basal resources; hunter/scavenger do not. Preserve the user's stated identity and intent.`, Object.fromEntries(roles.map((role) => [role, role]))); });
 onStage?.("intent_roles");
 const roleResponse = await call(client, beforeCall, { original_world: answers.world, original_threat: answers.threat, named_species: selected.map((item, index) => ({ id: ids[index], name: item.text, source: item.source })) }, roleQuestions);
 const chosenRoles = selected.map((_, index) => answer(roleResponse, `intent_role_${ids[index]}`, roles));
 if (!chosenRoles.some((role) => ["producer", "grazer", "omnivore"].includes(role))) throw new Error("Invalid setup intent: no basal-feeding species");
 const pairQuestions: Record<string, unknown> = {}; const pairList: Array<{ left: number; right: number; pair: `${typeof ids[number]}:${typeof ids[number]}` }> = [];
 for (let left = 0; left < selected.length; left++) for (let right = left + 1; right < selected.length; right++) {
  const pair = `${ids[left]}:${ids[right]}` as `${typeof ids[number]}:${typeof ids[number]}`; pairList.push({ left, right, pair });
  pairQuestions[`intent_pair_${ids[left]}_${ids[right]}`] = choice(`Choose the relationship for this exact pair: first endpoint ${selected[left].text} (${ids[left]}); second endpoint ${selected[right].text} (${ids[right]}). a_consumes_b means FIRST consumes SECOND; b_consumes_a means SECOND consumes FIRST. No inferred feeding from role.`, Object.fromEntries(pairs.map((mode) => [mode, mode === "a_consumes_b" ? `${selected[left].text} consumes ${selected[right].text}` : mode === "b_consumes_a" ? `${selected[right].text} consumes ${selected[left].text}` : mode])));
 }
 onStage?.("intent_pairs");
 const pairResponse = await call(client, beforeCall, { original_world: answers.world, original_threat: answers.threat, named_species: selected.map((item, index) => ({ id: ids[index], name: item.text, role: chosenRoles[index] })), pair_endpoints: pairList.map(({ left, right }) => ({ first: selected[left].text, second: selected[right].text })) }, pairQuestions);
 const species = selected.map((item, index) => ({ id: ids[index], name: item.text, role: chosenRoles[index] as typeof roles[number], source: item }));
 const graph = validateRuleGraph({ version: 1, species: species.map((item) => ({ id: item.id, role: item.role, selfInteraction: "neutral" })), interactions: pairList.map(({ pair, left, right }) => ({ pair, mode: answer(pairResponse, `intent_pair_${ids[left]}_${ids[right]}`, pairs) })), environment: { regeneration: "steady", pressure: "stability", volatility: "stable", intensity: "low", duration: "medium" } });
 const usage = { input_tokens: identityResponse.usage.input_tokens + roleResponse.usage.input_tokens + pairResponse.usage.input_tokens, output_tokens: identityResponse.usage.output_tokens + roleResponse.usage.output_tokens + pairResponse.usage.output_tokens };
 return { species, graph, usage, model: pairResponse.model, evidence: { candidates: source, identityChoices: species.map(({ id, name }) => ({ id, name })) } };
}
export function intentMismatches(intent: SetupIntent, graph: WorldRuleGraph): string[] {
 const mismatches: string[] = [];
 if (graph.species.length !== intent.species.length) mismatches.push(`Expected ${intent.species.length} named species; found ${graph.species.length}.`);
 for (const wanted of intent.species) { const actual = graph.species.find((item) => item.id === wanted.id); if (!actual) { mismatches.push(`Missing named species ${wanted.name} (${wanted.id}).`); continue; } if (actual.role !== wanted.role) mismatches.push(`${wanted.name} role mismatch: expected ${wanted.role}, found ${actual.role}.`); }
 for (const expected of intent.graph.interactions) { const actual = graph.interactions.find((item) => item.pair === expected.pair); if (!actual) { mismatches.push(`Missing relationship for ${expected.pair}.`); continue; } if (actual.mode !== expected.mode) { const [a, b] = expected.pair.split(":").map((id) => intent.species.find((item) => item.id === id)?.name ?? id); mismatches.push(`${a}/${b} relationship mismatch: expected ${expected.mode}, found ${actual.mode}; consumption direction may be reversed.`); } }
 return mismatches;
}
