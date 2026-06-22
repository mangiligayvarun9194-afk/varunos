// Pure unit tests for the Form-Coach rep/angle engine.
// Run: node web/test/formcoach.test.mjs   (or: npm test, from web/)
// No camera or browser needed — the engine is fed synthetic angle sequences,
// which is exactly how the strength science (depth thresholds) is verified.
import { angleDeg, RepEngine, EXERCISES } from '../src/lib/formcoach.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const feed = (eng, t) => { let r; for (let i = 0; i < 8; i++) r = eng.step(t); return r; };

// --- geometry ---
ok(Math.round(angleDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })) === 180, 'straight line = 180°');
ok(Math.round(angleDeg({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })) === 90, 'right angle = 90°');
ok(angleDeg(null, { x: 0, y: 0 }, { x: 1, y: 0 }) === null, 'missing point → null');

// --- squat: 3 clean deep reps ---
const sq = new RepEngine('squat');
for (let n = 0; n < 3; n++) { feed(sq, 175); feed(sq, 80); } feed(sq, 175);
ok(sq.reps === 3, '3 deep squats counted (got ' + sq.reps + ')');
ok(sq.goodReps === 3, 'all 3 flagged good depth (got ' + sq.goodReps + ')');

// --- squat: a shallow rep still counts but is flagged ---
const sh = new RepEngine('squat'); let ev = null;
feed(sh, 175); feed(sh, 120);                 // dips below repStart(140) but above depthTarget(100)
for (let i = 0; i < 8; i++) { const r = sh.step(175); if (r.event) ev = r.event; }
ok(sh.reps === 1, 'shallow rep is counted (got ' + sh.reps + ')');
ok(sh.goodReps === 0, 'shallow rep not counted as good');
ok(ev && ev.type === 'shallow', 'shallow rep raises a coaching cue');

// --- a tiny bob above repStart is ignored (no phantom reps) ---
const tb = new RepEngine('squat'); feed(tb, 175);
for (let i = 0; i < 8; i++) tb.step(150);
ok(tb.reps === 0, 'sub-threshold movement does not count');

// --- curl + pushup count their deep reps ---
const cu = new RepEngine('curl'); feed(cu, 165); feed(cu, 45); feed(cu, 165);
ok(cu.reps === 1 && cu.goodReps === 1, 'curl deep rep (reps=' + cu.reps + ' good=' + cu.goodReps + ')');

const pu = new RepEngine('pushup'); feed(pu, 170); feed(pu, 80); let pe = null;
for (let i = 0; i < 8; i++) { const r = pu.step(170); if (r.event) pe = r.event; }
ok(pe && pe.type === 'good' && /Good rep/.test(pe.msg), 'pushup emits a good-rep event');

// --- every exercise config keeps repStart > depthTarget (so coaching can fire) ---
for (const e of Object.values(EXERCISES)) {
  ok(e.repStart > e.depthTarget && e.extended > e.repStart,
    `${e.id} thresholds ordered (extended>repStart>depthTarget)`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
