import habitatMaterials from "./habitat-materials.json";

const cache = new Map<string, HTMLCanvasElement>();
const clamp=(n:number)=>Math.max(0,Math.min(255,Math.round(n)));
const GRAIN_SIZE=32;
const strengthKnots = [[0,0],[1,.018],[12,.28],[25,.34],[128,.64],[255,1]] as const;
export function fieldStrength(value: number): number {
  const v=Number.isFinite(value)?Math.max(0,Math.min(255,value)):0;
  for(let i=1;i<strengthKnots.length;i++){
    const [x1,y1]=strengthKnots[i];
    if(v<=x1){const [x0,y0]=strengthKnots[i-1];return y0+(y1-y0)*(v-x0)/(x1-x0);}
  }
  return 1;
}
const sediment=habitatMaterials.sediment as number[];
const frost=habitatMaterials.frost as number[];
const etch=habitatMaterials.etch as number[];
const abundanceScale=Array.from({length:256},(_,i)=>fieldStrength(i));
const materialAt=(mask:number[],x:number,y:number)=>mask[((y%GRAIN_SIZE+GRAIN_SIZE)%GRAIN_SIZE)*GRAIN_SIZE+(x%GRAIN_SIZE+GRAIN_SIZE)%GRAIN_SIZE]/255;
const materialMean=(mask:number[])=>mask.reduce((sum,value)=>sum+value,0)/(mask.length*255);
const sedimentMean=materialMean(sediment), frostMean=materialMean(frost), etchMean=materialMean(etch);
export function resourceGrainOffset(worldX:number,worldY:number,abundance:number):number {
  if (!Number.isFinite(abundance) || abundance <= 0) return 0;
  const px=worldX*GRAIN_SIZE/5,py=worldY*GRAIN_SIZE/5,x0=Math.floor(px),y0=Math.floor(py),fx=px-x0,fy=py-y0;
  const sample=(x:number,y:number)=>materialAt(sediment,x,y);
  const filtered=(sample(x0,y0)*(1-fx)+sample(x0+1,y0)*fx)*(1-fy)+(sample(x0,y0+1)*(1-fx)+sample(x0+1,y0+1)*fx)*fy;
  const amount=abundanceScale[Math.round(Math.min(1,abundance)*255)];
  // Preserve the absolute world-space texture scale at every abundance. A
  // low abundance reduces contrast, rather than shrinking/thresholding grain.
  return filtered * amount;
}
export function hazardHatchAlpha(hazard:number,worldX:number,worldY:number,cellFootprint=0):number {
  if (!Number.isFinite(hazard) || hazard <= 0) return 0;
  // Integrate periodic stripe coverage over the projected pixel footprint.
  const phase=(worldX+worldY)*.8, half=Math.max(.035,cellFootprint*.8);
  const area=(p:number)=>Math.floor(p)*.33+Math.min(.33,p-Math.floor(p));
  const stripe=(area(phase+half)-area(phase-half))/(2*half);
  return Math.round(fieldStrength(hazard)*205*stripe);
}
// Fixed, perceptually stronger mapping: same engine values always mean the same thing.
export function resourceFieldColor(value: number): [number, number, number] {
  const t = Math.sqrt(Math.max(0, Math.min(255, value)) / 255);
  return [clamp(165 - 65 * t), clamp(169 + 20 * t), clamp(161 + 16 * t)];
}
function rgba([r,g,b]:number[],a:number){return`rgba(${r},${g},${b},${a})`;}
function colorRgb(color:string):number[]{const m=/^#([\da-f]{6})$/i.exec(color);return m?[parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16)]:[12,112,111];}
function tint(rgb:number[],amount:number){return rgb.map(channel=>clamp(channel+(amount>=0?255-channel:channel)*amount));}
function contour(c:CanvasRenderingContext2D,pred:boolean,v:number){c.beginPath();for(let k=0;k<=80;k++){const a=k/80*Math.PI*2,r=1+.045*Math.sin(a*4+v*.8)+.025*Math.sin(a*7-v),t=pred?1+.34*Math.cos(a):1,x=Math.cos(a)*r*t,y=Math.sin(a)*r*(pred?.69:.89);if(!k)c.moveTo(x,y);else c.lineTo(x,y);}c.closePath();}
const portraits = new Map<string, string>();
export function microscopicPortrait(role:string|undefined,color:string,variant:number){
 const key = `${role}:${color}:${variant % 12}`;
 const cached = portraits.get(key); if (cached) return cached;
 const portrait = microscopicSprite(role,color,variant,100,1)?.toDataURL() ?? "";
 if (portrait) { if (portraits.size >= 256) portraits.delete(portraits.keys().next().value!); portraits.set(key,portrait); }
 return portrait;
}
export function microscopicSprite(role:string|undefined,color:string,variant:number,pitch:number,zoom:number){
 if(typeof document==='undefined')return null;const pred=role==='hunter'||role==='omnivore',v=((variant%12)+12)%12,key=`${role}:${color}:${v}:${pitch*zoom<14?"small":"detail"}`;const found=cache.get(key);if(found)return found;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=192;const x=canvas.getContext('2d');if(!x||!x.scale||!x.createRadialGradient)return null;x.translate(96,96);x.scale(72,72);
 x.save();x.translate(.035,.08);contour(x,pred,v);x.fillStyle='rgba(7,16,15,.35)';x.fill();x.restore();
 // At native whole-world scale, discard subpixel organelles and preserve a
 // high-luminance membrane plus a dark keyline around the role silhouette.
 if(pitch*zoom<14){
   contour(x,pred,v);x.fillStyle=color;x.fill();
   x.lineWidth=.18;x.strokeStyle='#07100f';x.stroke();
   x.lineWidth=.08;x.strokeStyle='#fff4d8';x.stroke();
   if(role==='producer'){x.fillStyle='#d8f3a0';x.beginPath();x.arc(0,0,.22,0,Math.PI*2);x.fill();}
   else if(role==='scavenger'){x.strokeStyle='#e9f7d8';x.lineWidth=.075;for(let j=-1;j<=1;j++){x.beginPath();x.moveTo(j*.32,-.35);x.lineTo(j*.32,.35);x.stroke();}}
   else if(role==='omnivore'){x.fillStyle='#ffdc78';x.beginPath();x.arc(0,0,.17,0,Math.PI*2);x.fill();}
   cache.set(key,canvas);if(cache.size>256)cache.delete(cache.keys().next().value!);return canvas;
 }
 contour(x,pred,v);const body=colorRgb(color),light=tint(body,.48),dark=tint(body,-.48),mid=tint(body,.18);const g=x.createRadialGradient(-.38,-.42,.03,.02,.02,1.18);g.addColorStop(0,rgba(light,1));g.addColorStop(.42,rgba(mid,1));g.addColorStop(.79,rgba(body,1));g.addColorStop(1,rgba(dark,1));x.fillStyle=g;x.fill();
 x.save();contour(x,pred,v);x.clip();for(let j=0;j<15;j++){const a=j*2.399+v*.41,r=.23+((j*37+v*11)%61)/100,ox=Math.cos(a)*r,oy=Math.sin(a)*r*(pred?.62:.8),sz=.035+(j%4)*.012,q=x.createRadialGradient(ox-.015,oy-.02,0,ox,oy,sz*2);q.addColorStop(0,'rgba(255,255,255,.34)');q.addColorStop(.55,pred?'rgba(40,20,25,.14)':'rgba(5,25,35,.12)');q.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=q;x.beginPath();x.ellipse(ox,oy,sz*1.6,sz,a,0,Math.PI*2);x.fill();}
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
      const q=Math.max(0,Math.min(1,((read(cx,cy)*(1-fx)+read(cx+1,cy)*fx)*(1-fy)+(read(cx,cy+1)*(1-fx)+read(cx+1,cy+1)*fx)*fy)/255));
      // Average mask samples across the source-world footprint represented by
      // this raster pixel. At zoomed-out views this prevents point-sample aliasing.
      const footprint=camera.span/200;
      const grainSamples=Math.max(1,Math.ceil(footprint*GRAIN_SIZE/5));
      let grain=0,frostValue=0;
      for(let sy=0;sy<grainSamples;sy++)for(let sx=0;sx<grainSamples;sx++){
        const sampleX=wx+((sx+.5)/grainSamples-.5)*footprint;
        const sampleY=wy+((sy+.5)/grainSamples-.5)*footprint;
        grain+=resourceGrainOffset(sampleX,sampleY,q);
        frostValue+=materialAt(frost,Math.floor(sampleX*GRAIN_SIZE/5),Math.floor(sampleY*GRAIN_SIZE/5));
      }
      grain/=grainSamples*grainSamples;frostValue/=grainSamples*grainSamples;
      const i=(py*200+px)*4;
      const [red, green, blue] = resourceFieldColor(q * 255);
      const grainCenter=abundanceScale[Math.round(q*255)]*sedimentMean;
      // Sediment is the high-contrast green aggregate; frost stays a faint,
      // neutral mineral variation even when food is depleted.
      const aggregate=(grain-grainCenter)*92;
      const background=(frostValue-frostMean)*3;
      im.data[i]=clamp(red-aggregate+background);im.data[i+1]=clamp(green+aggregate+background);im.data[i+2]=clamp(blue+background);im.data[i+3]=255;
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
      const etchSamples=Math.max(1,Math.ceil(camera.span/160*GRAIN_SIZE/5));let etchValue=0;
      for(let sy=0;sy<etchSamples;sy++)for(let sx=0;sx<etchSamples;sx++){
        const sampleX=wx+((sx+.5)/etchSamples-.5)*camera.span/160;
        const sampleY=wy+((sy+.5)/etchSamples-.5)*camera.span/160;
        etchValue+=materialAt(etch,Math.floor(sampleX*GRAIN_SIZE/5),Math.floor(sampleY*GRAIN_SIZE/5));
      }
      etchValue/=etchSamples*etchSamples;
      im.data[k+3]=Math.round(hazardHatchAlpha(v,wx,wy,camera.span/160)*(1+.25*(etchValue-etchMean)));
    }
    hx.putImageData(im,0,0);hazardSource=hazards;hazardView=view;
  }
  c.save();c.globalCompositeOperation="source-over";c.globalAlpha=.78;c.drawImage(overlay,pad,pad,cw*50,ch*50);c.restore();
}
