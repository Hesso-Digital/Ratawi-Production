// Meshopt-compress the v3 CPF-1 / AG-25 GLBs into public/models and validate them.
// Usage: node scripts/blender/post_v3.mjs <raw_dir> <tools_dir>
// <tools_dir> has @gltf-transform/cli and gltf-validator installed (npm i in any folder).
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const [raw, tools] = process.argv.slice(2);
const require = createRequire(path.join(path.resolve(tools), 'package.json'));
const validator = require('gltf-validator');
const out = path.resolve('public/models');
const required = {
  cpf1: ['InletValve_1', 'InletValve_2', 'InletValve_3', 'Flame_Core', 'Flame_Tip', 'Pilot', 'AviationLights', 'MastLights', 'WindowLights', 'TankLights', 'cpf1_Dressing', 'SodiumLights'],
  ag25: ['GasLights', 'MastLights', 'Flame_Core', 'Flame_Tip', 'Pilot', 'AviationLights', 'ag25_Dressing', 'SodiumLights'],
};
const cli = path.join(path.resolve(tools), 'node_modules', '.bin', 'gltf-transform');
for (const name of Object.keys(required)) {
  const src = path.join(raw, `${name}.glb`);
  const dst = path.join(out, `${name}.glb`);
  execFileSync(cli, ['meshopt', src, dst, '--level', 'high'], { stdio: 'inherit' });
  const bytes = new Uint8Array(readFileSync(dst));
  const report = await validator.validateBytes(bytes, { maxIssues: 50 });
  const len = new DataView(bytes.buffer).getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + len)));
  const names = json.nodes.map((n) => n.name);
  const missing = required[name].filter((n) => !names.includes(n));
  console.log(`${name}: ${(statSync(dst).size / 1024).toFixed(0)} KB, errors ${report.issues.numErrors}, warnings ${report.issues.numWarnings}, missing [${missing.join(', ')}]`);
  if (report.issues.numErrors || missing.length) process.exitCode = 1;
}
