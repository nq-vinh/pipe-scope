import { spawnSync } from 'node:child_process';

const argumentsForAngular = process.argv
  .slice(2)
  .flatMap((argument) => (argument === '--run' ? ['--watch=false'] : [argument]));
const result = spawnSync(
  process.execPath,
  ['node_modules/@angular/cli/bin/ng.js', 'test', ...argumentsForAngular],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
