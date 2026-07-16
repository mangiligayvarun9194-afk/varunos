// Tests for the Twin's living gestures — pure clip generators.
// Run: node web/test/twinacts.test.mjs
import {
  clipGreeting, clipCelebrate, clipShake, CLIPS, listClips, PARTS,
} from '../src/lib/twinacts.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

const CHANNELS = ['rx', 'ry', 'rz'];
const flat = (pose) => {
  const out = [];
  for (const part of PARTS) for (const ch of CHANNELS) out.push(pose[part][ch]);
  return out;
};

const EXPECT = [
  [clipGreeting, 'greeting', 4],
  [clipCelebrate, 'celebrate', 2.6],
  [clipShake, 'shake', 5],
];

for (const [factory, id, duration] of EXPECT) {
  const clip = factory();

  // --- metadata ---
  ok(clip.id === id, `${id}: id field`);
  ok(clip.duration === duration, `${id}: duration ${duration}s`);
  ok(clip.loop === false, `${id}: loop false`);
  ok(typeof clip.poseAt === 'function', `${id}: poseAt is a function`);

  // --- all 9 parts present, every channel finite and bounded ---
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const p = clip.poseAt(t);
    ok(PARTS.every((k) => p[k] && CHANNELS.every((c) => typeof p[k][c] === 'number')),
      `${id}: all parts/channels present at t=${t}`);
    ok(flat(p).every((v) => Number.isFinite(v) && Math.abs(v) <= 0.9),
      `${id}: channels finite and |v|<=0.9 at t=${t}`);
  }

  // --- continuity sweep: 101 samples, max per-channel step < 0.15 rad ---
  {
    let maxStep = 0;
    let prev = flat(clip.poseAt(0));
    for (let i = 1; i <= 100; i++) {
      const cur = flat(clip.poseAt(i / 100));
      for (let j = 0; j < cur.length; j++) {
        maxStep = Math.max(maxStep, Math.abs(cur[j] - prev[j]));
      }
      prev = cur;
    }
    ok(maxStep < 0.15, `${id}: continuous (max step ${maxStep.toFixed(3)} < 0.15)`);
  }

  // --- neutral start and end ---
  ok(flat(clip.poseAt(0)).every((v) => Math.abs(v) < 0.02), `${id}: starts neutral`);
  ok(flat(clip.poseAt(1)).every((v) => Math.abs(v) < 0.02), `${id}: ends neutral`);

  // --- determinism: two fresh clips agree everywhere sampled ---
  {
    const other = factory();
    let same = true;
    for (const t of [0, 0.13, 0.37, 0.5, 0.62, 0.88, 1]) {
      if (JSON.stringify(clip.poseAt(t)) !== JSON.stringify(other.poseAt(t))) same = false;
    }
    ok(same, `${id}: deterministic across instances`);
  }

  // --- actually moves (not a null clip) ---
  {
    let peak = 0;
    for (let i = 0; i <= 100; i++) {
      peak = Math.max(peak, ...flat(clip.poseAt(i / 100)).map(Math.abs));
    }
    ok(peak > 0.15, `${id}: has real motion (peak ${peak.toFixed(2)})`);
  }
}

// --- shake: right arm works, left arm rests ---
{
  const clip = clipShake();
  let right = 0, left = 0;
  for (let i = 0; i <= 200; i++) {
    const p = clip.poseAt(i / 200);
    for (const ch of CHANNELS) {
      right = Math.max(right, Math.abs(p.rArm[ch]), Math.abs(p.rForeArm[ch]));
      left = Math.max(left, Math.abs(p.lArm[ch]), Math.abs(p.lForeArm[ch]));
    }
  }
  ok(right > left + 0.3, `shake: right arm peak (${right.toFixed(2)}) exceeds left (${left.toFixed(2)})`);
  ok(left < 0.05, 'shake: left side stays near neutral');
  ok(right > 0.5, 'shake: right arm actually raises');
}

// --- celebrate: >= 2 arm pumps (local extrema of rArm.rz above threshold) ---
{
  const clip = clipCelebrate();
  const v = [];
  for (let i = 0; i <= 200; i++) v.push(clip.poseAt(i / 200).rArm.rz);
  let peaks = 0;
  for (let i = 1; i < 200; i++) {
    const d0 = v[i] - v[i - 1];
    const d1 = v[i + 1] - v[i];
    if (d0 * d1 < 0 && Math.abs(v[i]) > 0.2) peaks++; // derivative sign change at real amplitude
  }
  ok(peaks >= 2, `celebrate: >=2 arm pumps (found ${peaks})`);
}

// --- nod: the small same-day return greeting ---
{
  const nod = CLIPS.nod();
  ok(nod.duration <= 1.2, 'nod is quick — an acknowledgement, not a ceremony');
  const mid = nod.poseAt(0.4);
  ok(mid.head.rx > 0.08 && mid.head.rx <= 0.2, `nod dips the head gently (${mid.head.rx.toFixed(2)} rad)`);
  const start = nod.poseAt(0), end = nod.poseAt(1);
  ok(Math.abs(start.head.rx) < 1e-6 && Math.abs(end.head.rx) < 1e-6, 'nod starts and ends at neutral');
  ok(Math.abs(mid.lArm.rz) < 1e-6, 'nod never moves the arms — head and a hint of spine only');
}

// --- registry ---
ok(CLIPS.greeting === clipGreeting && CLIPS.celebrate === clipCelebrate && CLIPS.shake === clipShake,
  'CLIPS maps ids to factories');
{
  const ids = listClips();
  ok(Array.isArray(ids) && ids.length === 4
    && ['greeting', 'celebrate', 'shake', 'nod'].every((k) => ids.includes(k)),
    'listClips returns all four ids');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
