import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { reflectRun } from "./service";
import { z } from "zod";
import { validateReflection } from "@/game/run-reflection";
import { lifeConfigSchema } from "@/game/setup";
export const runtime="nodejs";
const MAX_BODY=128_000;
type RateLimit={limit(input:{key:string}):Promise<{success:boolean}>};
async function cloudflareLimit(key:string){const {env}=getCloudflareContext();const bindings=env as typeof env & {JUDGE_RATE_LIMIT?:RateLimit;JUDGE_GLOBAL_RATE_LIMIT?:RateLimit};const binding=key==="reflect:global"?bindings.JUDGE_GLOBAL_RATE_LIMIT:bindings.JUDGE_RATE_LIMIT;if(!binding)throw new Error("Cloudflare rate-limit binding unavailable");return (await binding.limit({key:key==="reflect:global"?"judge:global":key.replace(/^reflect:/,"judge:")})).success;}
const integer=z.number().int().nonnegative();const generation=integer.max(180);
const species=z.object({speciesId:z.enum(["A","B","C","D"]),role:z.string().max(32),population:integer.max(2500)}).strict();
const sample=z.object({generation,population:integer.max(2500),prey:integer.max(2500),predators:integer.max(2500),resources:z.number().finite().nonnegative().max(637500),births:integer,deaths:integer,kills:integer,species:z.array(species).min(2).max(4)}).strict();
const ruleEvent=z.discriminatedUnion("kind",[z.object({kind:z.literal("activated"),generation,sourceGeneration:generation,revertAt:integer.nullable()}).strict(),z.object({kind:z.literal("reverted"),generation}).strict()]);
const evidenceSchema=z.object({samples:z.array(sample).min(1).max(181),firstExtinction:z.array(z.object({speciesId:z.enum(["A","B","C","D"]),generation}).strict()).max(4),peakPopulation:integer.max(2500),lineageExtinction:z.array(z.object({lineage:integer,generation}).strict()).max(100),ruleEvents:z.array(ruleEvent).max(360),observedRuleVersion:integer.min(1),followedFamily:z.object({lineage:integer,population:integer.max(2500)}).strict().nullable(),activeRuleIdentity:z.string().max(100).nullable().optional()}).strict().refine(value=>value.samples.every((s,i)=>i===0||s.generation>value.samples[i-1].generation),"Samples must be ordered");
const schema=z.object({evidence:evidenceSchema,config:lifeConfigSchema}).strict();
async function readBody(request:Request){const reader=request.body?.getReader();if(!reader)return "";let total=0;const chunks:Uint8Array[]=[];try{for(;;){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>MAX_BODY){await reader.cancel();throw new RangeError("Request too large");}chunks.push(part.value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);}
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
export function createReflectHandler(options:{limit?:(key:string)=>Promise<boolean>;reflect?:typeof reflectRun}={}){return async(request:Request)=>{
 let parsed:z.infer<typeof schema>;
 try{if(Number(request.headers.get("content-length")??0)>MAX_BODY)return response({error:"Request too large"},413);parsed=schema.parse(JSON.parse(await readBody(request)));}catch(error){return response({error:error instanceof RangeError?"Request too large":"Invalid reflection request"},error instanceof RangeError?413:400);}
 try{const limit=options.limit??cloudflareLimit;const rawIp=request.headers.get("cf-connecting-ip")?.trim();const ip=rawIp&&/^[0-9a-fA-F:.]{1,45}$/.test(rawIp)?rawIp:"unknown";if(!(await limit(`reflect:${ip}`))||!(await limit("reflect:global")))return response({error:"Rate limited"},429);
 const result=validateReflection(await (options.reflect??reflectRun)(parsed),parsed.evidence,parsed.config);return response(result);
 }catch{return response({error:"Jev reflection unavailable"},503);}
};}
export const POST=createReflectHandler();
