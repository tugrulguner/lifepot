import { afterEach, describe, expect, it, vi } from "vitest";
import { fieldStrength, hazardHatchAlpha, microscopicPortrait, microscopicSprite, paintResourceField, resourceFieldColor, resourceGrainOffset } from "./microscopic-renderer";
import materials from "./habitat-materials.json";

let images: Uint8ClampedArray[] = [];
function paint(resources: Uint8Array, hazards = new Uint8Array(2500), showHazards = false, camera = {x:25,y:25,span:50}) {
  images = [];
  const makeCanvas = () => {
    let data: Uint8ClampedArray;
    const ctx = { createImageData(w: number, h: number) { data = new Uint8ClampedArray(w*h*4); return { data }; }, putImageData() { images.push(data); }, drawImage() {}, save() {}, restore() {}, set globalCompositeOperation(_v: string) {}, set globalAlpha(_v: number) {} };
    return { width: 0, height: 0, getContext: () => ctx };
  };
  vi.stubGlobal("document", { createElement: makeCanvas });
  paintResourceField({ drawImage() {}, save() {}, restore() {}, set globalCompositeOperation(_v: string) {}, set globalAlpha(_v: number) {} } as unknown as CanvasRenderingContext2D, 0, 1, 1, 50, 50, resources, hazards, showHazards, camera);
  return images;
}

