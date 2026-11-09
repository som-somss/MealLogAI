import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const ignored = new Set(['.git', '.vercel', 'node_modules', 'artifacts']);
function scripts(directory) {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    if (ignored.has(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? scripts(path) : /\.(m?js)$/.test(entry.name) ? [path] : [];
  });
}
const files = scripts('.');
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {stdio: 'inherit'});
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Syntax checks passed: ${files.length} JavaScript files.`);
