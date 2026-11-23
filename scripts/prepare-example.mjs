// Reuse a previously recorded public test world; never synthesize provider responses.
import { readFile, writeFile } from 'node:fs/promises';
const source = JSON.parse(await readFile('e2e/fixtures/my-worlds/pond-notebook.json', 'utf8'));
const endpoint = source.evidence.samples.at(-1);
await writeFile('public/example-world.json', JSON.stringify({
  name: 'The little pond', replay: source.replay,
  endpoint: { generation: endpoint.generation, population: endpoint.population, births: endpoint.births, deaths: endpoint.deaths, kills: endpoint.kills },
  provenance: 'Recorded engine run from e2e/fixtures/my-worlds/pond-notebook.json. Historical decisions are replayed; no fresh inference.'
}, null, 2) + '\n');