describe("native habitat resource field encoding", () => {
  it("keeps the species body color as anchor at native, detailed, and portrait scales", () => {
    const stops: string[] = [];
    const fills: string[] = [];
    let portraitRenders = 0;
    vi.stubGlobal("document", { createElement: () => {
      let fill = "";
      const gradient = { addColorStop(_at:number, color:string) { stops.push(color); } };
      const ctx = { translate() {}, scale() {}, save() {}, restore() {}, beginPath() {}, clip() {}, ellipse() {}, arc() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() { fills.push(fill); }, stroke() {}, rotate() {}, bezierCurveTo() {}, createRadialGradient() { return gradient; }, set fillStyle(v:string) { fill=v; }, set strokeStyle(_v:string) {}, set lineWidth(_v:number) {} };
      return { width:0,height:0,getContext:()=>ctx,toDataURL:()=>{ portraitRenders++; return "portrait"; } };
    }});
    const anchor = "#153f67";
    microscopicSprite("grazer", anchor, 0, 10, 1);
    microscopicSprite("grazer", anchor, 0, 100, 1);
    microscopicPortrait("grazer", anchor, 0);
    expect(fills).toContain(anchor);
    expect(stops).toContain("rgba(21,63,103,1)");
    expect(microscopicPortrait("grazer", "#234f71", 0)).toBe("portrait");
    expect(portraitRenders).toBe(2);
  });
  it("keeps organism role silhouettes and contrast in the tiny native-world sprite path", () => {
    const traces: Array<{ role: string; path: string; fill: string; stroke: string; width: number }> = [];
    vi.stubGlobal("document", { createElement: () => {
      let fill = "", stroke = "", width = 0, path = "";
      const ctx = { translate() {}, scale() {}, save() {}, restore() {}, beginPath() { path = ""; }, clip() {}, ellipse() {}, arc() {}, moveTo(x:number,y:number) { path += `M${x},${y}`; }, lineTo(x:number,y:number) { path += `L${x},${y}`; }, closePath() { path += "Z"; }, fill() { traces.push({ role: "", path, fill, stroke, width }); }, stroke() { traces.push({ role: "", path, fill, stroke, width }); }, set fillStyle(v:string) { fill=v; }, set strokeStyle(v:string) { stroke=v; }, set lineWidth(v:number) { width=v; }, createRadialGradient() { return { addColorStop() {} }; } };
      return { width:0,height:0,getContext:()=>ctx };
    }});
    microscopicSprite("grazer", "#339966", 0, 10, 1);
    microscopicSprite("hunter", "#cc3344", 0, 10, 1);
    const fills = traces.filter(t => t.fill && t.path);
    expect(fills.length).toBeGreaterThanOrEqual(2);
    expect(new Set(fills.map(t => t.path)).size).toBeGreaterThanOrEqual(2);
    expect(fills.some(t => t.stroke === "#07100f")).toBe(true);
  });
  it("repairs material wraps while retaining period and grain variation", () => {
    for (const name of ["sediment", "frost", "etch"] as const) {
      const a = materials[name], mean = a.reduce((s,v)=>s+v,0)/a.length/255;
      const sd = Math.sqrt(a.reduce((s,v)=>s+(v/255-mean)**2,0)/a.length);
      const wrap: number[] = [], interior: number[] = [];
      for(let y=0;y<32;y++){wrap.push(Math.abs(a[y*32]-a[y*32+31]));for(let x=0;x<31;x++)interior.push(Math.abs(a[y*32+x]-a[y*32+x+1]));}
      for(let x=0;x<32;x++){wrap.push(Math.abs(a[x]-a[31*32+x]));for(let y=0;y<31;y++)interior.push(Math.abs(a[y*32+x]-a[(y+1)*32+x]));}
      const avg=(v:number[])=>v.reduce((s,x)=>s+x,0)/v.length;
      expect(mean).toBeGreaterThan(.35); expect(mean).toBeLessThan(.6);
      expect(sd).toBeGreaterThan(.15); expect(new Set(a).size).toBeGreaterThan(80);
      expect(avg(wrap)).toBeLessThan(avg(interior)*.05);
    }
  });
  it("maps invalid strengths to zero and keeps moderate-to-severe contrast rising", () => {
    expect(fieldStrength(Number.NaN)).toBe(0);
    expect(fieldStrength(Number.POSITIVE_INFINITY)).toBe(0);
    expect(fieldStrength(1)).toBeLessThanOrEqual(.025);
    expect(fieldStrength(128)).toBeGreaterThan(fieldStrength(25));
    expect(fieldStrength(255)).toBeGreaterThan(fieldStrength(128));
    expect(hazardHatchAlpha(Number.NaN,0,0)).toBe(0);
    expect(resourceGrainOffset(1,1,Number.NaN)).toBe(0);
  });
  it("separates two midrange fields and preserves mean food color and strong hatching", () => {
    const signals = [40,110,128,255].map(level => {
      const [field, overlay] = paint(new Uint8Array(2500).fill(level), new Uint8Array(2500).fill(level), true);
      const base = resourceFieldColor(level);
      for (const channel of [0,1]) {
        const sum = field.reduce((s,v,i) => s+(i%4===channel?v:0),0);
        expect(Math.abs(sum/40000-base[channel])).toBeLessThan(1);
      }
      const chroma = Array.from({length:40000},(_,i)=>field[i*4+1]-field[i*4]);
      const alpha = overlay.reduce((s,v,i)=>s+(i%4===3?v:0),0)/25600;
      return {grain:Math.max(...chroma)-Math.min(...chroma), alpha};
    });
    expect(signals[1].grain).toBeGreaterThan(signals[0].grain*1.4);
    expect(signals[1].alpha).toBeGreaterThan(signals[0].alpha*1.4);
    // Main's unetched hatch: 33% coverage, peak alpha 205, linear strength.
    expect(signals[2].alpha).toBeGreaterThanOrEqual(.33*205*128/255-1);
    expect(signals[3].alpha).toBeGreaterThanOrEqual(.33*205-1);
  });
  it("keeps trace food quiet and reserves grain contrast for rich patches", () => {
    // Green minus red removes the neutral frost signal from the measured texture.
    const ranges = [0,1,6,12,128,255].map(level => {
      const [image] = paint(new Uint8Array(2500).fill(level));
      const chroma = Array.from({length:40000}, (_,i) => image[i*4+1]-image[i*4]);
      return Math.max(...chroma)-Math.min(...chroma);
    });
    expect(ranges[0]).toBe(0);
    expect(ranges[1]).toBeLessThanOrEqual(5);
    expect(ranges[2]).toBeGreaterThan(ranges[1]+5);
    expect(ranges[5]).toBeGreaterThan(ranges[4]*1.5);
    expect(ranges[4]).toBeGreaterThan(ranges[3]*1.5);
  });
  it("keeps trace hazard quiet without flattening moderate and severe stripes", () => {
    const peaks = [0,1,6,12,128,255].map(level => {
      const [, overlay] = paint(new Uint8Array(2500), new Uint8Array(2500).fill(level), true);
      return Math.max(...Array.from({length:25600}, (_,i) => overlay[i*4+3]));
    });
    expect(peaks[0]).toBe(0);
    expect(peaks[1]).toBeLessThanOrEqual(5);
    expect(peaks[2]).toBeGreaterThan(peaks[1]+5);
    expect(peaks[5]).toBeGreaterThan(peaks[4]*1.5);
    expect(peaks[4]).toBeGreaterThan(peaks[3]*1.5);
  });
  afterEach(() => vi.unstubAllGlobals());
  it("renders distinct normalized resource levels with spatial 5-cell grain", () => {
    const a = new Uint8Array(2500).fill(150), b = new Uint8Array(2500).fill(235);
    const first = paint(a)[0], second = paint(b)[0];
    expect(first.some((v, i) => i % 4 !== 3 && v > 0)).toBe(true);
    expect(Array.from(first)).not.toEqual(Array.from(second));
    const channel = (x: number, y: number) => first[(y * 200 + x) * 4 + 1];
    expect(channel(20, 20)).toBe(channel(40, 20));
    expect(channel(20, 20)).toBe(channel(20, 40));
  });
  it("renders grain across scarce-to-rich levels without changing world scale", () => {
    const levels = [0, 25, 75, 150, 235];
    const started = performance.now();
    const images = levels.map(level => paint(new Uint8Array(2500).fill(level))[0]);
    expect(performance.now() - started).toBeLessThan(5000);
    const signal = (image: Uint8ClampedArray) => image.reduce((sum, value, i) => sum + (i % 4 === 1 ? value : 0), 0);
    const means = images.map(image => signal(image) / (200 * 200));
    expect(means[0]).toBeLessThan(means[1]);
    expect(means[1]).toBeLessThan(means[2]);
    expect(means[2]).toBeLessThan(means[3]);
    expect(means[3]).toBeLessThan(means[4]);
    // Resource 75 is visibly textured (not merely a flat tint), while the
    // positions of grain features stay fixed as abundance changes.
    const scarce = images[2];
    const green = (x: number, y: number) => scarce[(y * 200 + x) * 4 + 1];
    expect(Math.max(...Array.from({ length: 200 }, (_, y) => Math.max(...Array.from({ length: 200 }, (_, x) => green(x,y))))) -
      Math.min(...Array.from({ length: 200 }, (_, y) => Math.min(...Array.from({ length: 200 }, (_, x) => green(x,y)))))).toBeGreaterThan(2);
    const rich = images[4];
    const textureDelta = (image: Uint8ClampedArray, x: number, y: number) => image[(y * 200 + x) * 4 + 1] - resourceFieldColor(75)[1];
    const point = (x: number, y: number) => textureDelta(scarce,x,y);
    const richDelta = (x: number, y: number) => rich[(y * 200 + x) * 4 + 1] - resourceFieldColor(235)[1];
    const signedCorrelation = Array.from({length: 200*200},(_,i)=>point(i%200,Math.floor(i/200))*richDelta(i%200,Math.floor(i/200))).reduce((a,b)=>a+b,0);
    expect(signedCorrelation).toBeGreaterThan(0);
  });
  it("footprint-averages grain when raster pixels span multiple mask texels", () => {
    const resources = new Uint8Array(2500).fill(75);
    const close = paint(resources, new Uint8Array(2500), false, {x:25,y:25,span:10})[0];
    const wide = paint(resources, new Uint8Array(2500), false, {x:25,y:25,span:50})[0];
    const variance = (image: Uint8ClampedArray) => {
      const values = Array.from({length:200*200},(_,i)=>image[i*4+1]);
      const mean = values.reduce((a,b)=>a+b,0)/values.length;
      return values.reduce((a,b)=>a+(b-mean)**2,0)/values.length;
    };
    expect(variance(wide)).toBeLessThan(variance(close));
  });
  it("uses sediment as a red/green aggregate and frost as quiet neutral grain", () => {
    const depleted=paint(new Uint8Array(2500))[0];
    const recovering=paint(new Uint8Array(2500).fill(25))[0];
    const green=(image:Uint8ClampedArray,i:number)=>image[i*4+1];
    const red=(image:Uint8ClampedArray,i:number)=>image[i*4];
    const greenBase=resourceFieldColor(25)[1], redBase=resourceFieldColor(25)[0];
    let positiveGreen=0,negativeRed=0,aggregatePixels=0;
    for(let i=0;i<40000;i++){
      const gd=green(recovering,i)-greenBase,rd=red(recovering,i)-redBase;
      if(gd>8){positiveGreen++;if(rd < -8)negativeRed++;aggregatePixels++;}
    }
    expect(aggregatePixels).toBeGreaterThan(1000);
    expect(negativeRed/positiveGreen).toBeGreaterThan(.8);
    const channelRange=(image:Uint8ClampedArray,channel:number)=>{
      let min=255,max=0;for(let i=0;i<40000;i++){const value=image[i*4+channel];min=Math.min(min,value);max=Math.max(max,value);}return max-min;
    };
    expect(channelRange(depleted,1)).toBeLessThanOrEqual(5);
    expect(channelRange(depleted,0)).toBeLessThanOrEqual(5);
  });
  it("retains grain detail at six food units at whole-world scale", () => {
    const [field] = paint(new Uint8Array(2500).fill(6));
    const green = Array.from({length: 40000}, (_, i) => field[i*4+1]);
    expect(Math.max(...green) - Math.min(...green)).toBeGreaterThanOrEqual(3);
  });
  it("draws low nonzero hazards with distinct stripes at whole-world scale", () => {
    const [, overlay] = paint(new Uint8Array(2500), new Uint8Array(2500).fill(12), true);
    const alpha = Array.from({length: 25600}, (_, i) => overlay[i*4+3]);
    expect(Math.max(...alpha)).toBeGreaterThanOrEqual(32);
    expect(Math.min(...alpha)).toBe(0);
  });
  it("keeps hazard alpha gaps transparent independently of food", () => {
    const hazards = new Uint8Array(2500).fill(255);
    const [food, hazard] = paint(new Uint8Array(2500).fill(150), hazards, true);
    expect(food[3]).toBe(255);
    expect(hazard.length).toBe(160*160*4);
    const alphas = Array.from({ length: hazard.length / 4 }, (_, i) => hazard[i * 4 + 3]);
    expect(alphas.some(a => a === 0)).toBe(true);
    expect(alphas.some(a => a > 0)).toBe(true);
  });
  it("keeps resource grain absent on depletion and brings it back with abundance", () => {
    expect(resourceGrainOffset(10, 20, 0)).toBe(0);
    expect(resourceGrainOffset(10, 20, 1)).not.toBe(0);
    expect(Math.abs(resourceGrainOffset(10, 20, 0.25))).toBeLessThan(Math.abs(resourceGrainOffset(10, 20, 1)));
  });
  it("uses deterministic periodic world-anchored grain", () => {
    const offset = resourceGrainOffset(10.25, 20.75, 1);
    expect(offset).toBeGreaterThan(0);
    expect(resourceGrainOffset(10.25, 20.75, 1)).toBe(offset);
    expect(resourceGrainOffset(15.25, 20.75, 1)).toBeCloseTo(offset, 5);
    expect(resourceGrainOffset(10.25, 25.75, 1)).toBeCloseTo(offset, 5);
    expect(resourceGrainOffset(11.25, 20.75, 1)).not.toBeCloseTo(offset, 5);
    expect(resourceGrainOffset(10.25, 21.75, 1)).not.toBeCloseTo(offset, 5);
    expect(resourceGrainOffset(10.25 + 50, 20.75, 1)).toBeCloseTo(offset, 5);
    expect(resourceGrainOffset(10.25, 20.75, 0)).toBe(0);
  });
  it("hatches only where hazard is present, with stronger values more visible", () => {
    expect(hazardHatchAlpha(0, 1, 0)).toBe(0);
    const points = [[0,0],[.2,0],[.5,0],[.1,.1]];
    const hatch = points.map(([x,y]) => hazardHatchAlpha(255,x,y));
    const low = points.map(([x,y]) => hazardHatchAlpha(12,x,y));
    expect(hatch.some(a => a > 0)).toBe(true);
    expect(Math.min(...hatch)).toBe(0);
    expect(Math.max(...hatch)).toBeGreaterThan(Math.min(...hatch));
    expect(low.every((a,i) => a <= hatch[i])).toBe(true);
  });
  it("keeps a localized food patch distinct from bare ground after zoom and pan", () => {
    const resources = new Uint8Array(2500);
    for (let y=15;y<25;y++) for (let x=16;x<26;x++) resources[y*50+x]=128;
    for (const camera of [{x:25,y:25,span:50},{x:23,y:20,span:20}]) {
      const [image]=paint(resources,new Uint8Array(2500),false,camera);
      const coverage=(left:number)=>{
        let food=0,count=0;
        for(let y=0;y<200;y++) for(let x=0;x<200;x++) {
          const wx=camera.x+((x+.5)/200-.5)*camera.span, wy=camera.y+((y+.5)/200-.5)*camera.span;
          if(wx<left || wx>=left+4 || wy<17 || wy>=22) continue;
          const i=(200*y+x)*4; if(image[i+1]>image[i]+18) food++; count++;
        }
        expect(count).toBeGreaterThan(0); return food/count;
      };
      expect(coverage(18)).toBeGreaterThan(.5);
      expect(coverage(28)).toBe(0);
    }
  });
  it("expands clustered green-bed raster coverage as food rises", () => {
    const levels = [0, 25, 75, 128, 255];
    const rasters = levels.map(level => paint(new Uint8Array(2500).fill(level))[0]);
    // Count visibly green pixels, not average channel tint: exposed sand must
    // remain outside the green-bed footprint at low and intermediate food.
    const coverage = (image: Uint8ClampedArray) => {
      let green = 0;
      for (let i = 0; i < 40000; i++) {
        if (image[i * 4 + 1] > image[i * 4] + 18) green++;
      }
      return green / 40000;
    };
    const areas = rasters.map(coverage);
    expect(areas[0]).toBe(0);
    expect(areas[1]).toBeGreaterThan(areas[0] + 0.05);
    expect(areas[2]).toBeGreaterThan(areas[1] + 0.05);
    expect(areas[3]).toBeGreaterThan(areas[2] + 0.05);
    expect(areas[4]).toBeGreaterThan(areas[3] + 0.05);
  });
  it("makes low and mid food raster coverage read green against warm exposed sediment", () => {
    const levels = [0, 25, 75, 128, 255];
    const rasters = levels.map(level => paint(new Uint8Array(2500).fill(level))[0]);
    const mean = (image: Uint8ClampedArray, channel: number) => image.reduce((sum, value, i) => sum + (i % 4 === channel ? value : 0), 0) / 40000;
    const colors = rasters.map(image => [mean(image, 0), mean(image, 1), mean(image, 2)]);
    expect(colors[0][0]).toBeGreaterThan(colors[0][1]);
    expect(colors[0][0] - colors[0][1]).toBeGreaterThan(20);
    expect(colors[1][1]).toBeGreaterThan(colors[1][0] + 10);
    expect(colors[2][1]).toBeGreaterThan(colors[2][0] + 25);
    expect(colors[3][1]).toBeGreaterThan(colors[1][1] + 8);
    expect(colors[3][1]).toBeGreaterThan(colors[3][2]);
    expect(colors[1][1]).toBeGreaterThan(colors[0][1] + 8);
  });
  it("maps resource levels to distinct but restrained field colors", () => {
    const depleted = resourceFieldColor(0), rich = resourceFieldColor(255);
    const distance = Math.hypot(rich[0] - depleted[0], rich[1] - depleted[1], rich[2] - depleted[2]);
    expect(distance).toBeGreaterThanOrEqual(60);
    expect(rich[1]).toBeGreaterThan(depleted[1]);
    expect(rich[2]).toBeGreaterThan(depleted[2]);
    expect(resourceFieldColor(128)[1]).toBeGreaterThan(depleted[1]);
    expect(resourceFieldColor(128)[1]).toBeLessThan(rich[1]);
  });
});
