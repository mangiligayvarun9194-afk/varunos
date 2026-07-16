// Pure unit tests for TwinMind — the Living Twin's behavior brain.
// Run: node web/test/twinmind.test.mjs
import { decide, trainFamily, EVENT_FRESH_MS, RETURN_NOD_MIN_MS } from '../src/lib/twinmind.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

const T = (h = 9) => new Date(2026, 6, 16, h, 0, 0);   // a fixed local morning

// --- restraint: quiet hours silence everything ---
ok(decide({ now: T(), quiet: true, liveWorkout: { exerciseId: 'squat' } }) === null,
  'quiet hours beat even a live workout');
ok(decide({}) === null, 'missing now → null, never throws');

// --- priority 1: live co-training ---
ok(decide({ now: T(), liveWorkout: { exerciseId: 'back_squat' } }).id === 'train.squat', 'squat family');
ok(decide({ now: T(), liveWorkout: { exerciseId: 'bicep_curl' } }).id === 'train.curl', 'curl family');
ok(decide({ now: T(), liveWorkout: { exerciseId: 'bench_press' } }).id === 'train.bench', 'bench family');
ok(decide({ now: T(), liveWorkout: { exerciseId: 'lat_pulldown' } }).id === 'train.rest', 'unknown lift → rest beat');
ok(trainFamily('overhead_press') === 'train.press', 'press family via helper');

// workout outranks a due ritual AND a fresh event
const busy = decide({
  now: T(),
  liveWorkout: { exerciseId: 'squat' },
  recentEvents: [{ kind: 'meal-logged', at: T() }],
  pendingReminders: [{ kind: 'medication' }],
});
ok(busy.id === 'train.squat' && busy.priority === 1, 'live workout wins the ladder');

// --- priority 2: fresh events ---
const evt = decide({ now: T(), recentEvents: [{ kind: 'workout-logged', at: new Date(T() - 3000) }] });
ok(evt.id === 'event.celebrate', 'workout logged → celebration');
ok(decide({ now: T(), recentEvents: [{ kind: 'protein-logged', at: T() }] }).id === 'event.shake',
  'protein logged → shake ritual');
ok(decide({ now: T(), recentEvents: [{ kind: 'workout-logged', at: new Date(T() - EVENT_FRESH_MS - 1) }], lastSeenAt: T() }) === null,
  'stale events are history, not theatre');

// event beats ritual
const evVsRit = decide({
  now: T(),
  recentEvents: [{ kind: 'meal-logged', at: T() }],
  pendingReminders: [{ kind: 'hydrate' }],
});
ok(evVsRit.id === 'event.mealnod', 'fresh event outranks a due ritual');

// --- priority 3: rituals, health first ---
const med = decide({ now: T(), pendingReminders: [{ kind: 'hydrate' }, { kind: 'medication' }], lastSeenAt: T() });
ok(med.id === 'ritual.medication', 'medication outranks hydration');
ok(decide({ now: T(), pendingReminders: [{ kind: 'sleep' }, { kind: 'move' }], lastSeenAt: T() }).id === 'ritual.move',
  'move outranks sleep');
ok(decide({ now: T(), pendingReminders: [{ kind: 'unknown-thing' }], lastSeenAt: T() }) === null,
  'unknown reminder kinds are ignored, not performed');

// --- priority 4: arrival ---
ok(decide({ now: T(8) }).id === 'arrival.dawn', 'first-ever open at 8am → dawn greeting');
ok(decide({ now: T(14), lastSeenAt: new Date(2026, 6, 15, 20) }).id === 'arrival.day', 'new day at 2pm → day greeting');
ok(decide({ now: T(21), lastSeenAt: new Date(2026, 6, 15, 20) }).id === 'arrival.dusk', 'new day at 9pm → dusk greeting');
ok(decide({ now: T(8), streakDays: 9 }).id === 'arrival.streak', '7d+ streak upgrades the greeting');
const backSoon = decide({ now: T(9), lastSeenAt: new Date(T(9) - RETURN_NOD_MIN_MS + 60_000) });
ok(backSoon === null, 'reopening within 30 min → just ambient (no re-greeting spam)');
const backLater = decide({ now: T(15), lastSeenAt: T(9) });
ok(backLater.id === 'arrival.return', 'same day, hours later → small return nod');

// --- priority 5: the floor ---
ok(decide({ now: T(9), lastSeenAt: new Date(T(9) - 60_000) }) === null, 'nothing earned → ambient floor');

console.log(`\ntwinmind: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
