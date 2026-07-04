// Investor Dashboard — a full-screen, real-data metrics page mounted at
// #investors. One call to GET /v1/metrics/investor drives everything:
// headline stats, an 8-week workout bar chart, the emotional-loop strip and
// the honesty footnotes. No chart libraries — hand-rolled SVG.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { CountUp, stagger, rise } from '../components/ui.jsx';

const GOLD = '#f5b572';
const TEAL = '#2ec4b6';
const LINE = 'rgba(151,168,205,0.12)';

const eyebrowStyle = {
  fontFamily: 'var(--font-eyebrow)', fontSize: 10.5, fontWeight: 500,
  textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--mute)',
};

/* ---- one headline stat card ---- */
function StatCard({ label, value, decimals = 0, sub }) {
  return (
    <motion.div variants={rise} style={{
      background: 'rgba(8,10,16,0.7)', border: `1px solid ${LINE}`, borderRadius: 18,
      padding: '18px 20px', boxShadow: 'var(--shadow)', minWidth: 0,
    }}>
      <div style={eyebrowStyle}>{label}</div>
      <div className="display mono" style={{
        fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, lineHeight: 1.05,
        letterSpacing: '-0.03em', marginTop: 8, color: 'var(--text)',
      }}>
        <CountUp value={Number(value) || 0} duration={1.2} decimals={decimals} />
      </div>
      {sub && <div style={{ fontSize: 12, color: GOLD, marginTop: 6, fontWeight: 600 }}>{sub}</div>}
    </motion.div>
  );
}

/* ---- 8-week workout bar chart, hand-rolled SVG ---- */
function WeeklyChart({ series }) {
  const [up, setUp] = useState(false);
  useEffect(() => { const t = setTimeout(() => setUp(true), 60); return () => clearTimeout(t); }, []);
  const weeks = Array.from({ length: 8 }, (_, i) => Number((series || [])[i]) || 0);
  const max = Math.max(...weeks);
  const allZero = max <= 0;
  const W = 560, H = 210, PAD = 26, BASE = H - 34;
  const slot = (W - PAD * 2) / 8, barW = Math.min(40, slot * 0.55);
  const labels = ['W-7', 'W-6', 'W-5', 'W-4', 'W-3', 'W-2', 'W-1', 'now'];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Workouts per week, last 8 weeks"
        style={{ display: 'block' }}>
        <defs>
          <linearGradient id="inv-goldbar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffdeba" />
            <stop offset="55%" stopColor={GOLD} />
            <stop offset="100%" stopColor="#d97a45" />
          </linearGradient>
        </defs>
        {weeks.map((v, i) => {
          const h = allZero ? 0 : Math.max(v > 0 ? 4 : 0, (v / max) * (BASE - 28));
          const x = PAD + slot * i + (slot - barW) / 2;
          return (
            <g key={i}>
              <rect x={x} y={BASE - h} width={barW} height={Math.max(h, 0.01)} rx={5}
                fill="url(#inv-goldbar)" opacity={i === 7 ? 1 : 0.82}
                style={{
                  transformOrigin: `${x + barW / 2}px ${BASE}px`,
                  transform: up ? 'scaleY(1)' : 'scaleY(0)',
                  transition: `transform 0.8s cubic-bezier(0.22, 1, 0.36, 1) ${0.08 * i}s`,
                }} />
              {v > 0 && (
                <text x={x + barW / 2} y={BASE - h - 8} textAnchor="middle" fill="var(--dim)"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                    opacity: up ? 1 : 0, transition: `opacity 0.5s ease ${0.3 + 0.08 * i}s` }}>{v}</text>
              )}
              <text x={x + barW / 2} y={H - 10} textAnchor="middle" fill="var(--mute)"
                style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 9.5, letterSpacing: '0.08em' }}>
                {labels[i]}
              </text>
            </g>
          );
        })}
        {/* hairline baseline */}
        <line x1={PAD - 6} y1={BASE} x2={W - PAD + 6} y2={BASE} stroke="rgba(151,168,205,0.24)" strokeWidth="1" />
      </svg>
      {allZero && (
        <p style={{ fontSize: 12, color: 'var(--mute)', textAlign: 'center', marginTop: 6 }}>no data yet — the first workouts will light this up</p>
      )}
    </div>
  );
}

