import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { deterministicSetup,hashSetupRequest } from "@/game/setup";
import { deterministicEvolutionDecision,type EvolutionDecision } from "@/game/decisions";
import { evolutionRequestSchema,setupRequestSchema,type EvolutionRequest,type SetupRequest } from "./schema";
import { decideEvolution,interpretSetup,type SetupInterpretation } from "./service";
export const runtime="nodejs";
const MAX_BODY_BYTES=16384;
type CloudflareRateLimit={limit:(input:{key:string})=>Promise<{success:boolean}>};
async function cloudflareRateLimit(key:string){
 const {env}=getCloudflareContext();
 const binding=(env as typeof env & {JUDGE_RATE_LIMIT?:CloudflareRateLimit}).JUDGE_RATE_LIMIT;
 if(!binding)throw new Error("Cloudflare rate-limit binding unavailable");
 return (await binding.limit({key})).success;
}
async function cloudflareGlobalRateLimit(key:string){const {env}=getCloudflareContext();const binding=(env as typeof env & {JUDGE_GLOBAL_RATE_LIMIT?:CloudflareRateLimit}).JUDGE_GLOBAL_RATE_LIMIT;if(!binding)throw new Error("Cloudflare global rate-limit binding unavailable");return (await binding.limit({key})).success;}
type Options={decide?:(i:SetupRequest)=>Promise<SetupInterpretation>;evolutionDecide?:(i:EvolutionRequest)=>Promise<EvolutionDecision>;rateLimit?:(key:string)=>Promise<boolean>;globalRateLimit?:(key:string)=>Promise<boolean>;maxRequests?:number;windowMs?:number;now?:()=>number};
type Input=SetupRequest|EvolutionRequest;
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
type FallbackReason="rate_limited"|"unavailable"|"invalid_response"|"missing_credentials"|"unknown";
const setupProvenance = (result: SetupInterpretation) => result.source === "fallback"
  ? { outcome: "abstained", reason: result.fallbackReason ?? "unknown" }
  : result.fidelity && result.fidelity.verdict !== "approve"
    ? { outcome: result.fidelity.verdict }
    : { outcome: "decided" };
async function readBoundedBody(r:Request){const reader=r.body?.getReader();if(!reader)return "";const chunks:Uint8Array[]=[];let total=0;try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BODY_BYTES){await reader.cancel();throw new RangeError("Request too large");}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return new TextDecoder().decode(bytes);}
function ip(r:Request){const raw=r.headers.get("cf-connecting-ip")?.trim();return raw&&/^[0-9a-fA-F:.]{1,45}$/.test(raw)?raw:"unknown";}
function fallback(i:Input){return "kind" in i?deterministicEvolutionDecision(i.summary):{config:deterministicSetup(i.answers),source:"fallback",requestHash:hashSetupRequest(i.answers)};}
// Explicit development-only opt-in. Host checks are not authentication: bind dev to loopback.
function localShowcase(r:Request){return process.env.LIFEPOT_SHOWCASE_MODE==="1"&&(process.env.NODE_ENV==="development"||process.env.NODE_ENV==="test")&&process.env.VERCEL===undefined&&["localhost","127.0.0.1","[::1]"].includes(new URL(r.url).hostname);}
export function createCallBudget(max=10,window=60000,now=Date.now){const rates=new Map<string,{count:number;reset:number}>();return async(key:string)=>{const time=now();let b=rates.get(key);if(!b||time>=b.reset){if(rates.size>=1024&&!b)throw new Error("Quota store full");b={count:0,reset:time+window};rates.set(key,b);}if(b.count>=max)throw new Error("Model call quota exceeded");b.count++;};}
export function createJudgeHandler(o:Options={}){
 const reserve=createCallBudget(o.maxRequests??10,o.windowMs??60000,o.now??Date.now);
 const showcaseReserve=createCallBudget(o.maxRequests??120,o.windowMs??60000,o.now??Date.now);
 return async(r:Request)=>{try{
 if(Number(r.headers.get("content-length")??0)>MAX_BODY_BYTES)return response({error:"Request is too large"},413);
 let raw:string;try{raw=await readBoundedBody(r);}catch(e){if(e instanceof RangeError)return response({error:"Request is too large"},413);throw e;}
 const json:unknown=JSON.parse(raw),ep=evolutionRequestSchema.safeParse(json),sp=ep.success?null:setupRequestSchema.safeParse(json);let input:Input;
 if(ep.success)input=ep.data;else if(sp?.success)input=sp.data;else return response({error:"Invalid judge request"},400);
 if(!("kind" in input)&&input.requestHash!==hashSetupRequest(input.answers))return response({error:"Setup hash mismatch"},400);
 const beforeCall=async()=>{if(process.env.NODE_ENV==="production"){if(!o.rateLimit||!o.globalRateLimit)throw new Error("Cloudflare rate-limit binding unavailable");if(!await o.rateLimit(`judge:${ip(r)}`))throw new Error("Quota exceeded");if(!await o.globalRateLimit("judge:global"))throw new Error("Global quota exceeded");}else await (localShowcase(r)?showcaseReserve:reserve)(ip(r));};
 try{if("kind" in input){const result=o.evolutionDecide?(await beforeCall(),await o.evolutionDecide(input)):await decideEvolution(input,{beforeCall});return response({...result,provenance:result.source==="fallback"?{outcome:"abstained",reason:(result as EvolutionDecision & {fallbackReason?:FallbackReason}).fallbackReason??"unknown"}:{outcome:"decided"}});}
 const result=o.decide?(await beforeCall(),await o.decide(input)):await interpretSetup(input,{beforeCall});return response({...result,provenance:setupProvenance(result)});}catch(error){const message=error instanceof Error?error.message.toLowerCase():"";const reason:FallbackReason=/quota exceeded|rate limit|rate-limit|too many requests/.test(message)?"rate_limited":/invalid|parse|schema|scope palette/.test(message)?"invalid_response":/api key|credential/.test(message)?"missing_credentials":/timeout|connection|fetch|unavailable|network|5\d\d/.test(message)?"unavailable":"unknown";return response({...fallback(input),provenance:{outcome:"abstained",reason}});}
 }catch{return response({error:"Invalid judge request"},400);}};
}
export const POST=createJudgeHandler({rateLimit:cloudflareRateLimit,globalRateLimit:cloudflareGlobalRateLimit});
