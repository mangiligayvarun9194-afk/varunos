// Log: quick-capture tiles + the five sheets. All flows preserved from the
// legacy PWA: beat-this prefill, plate calculator, rest timer, PR confetti,
// quick foods, search, BP/glucose escalation, 6-tap check-in.
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api, mealContext, plateText } from '../api.js';
import { Sheet, PickRow, Stepper, useToast, confettiBurst, stagger, rise } from '../components/ui.jsx';
import { IconBarbell, IconFork, IconHeart, IconDrop, IconClipboard, IconArrow } from '../components/Icons.jsx';

const TILES = [
  { id: 'workout', Icon: IconBarbell, title: 'Log workout set', sub: 'Auto-detects PRs' },
  { id: 'meal', Icon: IconFork, title: 'Log meal', sub: 'Search the food database; macros auto-computed' },
  { id: 'bp', Icon: IconHeart, title: 'Log BP reading', sub: 'Escalates if hypertensive crisis' },
  { id: 'glucose', Icon: IconDrop, title: 'Log glucose', sub: 'Indian-context thresholds' },
  { id: 'checkin', Icon: IconClipboard, title: 'Daily check-in', sub: 'Updates your readiness score' },
];

export default function Log({ sheet, onOpenSheet, onCloseSheet, onTab }) {
  const [meals, setMeals] = useState(null);
  const [workouts, setWorkouts] = useState(null);

  async function refresh() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const m = await api('/v1/logs/meals?limit=50');
      setMeals((m.meals || []).filter((x) => x.ts?.startsWith(today)));
    } catch (e) { setMeals({ error: e.message }); }
    try {
      const w = await api('/v1/logs/workouts?limit=5');
      setWorkouts(w.workouts || []);
    } catch (e) { setWorkouts({ error: e.message }); }
  }
  useEffect(() => { refresh(); }, [sheet]); // refresh when a sheet closes

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={rise} style={{ margin: '26px 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 className="display" style={{ fontSize: 30, fontWeight: 700 }}>Log</h2>
          <p className="meta">Quick capture, anywhere</p>
        </div>
        <button className="btn ghost" style={{ fontSize: 13, whiteSpace: 'nowrap' }}
          onClick={() => onTab && onTab('library')}>📚 Form library</button>
      </motion.div>

      {TILES.map(({ id, Icon, title, sub }) => (
        <motion.div key={id} variants={rise}>
          <motion.div whileTap={{ scale: 0.98 }} className="card"
            style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', marginBottom: 10 }}
            onClick={() => onOpenSheet(id)}>
            <span style={{
              width: 42, height: 42, borderRadius: 13, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--mint-dim)', color: 'var(--mint)', border: '1px solid rgba(245,181,114,0.2)',
            }}><Icon width={20} height={20} /></span>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 15 }}>{title}</h3>
              <p className="meta" style={{ fontSize: 12 }}>{sub}</p>
            </div>
            <span style={{ color: 'var(--mute)' }}><IconArrow width={16} height={16} /></span>
          </motion.div>
        </motion.div>
      ))}

      <motion.div variants={rise}>
        <div className="micro">Today's meals</div>
        {!meals && <div className="skel" style={{ height: 60, borderRadius: 16 }} />}
        {meals?.error && <p className="err">{meals.error}</p>}
        {Array.isArray(meals) && meals.length === 0 && <div className="empty">No meals logged today.</div>}
        {Array.isArray(meals) && meals.length > 0 && (
          <>
            {meals.map((m, i) => (
              <div key={i} className="card" style={{ padding: '10px 15px', marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{m.food_id.replace(/_/g, ' ')}
                    <span className="meta" style={{ marginLeft: 8 }}>{m.context || ''}</span></span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{Math.round(m.kcal)} kcal</span>
                </div>
                <span className="meta" style={{ fontSize: 12 }}>P{Math.round(m.p_g)}g C{Math.round(m.c_g)}g F{Math.round(m.f_g)}g · {m.portions}×</span>
              </div>
            ))}
            <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--mint)', fontWeight: 650, marginTop: 6 }}>
              Total: {Math.round(meals.reduce((s, m) => s + (m.kcal || 0), 0))} kcal
            </div>
          </>
        )}
      </motion.div>

      <motion.div variants={rise}>
        <div className="micro">Recent workouts</div>
        {!workouts && <div className="skel" style={{ height: 60, borderRadius: 16 }} />}
        {workouts?.error && <p className="err">{workouts.error}</p>}
        {Array.isArray(workouts) && workouts.length === 0 && <div className="empty">No workouts logged yet.</div>}
        {Array.isArray(workouts) && workouts.map((w, i) => (
          <div key={i} className="card" style={{ padding: '10px 15px', marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{w.day_name} · {w.program}</span>
              <span className="meta">{w.ts?.slice(0, 10)}</span>
            </div>
            <span className="meta" style={{ fontSize: 12 }}>{w.decision}{w.duration_min ? ` · ${w.duration_min} min` : ''}</span>
          </div>
        ))}
      </motion.div>

      {/* sheets */}
      <Sheet open={sheet === 'checkin'} onClose={onCloseSheet} title="Morning check-in">
        <CheckinSheet onDone={() => { onCloseSheet(); onTab('today'); }} />
      </Sheet>
      <Sheet open={sheet === 'workout'} onClose={onCloseSheet} title="Log your workout">
        <WorkoutSheet />
      </Sheet>
      <Sheet open={sheet === 'meal'} onClose={onCloseSheet} title="Log a meal">
        <MealSheet />
      </Sheet>
      <Sheet open={sheet === 'bp'} onClose={onCloseSheet} title="Log blood pressure">
        <BPSheet />
      </Sheet>
      <Sheet open={sheet === 'glucose'} onClose={onCloseSheet} title="Log glucose">
        <GlucoseSheet />
      </Sheet>
    </motion.div>
  );
}

/* ================= Check-in ================= */
const Q = [
  ['sleep_quality', 'How rested do you feel?', [['😫', 'Awful'], ['😕', 'Poor'], ['😐', 'OK'], ['🙂', 'Good'], ['😄', 'Great']]],
  ['energy', 'Energy level?', [['🪫', 'Drained'], ['😪', 'Low'], ['😐', 'OK'], ['💪', 'Good'], ['⚡', 'High']]],
  ['soreness', 'Muscle soreness?', [['😌', 'None'], ['🙂', 'Mild'], ['😐', 'Some'], ['😣', 'Sore'], ['🥵', 'Very']]],
  ['mood', 'Mood?', [['😞', 'Low'], ['😕', 'Meh'], ['😐', 'OK'], ['🙂', 'Good'], ['😄', 'Great']]],
  ['stress', 'Stress level?', [['😌', 'Calm'], ['🙂', 'Light'], ['😐', 'Some'], ['😟', 'High'], ['😰', 'Maxed']]],
];

export function CheckinSheet({ onDone }) {
  const [picks, setPicks] = useState({ sleep_hours: 7, sleep_quality: 0, energy: 0, soreness: 0, mood: 0, stress: 0 });
  const [state, setState] = useState({}); // {err} | {busy} | {result}

  async function submit() {
    const missing = Q.filter(([k]) => !picks[k]).map(([, label]) => label.replace('?', '').toLowerCase());
    if (missing.length) return setState({ err: 'Please answer: ' + missing.join(', ') });
    setState({ busy: true });
    try {
      const r = await api('/v1/readiness/simple', { method: 'POST', body: {
        sleep_hours: picks.sleep_hours, sleep_quality_1to5: picks.sleep_quality,
        energy_1to5: picks.energy, soreness_1to5: picks.soreness,
        mood_1to5: picks.mood, stress_1to5: picks.stress,
      }});
      await api('/v1/logs/checkins', { method: 'POST', body: {
        sleep_min: Math.round(picks.sleep_hours * 60),
        sleep_eff_pct: 55 + picks.sleep_quality * 9,
        energy_1to5: picks.energy, soreness_1to5: picks.soreness,
        mood_1to5: picks.mood, stress_1to5: picks.stress,
      }});
      setState({ result: r });
    } catch (e) { setState({ err: e.message }); }
  }

  if (state.result) {
    const r = state.result;
    const tone = r.color === 'GREEN' ? 'var(--green)' : r.color === 'YELLOW' ? 'var(--amber)' : 'var(--red)';
    const headline = { GREEN: 'Green day — go for it', YELLOW: 'Yellow day — pull back a little', RED: 'Red day — recover today' }[r.color];
    const advice = {
      GREEN: "Your body is recovered. Push hard on today's session.",
      YELLOW: 'Train, but cut a set or two and keep RPE in check.',
      RED: 'Skip the heavy stuff. Walk, stretch, sleep early.',
    }[r.color];
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="card" style={{ borderColor: `${tone}55`, boxShadow: `var(--shadow), 0 0 48px -16px ${tone}66`, textAlign: 'center', padding: 26 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Readiness</div>
          <div className="display mono" style={{ fontSize: 60, fontWeight: 700, color: tone, lineHeight: 1.1 }}>{Math.round(r.overall)}</div>
          <div className="display" style={{ fontSize: 16, fontWeight: 650, color: tone, marginBottom: 12 }}>{headline}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
            {Object.entries(r.components).map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{k}</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{Math.round(v)}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="meta" style={{ margin: '14px 0' }}>{advice}</p>
        <button className="btn primary full" onClick={onDone}>Done</button>
      </motion.div>
    );
  }

  return (
    <div>
      <p className="meta" style={{ marginBottom: 20 }}>Six quick taps — no smartwatch needed.</p>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 650, fontFamily: 'var(--font-display)', marginBottom: 8 }}>How long did you sleep?</div>
        <div className="display mono" style={{ fontSize: 32, fontWeight: 700, textAlign: 'center', color: 'var(--mint)', marginBottom: 6 }}>
          {picks.sleep_hours} <small style={{ fontSize: 14, color: 'var(--dim)' }}>hrs</small>
        </div>
        <input type="range" className="vslider" min="3" max="10" step="0.5" value={picks.sleep_hours}
          onChange={(e) => setPicks({ ...picks, sleep_hours: parseFloat(e.target.value) })} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--mute)', marginTop: 6 }}><span>3h</span><span>10h</span></div>
      </div>
      {Q.map(([key, label, options]) => (
        <div key={key} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 650, fontFamily: 'var(--font-display)', marginBottom: 10 }}>{label}</div>
          <PickRow options={options} value={picks[key]} onChange={(v) => setPicks({ ...picks, [key]: v })} />
        </div>
      ))}
      {state.err && <p className="err" style={{ marginBottom: 10 }}>{state.err}</p>}
      <button className="btn primary full" style={{ padding: 16 }} disabled={state.busy} onClick={submit}>
        {state.busy ? 'Computing…' : 'See my readiness'}
      </button>
    </div>
  );
}