/* ---- the loop strip: measurements → morphs → workout → reacts → progress ---- */
function LoopStrip() {
  const steps = ['measurements', 'Twin morphs', 'workout', 'Twin reacts', 'progress'];
  const W = 700, y = 32;
  const xs = steps.map((_, i) => 70 + i * ((W - 140) / (steps.length - 1)));
  return (
    <svg viewBox={`0 0 ${W} 84`} width="100%" role="img" aria-label="The Sarathi loop" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="inv-loopline" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(245,181,114,0.15)" />
          <stop offset="50%" stopColor="rgba(245,181,114,0.7)" />
          <stop offset="100%" stopColor={TEAL} />
        </linearGradient>
      </defs>
      <line x1={xs[0]} y1={y} x2={xs[4]} y2={y} stroke="url(#inv-loopline)" strokeWidth="1.5" />
      {steps.map((label, i) => (
        <g key={label}>
          <circle cx={xs[i]} cy={y} r={10} fill="rgba(245,181,114,0.10)" />
          <circle cx={xs[i]} cy={y} r={4.5} fill={i === steps.length - 1 ? TEAL : GOLD}
            style={{ filter: `drop-shadow(0 0 6px ${i === steps.length - 1 ? TEAL : GOLD})` }} />
          <text x={xs[i]} y={y + 34} textAnchor="middle" fill="var(--dim)"
            style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 10.5, letterSpacing: '0.08em' }}>
            {label}
          </text>
          {i < steps.length - 1 && (
            <text x={(xs[i] + xs[i + 1]) / 2} y={y - 8} textAnchor="middle" fill="var(--mute)" style={{ fontSize: 10 }}>→</text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function InvestorDashboard() {
  const [m, setM] = useState(undefined); // undefined=loading, null=error/unauthed

  useEffect(() => {
    let on = true;
    api('/v1/metrics/investor')
      .then((r) => { if (on) setM(r || null); })
      .catch(() => { if (on) setM(null); });
    return () => { on = false; };
  }, []);

  const genAt = m?.generated_at
    ? new Date(m.generated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60, overflowY: 'auto',
      background: 'radial-gradient(1100px 720px at 50% -12%, #0a0d15, #04060a 72%)',
      color: 'var(--text)', fontFamily: 'var(--font-body)',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <style>{`@keyframes inv-live-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(245,181,114,0.55); opacity: 1; }
        60% { box-shadow: 0 0 0 7px rgba(245,181,114,0); opacity: 0.75; }
      }`}</style>

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 22px 64px' }}>
        {/* top bar */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap',
            paddingBottom: 18, borderBottom: `1px solid ${LINE}`, marginBottom: 26 }}>
          <h1 className="display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
            सारथि <span style={{ color: 'var(--mute)', fontWeight: 500 }}>·</span>{' '}
            <span style={{ color: GOLD }}>investor metrics</span>
          </h1>
          <span aria-label="live" style={{ display: 'inline-flex', alignItems: 'center', gap: 7,
            fontFamily: 'var(--font-eyebrow)', fontSize: 10, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: GOLD }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: GOLD,
              animation: 'inv-live-pulse 1.8s ease-out infinite' }} /> live
          </span>
          {genAt && (
            <span className="mono" style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--mute)' }}>
              generated {genAt}
            </span>
          )}
        </motion.div>

        {/* loading */}
        {m === undefined && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ background: 'rgba(8,10,16,0.7)', border: `1px solid ${LINE}`, borderRadius: 18, padding: 20 }}>
                <div className="skel" style={{ height: 10, width: '60%' }} />
                <div className="skel" style={{ height: 36, width: '55%', marginTop: 14 }} />
              </div>
            ))}
          </div>
        )}

        {/* auth-absent / error → tasteful empty state */}
        {m === null && (
          <div style={{ maxWidth: 460, margin: '12vh auto 0', textAlign: 'center',
            background: 'rgba(8,10,16,0.7)', border: `1px solid ${LINE}`, borderRadius: 18,
            padding: '38px 28px', boxShadow: 'var(--shadow)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mute)', margin: '0 auto 14px' }} />
            <h2 className="display" style={{ fontSize: 17, fontWeight: 650, marginBottom: 6 }}>
              Metrics require a signed-in session
            </h2>
            <p className="meta">
              Sign in (or connect this device to your Sarathi server) and reload — the numbers here are always real, never mocked.
            </p>
          </div>
        )}

        {m && (
          <motion.div variants={stagger} initial="hidden" animate="show">
            {/* stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              <StatCard label="Users" value={m.users_total} />
              <StatCard label="Measurements set" value={m.measurements_set} />
              <StatCard label="Workouts" value={m.workouts_total}
                sub={m.workouts_7d != null ? `+${m.workouts_7d} this week` : null} />
              <StatCard label="Avg Twin level" value={m.avg_twin_level} decimals={1} />
              <StatCard label="Try-on intents" value={m.tryon_intents_total}
                sub={m.tryon_intents_7d != null ? `${m.tryon_intents_7d} in the last 7 days` : null} />
            </div>

            {/* weekly workouts */}
            <motion.div variants={rise} style={{ marginTop: 14, background: 'rgba(8,10,16,0.7)',
              border: `1px solid ${LINE}`, borderRadius: 18, padding: '20px 18px 12px', boxShadow: 'var(--shadow)' }}>
              <div style={{ ...eyebrowStyle, marginBottom: 14 }}>workouts · last 8 weeks</div>
              <WeeklyChart series={m.series && m.series.weekly_workouts} />
            </motion.div>

            {/* the loop strip */}
            <motion.div variants={rise} style={{ marginTop: 14, background: 'rgba(8,10,16,0.7)',
              border: `1px solid ${LINE}`, borderRadius: 18, padding: '20px 18px 8px', boxShadow: 'var(--shadow)' }}>
              <div style={{ ...eyebrowStyle, marginBottom: 6 }}>the loop we sell</div>
              <LoopStrip />
            </motion.div>

            {/* honesty section */}
            {Array.isArray(m.notes) && m.notes.length > 0 && (
              <motion.div variants={rise} style={{ marginTop: 22 }}>
                <div style={{ ...eyebrowStyle, marginBottom: 10 }}>what these numbers mean</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {m.notes.map((n, i) => (
                    <p key={i} style={{ fontSize: 12, color: 'var(--mute)', lineHeight: 1.6 }}>
                      <span style={{ color: GOLD, marginRight: 8 }}>·</span>{n}
                    </p>
                  ))}
                </div>
              </motion.div>
            )}
            {m.measurement_history_points != null && (
              <motion.p variants={rise} className="mono"
                style={{ marginTop: 16, fontSize: 11, color: 'var(--mute)' }}>
                {m.measurement_history_points} measurement history points on record
              </motion.p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
