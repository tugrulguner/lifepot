import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it.each(['ci.yml', 'deploy-website.yml'])(
  '%s runs the complete unit suite with the qualified two-worker budget before building',
  (name) => {
    const workflow = readFileSync(`.github/workflows/${name}`, 'utf8');
    const commands = [...workflow.matchAll(/^\s+- run: (.+)$/gm)].map(match => match[1]);
    const unitCommands = commands.filter(command => /^npm test(?:\s|$)/.test(command));
    // Exact command preserves the whole suite and default assertion deadlines:
    // no file filter, retry, timeout override, or shell failure suppression.
    expect(unitCommands).toEqual(['npm test -- --maxWorkers=2']);
    expect(commands.indexOf(unitCommands[0])).toBeLessThan(commands.indexOf('npm run build:cloudflare'));
  },
);
