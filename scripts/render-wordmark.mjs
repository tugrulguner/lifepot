import { chromium } from "playwright";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const svg = await readFile(resolve(root, "assets/lifepot.svg"), "utf8");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;width:1200px;height:900px}</style>${svg}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: "png", fullPage: false, animations: "disabled" });
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 1200 || info.height !== 900) throw new Error(`Expected 1200x900, got ${info.width}x${info.height}`);
  const pixel = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
  const countColour = (box, colour) => {
    let count = 0;
    for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) {
      if (pixel(x, y).every((channel, index) => channel === colour[index])) count++;
    }
    return count;
  };
  if (countColour([514, 320, 690, 480], [244, 242, 234]) < 1000) throw new Error("Off-white wordmark prefix missing from raster");
  if (countColour([688, 320, 875, 480], [242, 184, 75]) < 1000) throw new Error("Amber wordmark suffix missing from raster");
  const previousSvg = execFileSync("git", ["show", "HEAD:assets/lifepot.svg"], { encoding: "utf8" });
  const mark = (text) => text.match(/<g transform="translate\(98 270\) scale\(2\.75\)">[\s\S]*?<\/g>/)?.[0];
  if (!mark(previousSvg) || mark(previousSvg) !== mark(svg)) throw new Error("Compact mint mark geometry or colour changed");
  for (const path of ["lifepot.png", "public/lifepot-lockup.png"]) await writeFile(resolve(root, path), png);
  const webp = await sharp(png).webp({ quality: 92 }).toBuffer();
  await writeFile(resolve(root, "public/lifepot-lockup.webp"), webp);
} finally { await browser.close(); }
