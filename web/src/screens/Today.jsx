// Today: one /v1/wakeup call drives greeting, readiness hero, momentum,
// adjusted workout and the nutrition section.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, getProfile } from '../api.js';
import { Ring, CountUp, stagger, rise, confettiBurst } from '../components/ui.jsx';
import { IconBarbell, IconFork, IconArrow, IconSparkle, IconMoon } from '../components/Icons.jsx';

const SRC_LABELS = { apple_health: 'Apple Health', fitbit: 'Fitbit', oura: 'Oura', whoop: 'Whoop', garmin: 'Garmin' };
const COMP_NAMES = { sleep: 'Sleep', wellness: 'Wellness', hrv: 'HRV', rhr: 'RHR', load: 'Load', trend: 'Trend' };

const toneFor = (color) =>
  color === 'GREEN' ? 'var(--green)' : color === 'YELLOW' ? 'var(--amber)' : 'var(--red)';

export default function Today({ onOpenSheet, onTab }) {
  const [wake, setWake] = useState(undefined); // undefined=loading, null=unreachable
  const [diet, setDiet] = useState(null);
  const [consumed, setConsumed] = useState(0);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const wk = await api('/v1/wakeup');
        if (!on) return;
        setWake(wk);
        if (wk.momentum?.kind === 'pr') confettiBurst();
      } catch (_) { if (on) setWake(null); }
      try {
        const p = getProfile();
        const d = await api('/v1/diet/calc', { method: 'POST', body: {
          sex: p.sex, weight_kg: p.weight_kg, height_cm: p.height_cm,
          age: p.age, activity: p.activity, goal: p.goal,
        }});
        const meals = await api('/v1/logs/meals?limit=100');
        const today = new Date().toISOString().slice(0, 10);
        const eaten = (meals.meals || []).filter((m) => m.ts?.startsWith(today))
          .reduce((s, m) => s + (m.kcal || 0), 0);
        if (on) { setDiet(d); setConsumed(eaten); }
      } catch (_) {}
    })();
    return () => { on = false; };
  }, []);

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const r = wake?.readiness?.has_data ? wake.readiness : null;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      {/* greeting */}
      <motion.div variants={rise} style={{ margin: '26px 0 22px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>{dateStr}</p>
        <h2 className="display" style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>
          {wake === undefined ? <span className="skel" style={{ display: 'inline-block', width: 200, height: 30 }} /> : (wake?.greeting || 'Good day')}
        </h2>
      </motion.div>

      {/* momentum */}
      {wake?.momentum && (
        <motion.div variants={rise} className="card" style={{
          marginBottom: 12,
          borderColor: wake.momentum.kind === 'pr' ? 'rgba(52,211,153,0.4)' : 'rgba(46,230,168,0.25)',
          boxShadow: 'var(--shadow), 0 0 32px -14px rgba(46,230,168,0.5)',
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ color: 'var(--mint)' }}><IconSparkle width={18} height={18} /></span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-display)' }}>{wake.momentum.title}</div>
              <p className="meta" style={{ marginTop: 2 }}>{wake.momentum.detail}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* readiness hero */}
      <motion.div variants={rise}>
        {wake === undefined && <div className="skel" style={{ height: 170, borderRadius: 18 }} />}
        {wake !== undefined && r && <ReadinessHero r={r} />}
        {wake !== undefined && !r && (
          <div className="card" style={{ textAlign: 'center', padding: '30px 22px', borderStyle: 'dashed' }}>
            <span style={{ color: 'var(--mute)' }}><IconMoon width={28} height={28} /></span>
            <h3 style={{ margin: '10px 0 6px', fontSize: 16 }}>No check-in yet today</h3>
            <p className="meta" style={{ marginBottom: 16 }}>Six quick taps about sleep and how you feel — readiness in 15 seconds.</p>
            <button className="btn primary full" onClick={() => onOpenSheet('checkin')}>Start morning check-in</button>
          </div>
        )}
        {wake === null && (
          <div className="card"><p className="err">Server unreachable — check Settings → Backend connection.</p></div>
        )}
      </motion.div>

      {/* risk tiers */}
      {r && (
        <motion.div variants={rise}>
          <div className="micro">Risk tiers</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill LOW"><span className="dot" />Glucose LOW</span>
            <span className="pill LOW"><span className="dot" />BP LOW</span>
            <span className="pill LOW"><span className="dot" />CVD LOW</span>
          </div>
        </motion.div>
      )}

      {/* workout */}
      <motion.div variants={rise}>
        <div className="micro">Today's session</div>
        {wake === undefined && <div className="skel" style={{ height: 130, borderRadius: 18 }} />}
        {wake?.workout && <WorkoutCard w={wake.workout} noCheckin={!r} onStart={() => onTab('log')} />}
        {wake === null && <div className="card"><p className="err">Start the API to see today's plan.</p></div>}
      </motion.div>

      {/* nutrition */}
      <motion.div variants={rise}>
        <div className="micro">Nutrition</div>
        {diet ? <DietCard d={diet} consumed={consumed} onLog={() => onOpenSheet('meal')} />
          : <div className="skel" style={{ height: 110, borderRadius: 18 }} />}
      </motion.div>

      <motion.div variants={rise} className="disclaimer">
        <strong>VarunOS Health Surveillance is an educational risk-stratification tool, not a medical
        device.</strong> It does not diagnose, treat, cure, or prevent any disease. If you have symptoms,
        contact a licensed medical professional. In an emergency, call 911 / 108 / 112.
      </motion.div>
    </motion.div>
  );
}

function ReadinessHero({ r }) {
  const tone = toneFor(r.color);
  const headline = {
    GREEN: 'Green day — go for it',
    YELLOW: 'Yellow day — pull back a little',
    RED: 'Red day — active recovery only',
  }[r.color] || r.color;
  const comps = Object.entries(r.components || {});
  const compColor = (v) => (v >= 75 ? 'var(--green)' : v >= 50 ? 'var(--amber)' : 'var(--red)');
  const src = r.source && r.source !== 'manual' ? (SRC_LABELS[r.source] || 'Synced') : null;

  return (
    <div className="card" style={{
      position: 'relative', padding: 22,
      boxShadow: `var(--shadow), 0 0 56px -18px ${tone}66`,
      borderColor: `${tone}44`,
    }}>
      {src && <span style={{ position: 'absolute', top: 16, right: 18, fontSize: 11, color: 'var(--mute)' }}>{src}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <Ring score={Math.round(r.overall)} color={tone} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="display" style={{ fontSize: 17, fontWeight: 650, color: tone, marginBottom: 12 }}>{headline}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 16px' }}>
            {comps.map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{COMP_NAMES[k] || k}</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: compColor(v) }}>
                  <CountUp value={Math.round(v)} duration={0.9} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkoutCard({ w, noCheckin, onStart }) {
  const tone = toneFor(w.decision);
  const sub = [w.program, w.week ? `Week ${w.week}` : null, w.block ? `${w.block} block` : null, w.is_custom ? 'your plan' : null]
    .filter(Boolean).join(' · ');
  const totalSets = w.exercises.reduce((s, e) => s + (e.sets || 0), 0);
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <h3 className="display" style={{ fontSize: 19, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--mint)' }}><IconBarbell width={19} height={19} /></span>
            {w.day_name} day
          </h3>
          <p className="meta" style={{ marginTop: 2 }}>{sub}</p>
        </div>
        <span className="pill" style={{ borderColor: `${tone}55`, color: tone }}>
          <span className="dot" style={{ background: tone, boxShadow: `0 0 8px ${tone}` }} />{w.decision}
        </span>
      </div>
      {noCheckin && (
        <p className="warn" style={{ fontSize: 12, margin: '8px 0' }}>
          Do your morning check-in to personalise this decision.
        </p>
      )}
      <div style={{ display: 'flex', gap: 24, margin: '14px 0' }}>
        <div><div className="display mono" style={{ fontSize: 26, fontWeight: 700 }}>{w.exercises.length}</div><div style={{ fontSize: 10, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Exercises</div></div>
        <div><div className="display mono" style={{ fontSize: 26, fontWeight: 700 }}>{totalSets}</div><div style={{ fontSize: 10, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Total sets</div></div>
      </div>
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginBottom: 14 }}>
        {w.exercises.map((ex) => (
          <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
            <span style={{ textTransform: 'capitalize' }}>{ex.id.replace(/_/g, ' ')}</span>
            <span className="mono" style={{ color: 'var(--dim)' }}>{ex.sets}×{ex.reps} <span style={{ color: 'var(--mute)' }}>{ex.intensity || ''}</span></span>
          </div>
        ))}
      </div>
      <motion.button whileTap={{ scale: 0.97 }} className="btn primary full" onClick={onStart}>
        Start workout <IconArrow width={16} height={16} />
      </motion.button>
    </div>
  );
}

function DietCard({ d, consumed, onLog }) {
  const pct = Math.min(100, Math.round((consumed / d.target_kcal) * 100));
  const remaining = Math.max(0, d.target_kcal - consumed);
  const barColor = pct > 100 ? 'var(--red)' : pct > 85 ? 'var(--amber)' : 'var(--mint)';
  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 className="display" style={{ fontSize: 16, fontWeight: 650, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ color: 'var(--mint)' }}><IconFork width={17} height={17} /></span>
        Fuel
      </h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--dim)', marginBottom: 6 }}>
        <span><b className="mono" style={{ color: 'var(--text)', fontSize: 15 }}><CountUp value={Math.round(consumed)} /></b> eaten</span>
        <span><b className="mono" style={{ color: 'var(--text)', fontSize: 15 }}>{remaining}</b> remaining</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 7, overflow: 'hidden', marginBottom: 14 }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          style={{ background: barColor, height: '100%', borderRadius: 6 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        {[['Target', d.target_kcal, 'kcal'], ['Protein', d.protein_g, 'g'], ['Carbs', d.carbs_g, 'g'], ['Fat', d.fat_g, 'g']].map(([k, v, u]) => (
          <div key={k} style={{ textAlign: 'center', background: 'var(--surface-2)', borderRadius: 12, padding: '8px 4px', border: '1px solid var(--line)' }}>
            <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{v}<span style={{ fontSize: 9, color: 'var(--mute)' }}>{u}</span></div>
            <div style={{ fontSize: 9, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{k}</div>
          </div>
        ))}
      </div>
      <button className="btn ghost full" onClick={onLog}>+ Log a meal</button>
    </div>
  );
}
