// Tests for the on-device muscle classifier. Verifies the pure-JS inference
// reproduces the trained model on real held-out feature vectors exported from
// the Python training run (web/test/muscle_samples.json).
// Run: node web/test/musclenet.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classify, featurize, MUSCLE_LABEL } from '../src/lib/musclenet.js';

const here = dirname(fileURLToPath(import.meta.url));
const samples = JSON.parse(readFileSync(join(here, 'muscle_samples.json'), 'utf8'));
const MODEL = JSON.parse(readFileSync(join(here, '../src/lib/muscle_model.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

// each exported sample is a real frame's 99-d feature vector + its true class
for (const s of samples) {
  const r = classify(MODEL, s.features);
  ok(r && r.label === s.class, `classifies ${s.class} (got ${r && r.label})`);
  ok(r && r.confidence > 0.5, `${s.class} confident (${r && r.confidence.toFixed(2)})`);
}

// probabilities form a distribution
const r0 = classify(MODEL, samples[0].features);
const sum = r0.probs.reduce((a, b) => a + b, 0);
ok(Math.abs(sum - 1) < 1e-6, 'softmax sums to 1');

// every class has a friendly label
for (const s of samples) ok(!!MUSCLE_LABEL[s.class], `label exists for ${s.class}`);

// featurize is translation-invariant: shifting every landmark gives same result
const fakeLm = Array.from({ length: 33 }, (_, i) => ({ x: 0.4 + i * 0.01, y: 0.3 + i * 0.012, z: 0.01 * i }));
const a = featurize(fakeLm);
const shifted = fakeLm.map((p) => ({ x: p.x + 0.25, y: p.y - 0.1, z: p.z }));
const b = featurize(shifted);
ok(a && b && a.every((v, i) => Math.abs(v - b[i]) < 1e-9), 'featurize is translation-invariant');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
