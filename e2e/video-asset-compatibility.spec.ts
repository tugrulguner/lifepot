import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { demoVideo, legacyDemoVideo } from "../src/lib/demo-video";
test("compressed walkthrough and existing immutable link return their own exact ranges",async ({request})=>{
  for(const video of [demoVideo,legacyDemoVideo]){
    const bytes=await readFile(`public${video.asset}`);
    for(const [start,end] of [[0,1023],[video.size-1024,video.size-1]]){
      const response=await request.get(video.route,{headers:{Range:`bytes=${start}-${end}`}});
      expect(response.status()).toBe(206);
      expect(response.headers()["content-range"]).toBe(`bytes ${start}-${end}/${video.size}`);
      expect(response.headers()["etag"]).toBe(video.etag);
      expect((await response.body()).equals(bytes.subarray(start,end+1))).toBe(true);
    }
    const head=await request.head(video.route);expect(head.status()).toBe(200);expect((await head.body()).length).toBe(0);
    const unchanged=await request.get(video.route,{headers:{"If-None-Match":video.etag}});expect(unchanged.status()).toBe(304);
  }
});
