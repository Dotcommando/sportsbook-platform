import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { composeSubgraphs, composeWithRover, exportSubgraphs } from './composition.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));

const args = process.argv.slice(2);

if (args.length !== 1 || !['--compose', '--check', '--check-rover'].includes(args[0] ?? '')) {
  throw new Error('Use --compose, --check or --check-rover');
}

if (args[0] === '--compose') {
  await composeWithRover(root);
} else {
  exportSubgraphs(root, true);
  composeSubgraphs(root);

  if (args[0] === '--check-rover') {
    await composeWithRover(root, true);
  }
}

console.log(
  'Federation schemas and '
  + (args[0] === '--check' ? 'composition compatibility' : 'pinned Rover artifact')
  + ' verified: '
  + path.join(root, 'infra/router'),
);
