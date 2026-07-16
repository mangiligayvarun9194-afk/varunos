// twinmind — the Living Twin's behavior brain (Living Twin design §1).
// One pure decision: given the moment's context, what is the Twin doing?
// No animation ever fires without TwinMind's say-so — this is the law that
// keeps the Twin a companion instead of a screensaver.
//
//   decide(ctx) -> { id, family, priority } | null   (null = ambient floor)
//
// Priority ladder (highest wins, one performance at a time):
//   1 LIVE CO-TRAINING   — user is mid-workout in the app
//   2 EVENT PERFORMANCE  — user just logged something → react NOW
//   3 REMINDER RITUAL    — a due reminder (the Twin DEMONSTRATES, never nags)
//   4 ARRIVAL GREETING   — it notices you; never the full greeting twice a day
//   5 ambient (null)     — breath, weight shifts, glow: handled by the stage
//
// Pure: no Date.now(), no I/O — the caller supplies `now`. Node-tested.

// Exercise id → co-training performance family. Clip sources per design:
// squat/curl are baked mocap; deadlift/row/press ride the procedural bar rig;
// bench is the flagged hard shot; everything else rests (towel/breath beat).
const TRAIN_FAMILIES = [
  { re: /squat|lunge|goblet/, id: 'train.squat' },
  { re: /curl/, id: 'train.curl' },
  { re: /deadlift|rdl/, id: 'train.deadlift' },
  { re: /row/, id: 'train.row' },
  { re: /bench/, id: 'train.bench' },
  { re: /press|pushdown|raise|thrust/, id: 'train.press' },
];

// Ritual order: health first, then fuel, then movement, then rest.
const RITUAL_ORDER = ['medication', 'hydrate', 'meal', 'move', 'sleep'];

// Logged-event → instant reaction (kept in sync with the app's CustomEvents).
const EVENT_PERFS = {
  'workout-logged': 'event.celebrate',
  'protein-logged': 'event.shake',
  'meal-logged': 'event.mealnod',
  'checkin-logged': 'event.checkinwash',
};

export const EVENT_FRESH_MS = 10_000;      // events older than this are history
export const RETURN_NOD_MIN_MS = 30 * 60_000;  // re-greet (small) after 30 min away

export function trainFamily(exerciseId) {
  const id = String(exerciseId || '').toLowerCase();
  const hit = TRAIN_FAMILIES.find((f) => f.re.test(id));
  return hit ? hit.id : 'train.rest';
}

function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function arrivalId(now, streakWeeks) {
  if (streakWeeks >= 1 && streakWeeks * 7 >= 7) return 'arrival.streak';
  const h = now.getHours();
  if (h >= 4 && h < 12) return 'arrival.dawn';
  if (h >= 12 && h < 18) return 'arrival.day';
  return 'arrival.dusk';
}

/**
 * ctx = {
 *   now: Date,                      // required — never read the clock here
 *   quiet?: boolean,                // quiet hours: only ambient life
 *   liveWorkout?: { exerciseId },   // a set is in progress right now
 *   recentEvents?: [{ kind, at }],  // newest app events (Date `at`)
 *   pendingReminders?: [{ kind }],  // due rituals from the proactive engine
 *   lastSeenAt?: Date | null,       // previous app-open (null = first ever)
 *   streakDays?: number,
 * }
 */
export function decide(ctx) {
  const { now } = ctx;
  if (!now) return null;
  if (ctx.quiet) return null;                                   // rule 1 of restraint

  // 1 · live co-training
  if (ctx.liveWorkout && ctx.liveWorkout.exerciseId) {
    return { id: trainFamily(ctx.liveWorkout.exerciseId), family: 'train', priority: 1 };
  }

  // 2 · instant reactions to real events (freshest first, must be fresh)
  const fresh = (ctx.recentEvents || []).find(
    (e) => EVENT_PERFS[e.kind] && e.at && now - e.at <= EVENT_FRESH_MS
  );
  if (fresh) return { id: EVENT_PERFS[fresh.kind], family: 'event', priority: 2 };

  // 3 · reminder rituals — the highest-priority due ritual, demonstrated once
  const due = (ctx.pendingReminders || [])
    .filter((r) => RITUAL_ORDER.includes(r.kind))
    .sort((a, b) => RITUAL_ORDER.indexOf(a.kind) - RITUAL_ORDER.indexOf(b.kind))[0];
  if (due) return { id: `ritual.${due.kind}`, family: 'ritual', priority: 3 };

  // 4 · arrival — full greeting once per day; a small nod on returns ≥30 min
  const last = ctx.lastSeenAt || null;
  if (!last || dayKey(last) !== dayKey(now)) {
    const streakDays = ctx.streakDays || 0;
    return {
      id: streakDays >= 7 ? 'arrival.streak' : arrivalId(now, 0),
      family: 'arrival',
      priority: 4,
    };
  }
  if (now - last >= RETURN_NOD_MIN_MS) {
    return { id: 'arrival.return', family: 'arrival', priority: 4 };
  }

  // 5 · nothing earned a performance — the ambient floor keeps him alive
  return null;
}
