import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const port = () => new Promise((resolve, reject) => {
  const server = createServer(); server.on("error", reject);
  server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); });
});
const application = await port(), inspector = await port();
const config = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
config.name = "lifepot-delivery-test";
config.main = resolve(config.main);
config.assets.directory = resolve(config.assets.directory);
config.services = config.services.map(service => service.binding === "WORKER_SELF_REFERENCE" ? { ...service, service: config.name } : service);
delete config.routes;
const configPath = resolve(".open-next/delivery-test.json");
await writeFile(configPath, JSON.stringify(config));
const origin = `http://127.0.0.1:${application}`;
const environment = { ...process.env, WRANGLER_SEND_METRICS: "false", PLAYWRIGHT_BASE_URL: origin, LIFEPOT_WORKER_DELIVERY: "1" };
delete environment.LIFEPOT_LIVE_GAMEPLAY_BASE_URL;
const worker = spawn(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "dev", "--local", "--config", configPath, "--port", String(application), "--inspector-port", String(inspector)], { stdio: "inherit", detached: process.platform !== "win32", env: environment });
function stopWorker() {
  try { if (process.platform === "win32") worker.kill(); else process.kill(-worker.pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; }
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { stopWorker(); process.exit(1); });
try {
  let ready = false;
  const manifest = JSON.parse(await readFile(".open-next/delivery-manifest.json", "utf8"));
  const expected = await readFile(`.open-next/assets${manifest["/"].asset}`);
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (worker.exitCode !== null || worker.signalCode !== null) throw new Error("Fixture Worker exited before readiness");
    try { const response = await fetch(origin, { signal: AbortSignal.timeout(1000) }); ready = response.status === 200 && Buffer.from(await response.arrayBuffer()).equals(expected); } catch { /* Startup is bounded above. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error("Fixture did not serve the exact prepared homepage");
  const specs = process.argv.includes("--all") ? [] : ["e2e/worker-delivery.spec.ts", "e2e/product-demo.spec.ts", "e2e/product-demo-presentation.spec.ts"];
  const runner = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...specs, "--workers=1", "--retries=0", ...process.argv.slice(2).filter(value => value !== "--all")], { stdio: "inherit", env: environment });
  process.exitCode = await new Promise((resolve, reject) => { runner.once("error", reject); runner.once("exit", (code, signal) => resolve(signal ? 1 : code ?? 1)); });
} finally { stopWorker(); }