/* ================= Workout logger ================= */
function WorkoutSheet() {
  const [plan, setPlan] = useState(undefined);
  const [last, setLast] = useState({});
  useEffect(() => {
    (async () => {
      try {
        const wake = await api('/v1/wakeup');
        if (!wake.workout) throw new Error('No plan for today');
        setPlan(wake.workout);
        try { setLast((await api('/v1/logs/sets/last')).last_sets || {}); } catch (_) {}
      } catch (e) { setPlan({ error: e.message }); }
    })();
  }, []);

  if (plan === undefined) return <div className="skel" style={{ height: 120, borderRadius: 16 }} />;
  if (plan.error) return <p className="err">{plan.error}</p>;
  return (
    <div>
      <p className="meta" style={{ marginBottom: 14 }}>{plan.day_name} · {plan.program} — tap an exercise, adjust, log each set.</p>
      {plan.exercises.map((ex) => <ExerciseCard key={ex.id} ex={ex} prev={last[ex.id]} plan={plan} />)}
    </div>
  );
}

function ExerciseCard({ ex, prev, plan }) {
  const [open, setOpen] = useState(false);
  const [w, setW] = useState(prev ? prev.weight_kg : 20);
  const [reps, setReps] = useState(prev ? prev.reps : parseInt((ex.reps + '').split('-')[0]) || 8);
  const [rpe, setRpe] = useState(8);
  const [res, setRes] = useState(null); // {busy}|{err}|{ok,pr}
  const [rest, setRest] = useState(null);
  const timer = useRef();
  const done = !!res?.ok;

  function startRest(seconds) {
    clearInterval(timer.current);
    let left = seconds;
    setRest(left);
    timer.current = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(timer.current);
        setRest(0);
        if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
      } else setRest(left);
    }, 1000);
  }
  useEffect(() => () => clearInterval(timer.current), []);

  async function logSet() {
    setRes({ busy: true });
    try {
      const r = await api('/v1/workouts/log', { method: 'POST', body: {
        exercise_id: ex.id, weight_kg: w, reps, rpe, history: [],
      }});
      await api('/v1/logs/workouts', { method: 'POST', body: {
        program: plan.program || 'ppl_power', day_name: plan.day_name || 'Workout',
        week: plan.week || 1, day_index: 0, decision: plan.decision || 'GREEN',
        sets: [{ exercise_id: ex.id, set_index: 1, weight_kg: w, reps, rpe }],
      }});
      localStorage.setItem('twin_last_ex', ex.id);
      setRes({ ok: true, pr: r.pr });
      if (r.pr.is_pr) confettiBurst();
      startRest(ex.rest_s || 90);
    } catch (e) { setRes({ err: e.message }); }
  }

  const efforts = [['Easy', 6], ['Solid', 7], ['Hard', 8], ['Max', 9.5]];

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 10, borderColor: done ? 'rgba(52,211,153,0.5)' : undefined }}>
      <div onClick={() => setOpen(!open)} style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="display" style={{ fontSize: 15, fontWeight: 650, textTransform: 'capitalize' }}>{ex.id.replace(/_/g, ' ')}</div>
          <div className="meta" style={{ fontSize: 12 }}>{ex.sets} sets × {ex.reps} · {ex.intensity || ''}</div>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} style={{ color: 'var(--mute)', fontSize: 13 }}>▾</motion.span>
      </div>
      <motion.div initial={false} animate={{ height: open ? 'auto' : 0 }} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '0 16px 16px' }}>
          <p style={{ fontSize: 11, color: prev ? 'var(--mint)' : 'var(--mute)', marginBottom: 10 }}>
            {prev ? `Last time: ${prev.weight_kg} kg × ${prev.reps} — beat it` : 'First time logging this — set the bar'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0' }}>
            <span style={{ width: 56, fontSize: 13, color: 'var(--dim)' }}>Weight</span>
            <Stepper value={w} onChange={setW} step={2.5} min={0} unit="kg" />
          </div>
          <div style={{ fontSize: 10, color: 'var(--mute)', textAlign: 'right', margin: '-4px 0 6px' }}>{plateText(w)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0' }}>
            <span style={{ width: 56, fontSize: 13, color: 'var(--dim)' }}>Reps</span>
            <Stepper value={reps} onChange={setReps} step={1} min={1} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
            <span style={{ width: 56, fontSize: 13, color: 'var(--dim)' }}>Effort</span>
            <div className="pick-row" style={{ flex: 1 }}>
              {efforts.map(([cap, val]) => (
                <div key={cap} className={`pick${rpe === val ? ' sel' : ''}`} style={{ padding: '9px 4px' }} onClick={() => setRpe(val)}>
                  <span className="cap" style={{ fontSize: 11 }}>{cap}</span>
                </div>
              ))}
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} className="btn primary full" style={{ marginTop: 8 }} disabled={res?.busy} onClick={logSet}>
            {res?.busy ? 'Logging…' : 'Log set'}
          </motion.button>
          {res?.err && <p className="err" style={{ marginTop: 8 }}>{res.err}</p>}
          {res?.ok && (
            <p style={{ color: 'var(--green)', fontWeight: res.pr.is_pr ? 700 : 500, fontSize: 13, padding: '8px 0 0' }}>
              {res.pr.is_pr ? `🎉 ${res.pr.pr_type.toUpperCase()} PR! ${w}kg × ${reps}` : `✓ Logged ${w}kg × ${reps}`}
            </p>
          )}
          {rest !== null && (
            <p style={{ fontSize: 12, paddingTop: 4 }}>
              {rest > 0
                ? <>Rest: <span className="mono" style={{ color: 'var(--mint)', fontWeight: 700 }}>{Math.floor(rest / 60)}:{String(rest % 60).padStart(2, '0')}</span></>
                : <span style={{ color: 'var(--green)' }}>Rest done — next set!</span>}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ================= Meal ================= */
const QUICK_FOODS = [
  ['🫓', 'Roti', 'roti_wheat_1pc'], ['🍚', 'Rice', 'rice_basmati_100g'],
  ['🍗', 'Chicken', 'chicken_breast_100g'], ['🥚', 'Egg', 'egg_whole_1pc'],
  ['🧀', 'Paneer', 'paneer_100g'], ['🥛', 'Milk', 'milk_toned_1cup'],
  ['🥣', 'Dal', 'dal_toor_1cup'], ['🍶', 'Curd', 'dahi_1cup'],
  ['🌾', 'Oats', 'oats_rolled_50g'], ['💪', 'Whey', 'whey_isolate_30g'],
  ['🍌', 'Banana', 'banana_1pc'], ['🍎', 'Apple', 'apple_1pc'],
  ['🥔', 'Potato', 'aloo_1cup'], ['🥜', 'Peanuts', 'peanuts_28g'],
  ['⚪', 'Idli', 'idli_1pc'], ['🥞', 'Dosa', 'dosa_plain_1pc'],
];

function MealSheet() {
  const toast = useToast();
  const [dayTotal, setDayTotal] = useState(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);
  const [portions, setPortions] = useState(1);
  const [ctx, setCtx] = useState(mealContext());
  const [err, setErr] = useState(null);
  const searchTimer = useRef();

  async function quickAdd(id, name) {
    try {
      const r = await api('/v1/logs/meals', { method: 'POST', body: { food_id: id, portions: 1, context: mealContext() } });
      setDayTotal(Math.round(r.day_kcal_total));
      toast(`✓ ${name} logged`);
    } catch (e) { setErr(e.message); }
  }

  function search(text) {
    setQ(text);
    clearTimeout(searchTimer.current);
    if (!text) return setResults([]);
    searchTimer.current = setTimeout(async () => {
      try { setResults((await api(`/v1/foods/search?q=${encodeURIComponent(text)}&limit=10`)).results); }
      catch (e) { setErr(e.message); }
    }, 250);
  }

  async function submitPicked() {
    try {
      const r = await api('/v1/logs/meals', { method: 'POST', body: { food_id: picked.id, portions, context: ctx } });
      setDayTotal(Math.round(r.day_kcal_total));
      setPicked(null); setQ(''); setResults([]);
      toast(`✓ Logged ${r.kcal} kcal`);
    } catch (e) { setErr(e.message); }
  }

  return (
    <div>
      <p className="meta" style={{ marginBottom: 16 }}>
        {dayTotal != null
          ? <span style={{ color: 'var(--mint)', fontWeight: 650 }}>Today: {dayTotal} kcal · keep tapping to add more</span>
          : 'Tap any food to log one serving instantly.'}
      </p>
      <div style={{ fontSize: 13, fontWeight: 650, fontFamily: 'var(--font-display)', marginBottom: 10 }}>Quick add ({mealContext()})</div>
      <div className="chips">
        {QUICK_FOODS.map(([e, n, id]) => (
          <motion.div key={id} whileTap={{ scale: 0.93 }} className="chip" onClick={() => quickAdd(id, n)}>
            <span style={{ fontSize: 16 }}>{e}</span>{n}
          </motion.div>
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 650, fontFamily: 'var(--font-display)', margin: '20px 0 10px' }}>Or search 80+ foods</div>
      <input value={q} onChange={(e) => search(e.target.value)} placeholder="Try 'thigh', 'brown rice', 'moong'…" style={{ width: '100%' }} />
      <div style={{ marginTop: 12 }}>
        {picked ? (
          <div className="card" style={{ borderColor: 'rgba(245,181,114,0.4)' }}>
            <h3 style={{ fontSize: 14 }}>{picked.name}</h3>
            <span className="meta">Per portion: {picked.kcal} kcal · P{picked.p} C{picked.c} F{picked.f}</span>
            <div className="field" style={{ marginTop: 8 }}><label>Portions</label>
              <input type="number" min="0.25" step="0.25" value={portions} onChange={(e) => setPortions(parseFloat(e.target.value) || 1)} style={{ width: 90 }} /></div>
            <div className="field"><label>Context</label>
              <select value={ctx} onChange={(e) => setCtx(e.target.value)}>
                <option value="breakfast">Breakfast</option><option value="lunch">Lunch</option>
                <option value="snack">Snack</option><option value="dinner">Dinner</option>
              </select></div>
            <button className="btn primary full" style={{ marginTop: 12 }} onClick={submitPicked}>Log this meal</button>
          </div>
        ) : results.map((f) => (
          <div key={f.id} className="card" style={{ marginBottom: 8, cursor: 'pointer', padding: '12px 15px' }} onClick={() => setPicked(f)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><h3 style={{ fontSize: 14 }}>{f.name}</h3><span className="meta">{f.kcal} kcal · P{f.p} C{f.c} F{f.f}</span></div>
              <span style={{ color: 'var(--mint)', fontSize: 20 }}>+</span>
            </div>
          </div>
        ))}
      </div>
      {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
    </div>
  );
}

/* ================= BP & Glucose ================= */
function EscalationCard({ esc }) {
  return (
    <div className="card" style={{ background: 'rgba(251,113,133,0.08)', borderColor: 'rgba(251,113,133,0.4)', marginTop: 10 }}>
      <h3 style={{ color: 'var(--red)' }}>🚨 {esc.level} ESCALATION</h3>
      <p className="meta">{esc.message}</p>
      <p className="meta" style={{ marginTop: 6 }}><b>Channels:</b> {esc.channels.join(', ')}{esc.tta_seconds ? ` · TTA ${esc.tta_seconds}s` : ''}</p>
    </div>
  );
}

function BPSheet() {
  const [sys, setSys] = useState(125);
  const [dia, setDia] = useState(80);
  const [symp, setSymp] = useState(false);
  const [out, setOut] = useState(null);

  async function submit() {
    setOut({ busy: true });
    try {
      const r = await api('/v1/surveillance/bp', { method: 'POST', body: { sbp: sys, dbp: dia, symptomatic: symp } });
      setOut({ r });
    } catch (e) { setOut({ err: e.message }); }
  }
  return (
    <div>
      <p className="meta" style={{ marginBottom: 16 }}>Read the two numbers off your BP cuff.</p>
      <div className="field"><label>Systolic</label><input type="number" value={sys} onChange={(e) => setSys(parseInt(e.target.value) || 0)} /></div>
      <div className="field"><label>Diastolic</label><input type="number" value={dia} onChange={(e) => setDia(parseInt(e.target.value) || 0)} /></div>
      <div className="field"><label>Symptomatic?</label>
        <select value={symp ? 'y' : 'n'} onChange={(e) => setSymp(e.target.value === 'y')}>
          <option value="n">No</option><option value="y">Yes (chest pain, vision change…)</option>
        </select></div>
      <button className="btn primary full" style={{ marginTop: 14 }} onClick={submit}>Stage this reading</button>
      {out?.busy && <p className="meta" style={{ marginTop: 10 }}>Sending…</p>}
      {out?.err && <p className="err" style={{ marginTop: 10 }}>{out.err}</p>}
      {out?.r && (
        <div style={{ marginTop: 12 }}>
          <div className="card">
            <h3>Stage: {out.r.stage} · Tier: {out.r.tier}</h3>
            <div className="row"><span className="lbl">Action</span><span className="val">{out.r.action}</span></div>
            <div className="row"><span className="lbl">Pulse pressure</span><span className="val">{out.r.pulse_pressure}</span></div>
            <div className="row"><span className="lbl">MAP</span><span className="val">{out.r.map}</span></div>
          </div>
          {out.r.escalation && <EscalationCard esc={out.r.escalation} />}
        </div>
      )}
    </div>
  );
}

function GlucoseSheet() {
  const [val, setVal] = useState(100);
  const [symp, setSymp] = useState(false);
  const [out, setOut] = useState(null);

  async function submit() {
    setOut({ busy: true });
    try {
      const r = await api('/v1/surveillance/escalate/glucose', { method: 'POST', body: { value_mgdl: val, symptomatic: symp } });
      setOut({ r });
    } catch (e) { setOut({ err: e.message }); }
  }
  const crit = out?.r?.level === 'CRITICAL';
  return (
    <div>
      <p className="meta" style={{ marginBottom: 16 }}>Read the number off your glucose meter (mg/dL).</p>
      <div className="field"><label>Value (mg/dL)</label><input type="number" value={val} onChange={(e) => setVal(parseFloat(e.target.value) || 0)} /></div>
      <div className="field"><label>Symptomatic?</label>
        <select value={symp ? 'y' : 'n'} onChange={(e) => setSymp(e.target.value === 'y')}>
          <option value="n">No</option><option value="y">Yes</option>
        </select></div>
      <button className="btn primary full" style={{ marginTop: 14 }} onClick={submit}>Submit</button>
      {out?.busy && <p className="meta" style={{ marginTop: 10 }}>Sending…</p>}
      {out?.err && <p className="err" style={{ marginTop: 10 }}>{out.err}</p>}
      {out?.r && (
        <div className="card" style={{ marginTop: 12, ...(crit ? { background: 'rgba(251,113,133,0.08)', borderColor: 'rgba(251,113,133,0.4)' } : {}) }}>
          <h3 style={{ color: crit ? 'var(--red)' : 'inherit' }}>{crit ? '🚨' : '✓'} Level: {out.r.level}</h3>
          <p className="meta">{out.r.message}</p>
          {out.r.recommendation && <p className="meta" style={{ marginTop: 6 }}><b>Rec:</b> {out.r.recommendation}</p>}
          {out.r.channels && <p className="meta" style={{ marginTop: 6 }}><b>Channels:</b> {out.r.channels.join(', ')}</p>}
        </div>
      )}
    </div>
  );
}
