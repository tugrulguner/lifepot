import { afterEach, describe, expect, it, vi } from "vitest";
import { hazardHatchAlpha, paintResourceField, resourceFieldColor, resourceGrainOffset } from "./microscopic-renderer";

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
