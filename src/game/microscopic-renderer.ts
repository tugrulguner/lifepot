import nutrientGrain from "./nutrient-grain.json";

const cache = new Map<string, HTMLCanvasElement>();
const clamp=(n:number)=>Math.max(0,Math.min(255,Math.round(n)));
const GRAIN_SIZE=32;
const grainMask=nutrientGrain as number[];
export function resourceGrainOffset(worldX:number,worldY:number,abundance:number):number {
  if (abundance <= 0) return 0;
  const x=((Math.floor(worldX*GRAIN_SIZE/5)%GRAIN_SIZE)+GRAIN_SIZE)%GRAIN_SIZE;
  const y=((Math.floor(worldY*GRAIN_SIZE/5)%GRAIN_SIZE)+GRAIN_SIZE)%GRAIN_SIZE;
  const amount=Math.min(1,abundance);
  return Math.max(0,grainMask[y*GRAIN_SIZE+x]/255-(1-amount)*.65)*Math.sqrt(amount);
}
export function hazardHatchAlpha(hazard:number,worldX:number,worldY:number):number {
  if (hazard <= 0) return 0;
  const phase=(worldX+worldY)*.8;
  const stripe=phase-Math.floor(phase)<.33;
  return Math.round(Math.min(1,hazard/255)*(stripe?205:83));
}
// Fixed, perceptually stronger mapping: same engine values always mean the same thing.
export function resourceFieldColor(value: number): [number, number, number] {
  const t = Math.sqrt(Math.max(0, Math.min(255, value)) / 255);
  return [clamp(139 - 39 * t), clamp(143 + 46 * t), clamp(135 + 42 * t)];
}
function rgba([r,g,b]:number[],a:number){return`rgba(${r},${g},${b},${a})`;}
function contour(c:CanvasRenderingContext2D,pred:boolean,v:number){c.beginPath();for(let k=0;k<=80;k++){const a=k/80*Math.PI*2,r=1+.045*Math.sin(a*4+v*.8)+.025*Math.sin(a*7-v),t=pred?1+.34*Math.cos(a):1,x=Math.cos(a)*r*t,y=Math.sin(a)*r*(pred?.69:.89);if(!k)c.moveTo(x,y);else c.lineTo(x,y);}c.closePath();}
const portraits = new Map<string, string>();
export function microscopicPortrait(role:string|undefined,color:string,variant:number){
 const key = `${role}:${variant % 12}`;
 const cached = portraits.get(key); if (cached) return cached;
 const portrait = microscopicSprite(role,color,variant,100,1)?.toDataURL() ?? "";
 if (portrait) { if (portraits.size >= 256) portraits.delete(portraits.keys().next().value!); portraits.set(key,portrait); }
 return portrait;
}
export function microscopicSprite(role:string|undefined,color:string,variant:number,pitch:number,dpr:number){
 if(typeof document==='undefined')return null;const pred=role==='hunter'||role==='omnivore',v=((variant%12)+12)%12,key=`${role}:${color}:${v}:${Math.round(pitch*dpr)}`;const found=cache.get(key);if(found)return found;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=192;const x=canvas.getContext('2d');if(!x||!x.scale||!x.createRadialGradient)return null;x.translate(96,96);x.scale(72,72);
 x.save();x.translate(.035,.08);contour(x,pred,v);x.fillStyle='rgba(28,56,47,.13)';x.shadowColor='rgba(22,60,49,.15)';x.shadowBlur=6;x.fill();x.restore();
 contour(x,pred,v);const base=pred?[190,54,57]:[12,112,111], light=pred?[255,207,191]:[201,246,239], dark=pred?[111,34,42]:[5,66,72],mid=pred?[232,91,82]:[27,166,155];const g=x.createRadialGradient(-.38,-.42,.03,.02,.02,1.18);g.addColorStop(0,rgba(light,1));g.addColorStop(.42,rgba(mid,1));g.addColorStop(.79,rgba(base,1));g.addColorStop(1,rgba(dark,1));x.fillStyle=g;x.fill();
 x.save();contour(x,pred,v);x.clip();for(let j=0;j<15;j++){const a=j*2.399+v*.41,r=.23+((j*37+v*11)%61)/100,ox=Math.cos(a)*r,oy=Math.sin(a)*r*(pred?.62:.8),sz=.035+(j%4)*.012,q=x.createRadialGradient(ox-.015,oy-.02,0,ox,oy,sz*2);q.addColorStop(0,pred?'rgba(255,236,184,.7)':'rgba(230,255,216,.65)');q.addColorStop(.55,pred?'rgba(152,77,56,.22)':'rgba(24,108,100,.22)');q.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=q;x.beginPath();x.ellipse(ox,oy,sz*1.6,sz,a,0,Math.PI*2);x.fill();}
 x.save();x.translate(-.12,.07);x.rotate(.3+v*.19);x.beginPath();x.ellipse(0,0,.28,.22,0,0,Math.PI*2);const core=x.createRadialGradient(-.08,-.07,.01,0,0,.32);core.addColorStop(0,pred?'rgba(238,170,123,.75)':'rgba(132,197,153,.8)');core.addColorStop(1,pred?'rgba(100,47,58,.65)':'rgba(20,83,85,.65)');x.fillStyle=core;x.fill();x.strokeStyle='rgba(255,246,218,.35)';x.lineWidth=.016;x.stroke();x.restore();x.strokeStyle=pred?'rgba(119,54,52,.12)':'rgba(22,91,82,.12)';x.lineWidth=.012;for(let j=0;j<4;j++){x.beginPath();x.moveTo(-1,.2*j-.4);x.bezierCurveTo(-.4,-.7+j*.2,.2,.7-j*.17,1,.13*j-.2);x.stroke();}x.restore();
 contour(x,pred,v);x.lineWidth=.034;x.strokeStyle=pred?'rgba(91,28,34,.95)':'rgba(4,63,66,.95)';x.stroke();x.save();x.scale(.955,.955);contour(x,pred,v);x.lineWidth=.026;x.strokeStyle='rgba(255,255,228,.65)';x.stroke();x.restore();x.save();x.scale(.91,.91);contour(x,pred,v);x.lineWidth=.025;x.strokeStyle='rgba(251,255,237,.3)';x.stroke();x.restore();cache.set(key,canvas);if(cache.size>256)cache.delete(cache.keys().next().value!);return canvas;
}
// Snapshot arrays are cached by identity/view; texture coordinates derive from wrapped
// world coordinates, so the generated grain/hatching remain spatially fixed.
let texture: HTMLCanvasElement | undefined, overlay: HTMLCanvasElement | undefined;
let resourceSource: Uint8Array | undefined, hazardSource: Uint8Array | undefined;
let resourceView = "", hazardView = "";
export function paintResourceField(c: CanvasRenderingContext2D, pad: number, cw: number, ch: number, width: number, height: number, resources: Uint8Array, hazards: Uint8Array, showHazards: boolean, camera = {x:25,y:25,span:50}) {
  if (typeof document === "undefined") return;
  const view = `${camera.x},${camera.y},${camera.span}`;
  const wrap = (n: number) => (n % 50 + 50) % 50;
  if (!texture) { texture = document.createElement("canvas"); texture.width = texture.height = 200; }
  if (resourceSource !== resources || resourceView !== view) {
    const ctx = texture.getContext("2d"); if (!ctx?.createImageData) return;
    const im = ctx.createImageData(200,200);
    for (let py=0;py<200;py++) for (let px=0;px<200;px++) {
      const wx=wrap(camera.x-camera.span/2+(px+.5)/200*camera.span), wy=wrap(camera.y-camera.span/2+(py+.5)/200*camera.span);
      const gx=wx-.5,gy=wy-.5,cx=Math.floor(gx),cy=Math.floor(gy),fx=gx-cx,fy=gy-cy;
      const read=(x:number,y:number)=>resources[wrap(y)*50+wrap(x)]||0;
      const q=Math.max(0,Math.min(1,((read(cx,cy)*(1-fx)+read(cx+1,cy)*fx)*(1-fy)+(read(cx,cy+1)*(1-fx)+read(cx+1,cy+1)*fx)*fy)/150));
      const grain=resourceGrainOffset(wx,wy,q),i=(py*200+px)*4;
      const [red, green, blue] = resourceFieldColor(q * 255);
      im.data[i]=clamp(red-grain*29);im.data[i+1]=clamp(green-grain*29);im.data[i+2]=clamp(blue-grain*29);im.data[i+3]=255;
    }
    ctx.putImageData(im,0,0); resourceSource=resources; resourceView=view;
  }
  c.drawImage(texture,pad,pad,cw*50,ch*50);
  if (!showHazards) return;
  if (!overlay) { overlay=document.createElement("canvas");overlay.width=overlay.height=160; }
  if (hazardSource !== hazards || hazardView !== view) {
    const hx=overlay.getContext("2d");if(!hx?.createImageData)return;
    const im=hx.createImageData(160,160);
    for(let y=0;y<160;y++)for(let x=0;x<160;x++){
      const wx=wrap(camera.x-camera.span/2+(x+.5)/160*camera.span),wy=wrap(camera.y-camera.span/2+(y+.5)/160*camera.span),v=hazards[Math.floor(wy)*50+Math.floor(wx)],k=(y*160+x)*4;
      im.data[k]=205;im.data[k+1]=62;im.data[k+2]=42;
      im.data[k+3]=hazardHatchAlpha(v,wx,wy);
    }
    hx.putImageData(im,0,0);hazardSource=hazards;hazardView=view;
  }
  c.save();c.globalCompositeOperation="source-over";c.globalAlpha=.78;c.drawImage(overlay,pad,pad,cw*50,ch*50);c.restore();
}
