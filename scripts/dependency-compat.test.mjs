import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);

test("the scoped patched glob preserves the OpenNext minifier's wildcard API", async t => {
  const coreRequire = createRequire(require.resolve("@node-minify/core"));
  // Older affected glob versions do not export their package.json subpath.
  let version;
  for (let directory = dirname(coreRequire.resolve("glob")); directory !== dirname(directory); directory = dirname(directory)) {
    try {
      const metadata = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
      if (metadata.name === "glob") { version = metadata.version; break; }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  assert.ok(version, "Could not locate the resolved glob package metadata");
  const [major, minor] = version.split(".").map(Number);
  assert.equal(major, 10);
  assert.ok(minor >= 5, `Expected patched glob 10.x, received ${version}`);

  const directory = await mkdtemp(join(tmpdir(), "lifepot-minifier-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "input-a.js"), "globalThis.lifePotA = 6;");
  await writeFile(join(directory, "input-b.js"), "globalThis.lifePotB = 7;");
  const output = join(directory, "output.js");
  await require("@node-minify/core")({
    compressor: require("@node-minify/terser"),
    input: join(directory, "input-*.js"),
    output,
  });
  // Evaluate only the generated output of the two trusted fixtures above.
  const context = {};
  runInNewContext(await readFile(output, "utf8"), context, { timeout: 1000 });
  assert.equal(context.lifePotA, 6);
  assert.equal(context.lifePotB, 7);
});
