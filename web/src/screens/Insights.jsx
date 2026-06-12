// Insights: pattern engine output + the three validated calculators
// (IDRS, ASCVD, BP staging). Same endpoints and payloads as before.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { stagger, rise } from '../components/ui.jsx';
import { IconPulse } from '../components/Icons.jsx';

const SEV_TONE = { good: 'var(--green)', watch: 'var(--amber)', warn: 'var(--red)', info: 'var(--cyan)' };

export default function Insights() {
  const [patterns, setPatterns] = useState(undefined);

  useEffect(() => {
    (async () => {
      try { setPatterns(await api('/v1/insights')); }
      catch (e) { setPatterns({ error: e.message }); }
    })();
  }, []);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={rise} style={{ margin: '26px 0 20px' }}>
        <h2 className="display" style={{ fontSize: 30, fontWeight: 700 }}>Insights</h2>
        <p className="meta">Your data, your trends</p>
      </motion.div>

      <motion.div variants={rise}>
        <div className="micro">Your patterns</div>
        {patterns === undefined && <div className="skel" style={{ height: 80, borderRadius: 16 }} />}
        {patterns?.error && <p className="err">{patterns.error}</p>}
        {patterns && !patterns.error && <Patterns r={patterns} />}
      </motion.div>

      <motion.div variants={rise}>
        <div className="micro">Risk calculators</div>
        <IDRSCard />
        <ASCVDCard />
        <BPStageCard />
      </motion.div>
    </motion.div>
  );
}

function Patterns({ r }) {
  const anoms = r.anomalies || [];
  const corrs = r.correlations || [];
  if (!r.enough_data && anoms.length === 0 && corrs.length === 0) {
    return (
      <div className="card" style={{ borderStyle: 'dashed', textAlign: 'center', padding: 26 }}>
        <span style={{ color: 'var(--mute)' }}><IconPulse width={26} height={26} /></span>
        <h3 style={{ margin: '8px 0 4px', fontSize: 15 }}>Patterns appear after ~7 days</h3>
        <p className="meta">Keep doing check-ins or syncing your watch. VarunOS spots what raises
          your HRV, what hurts your sleep, and early warning signs — from your own data.</p>
      </div>
    );
  }
  return (
    <>
      {[...anoms, ...corrs].map((item, i) => (
        <div key={i} className="card" style={{ borderLeft: `3px solid ${SEV_TONE[item.severity] || 'var(--cyan)'}`, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <h3 style={{ fontSize: 14 }}>{item.title}</h3>
            {item.strength && <span className="meta" style={{ whiteSpace: 'nowrap' }}>{item.strength}</span>}
          </div>
          <p className="meta" style={{ marginTop: 4 }}>{item.detail}</p>
        </div>
      ))}
      <p className="meta" style={{ textAlign: 'center', margin: '10px 0' }}>
        Based on {r.days_analyzed} days of your data · updates automatically
      </p>
    </>
  );
}

function ResultBox({ out, render }) {
  if (!out) return null;
  if (out.busy) return <p className="meta" style={{ marginTop: 10 }}>Computing…</p>;
  if (out.err) return <p className="err" style={{ marginTop: 10 }}>{out.err}</p>;
  return <div style={{ marginTop: 12 }}>{render(out.r)}</div>;
}

function IDRSCard() {
  const [f, setF] = useState({ age: 30, bmi: 24.6, waist: 86, sex: 'M', fam: false, act: 'mild' });
  const [out, setOut] = useState(null);
  async function go() {
    setOut({ busy: true });
    try {
      const r = await api('/v1/surveillance/idrs', { method: 'POST', body: {
        age_years: +f.age, bmi: +f.bmi, waist_cm: +f.waist, sex: f.sex,
        family_history_dm: f.fam, activity: f.act,
      }});
      setOut({ r });
    } catch (e) { setOut({ err: e.message }); }
  }
  return (
    <div className="card">
      <h3>IDRS — Indian Diabetes Risk</h3>
      <p className="meta" style={{ marginBottom: 8 }}>Validated for Indian populations</p>
      <div className="field"><label>Age</label><input type="number" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} /></div>
      <div className="field"><label>BMI</label><input type="number" step="0.1" value={f.bmi} onChange={(e) => setF({ ...f, bmi: e.target.value })} /></div>
      <div className="field"><label>Waist (cm)</label><input type="number" value={f.waist} onChange={(e) => setF({ ...f, waist: e.target.value })} /></div>
      <div className="field"><label>Sex</label>
        <select value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value })}><option value="M">Male</option><option value="F">Female</option></select></div>
      <div className="field"><label>Family DM?</label>
        <select value={f.fam ? 'y' : 'n'} onChange={(e) => setF({ ...f, fam: e.target.value === 'y' })}><option value="n">No</option><option value="y">Yes</option></select></div>
      <div className="field"><label>Activity</label>
        <select value={f.act} onChange={(e) => setF({ ...f, act: e.target.value })}>
          <option value="vigorous">Vigorous</option><option value="mild">Mild</option><option value="sedentary">Sedentary</option>
        </select></div>
      <button className="btn primary full" style={{ marginTop: 10 }} onClick={go}>Compute IDRS</button>
      <ResultBox out={out} render={(r) => (
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <h3>Score {r.score} · Tier {r.tier}</h3>
          <p className="meta">{r.screening_recommendation}</p>
        </div>
      )} />
    </div>
  );
}

function ASCVDCard() {
  const [f, setF] = useState({ age: 50, sex: 'M', tc: 200, hdl: 50, sbp: 130, bpmed: false, dm: false, smk: false, sa: true });
  const [out, setOut] = useState(null);
  async function go() {
    setOut({ busy: true });
    try {
      const r = await api('/v1/surveillance/ascvd', { method: 'POST', body: {
        age: +f.age, sex: f.sex, total_chol: +f.tc, hdl_c: +f.hdl, sbp: +f.sbp,
        bp_treated: f.bpmed, diabetes: f.dm, smoker: f.smk, south_asian_adjustment: f.sa,
      }});
      setOut({ r });
    } catch (e) { setOut({ err: e.message }); }
  }
  const B = ({ k, label }) => (
    <div className="field"><label>{label}</label>
      <select value={f[k] ? 'y' : 'n'} onChange={(e) => setF({ ...f, [k]: e.target.value === 'y' })}>
        <option value="n">No</option><option value="y">Yes</option>
      </select></div>
  );
  return (
    <div className="card">
      <h3>ASCVD — 10-yr heart risk</h3>
      <p className="meta" style={{ marginBottom: 8 }}>Pooled Cohort Equations 2018 · Indian 1.3× adjustment</p>
      <div className="field"><label>Age</label><input type="number" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} /></div>
      <div className="field"><label>Sex</label>
        <select value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value })}><option value="M">Male</option><option value="F">Female</option></select></div>
      <div className="field"><label>Total chol</label><input type="number" value={f.tc} onChange={(e) => setF({ ...f, tc: e.target.value })} /></div>
      <div className="field"><label>HDL</label><input type="number" value={f.hdl} onChange={(e) => setF({ ...f, hdl: e.target.value })} /></div>
      <div className="field"><label>SBP</label><input type="number" value={f.sbp} onChange={(e) => setF({ ...f, sbp: e.target.value })} /></div>
      <B k="bpmed" label="On BP meds?" /><B k="dm" label="Diabetes?" /><B k="smk" label="Smoker?" /><B k="sa" label="SA 1.3× adj?" />
      <button className="btn primary full" style={{ marginTop: 10 }} onClick={go}>Compute ASCVD</button>
      <ResultBox out={out} render={(r) => (
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <h3>10-yr risk {r.risk_10yr_pct.toFixed(2)}% · Tier {r.tier}</h3>
          <p className="meta">{r.action_label}</p>
          <p className="meta" style={{ marginTop: 6, fontSize: 10 }}>{r.disclaimer}</p>
        </div>
      )} />
    </div>
  );
}

function BPStageCard() {
  const [sys, setSys] = useState(125);
  const [dia, setDia] = useState(80);
  const [out, setOut] = useState(null);
  async function go() {
    setOut({ busy: true });
    try {
      const r = await api('/v1/surveillance/bp', { method: 'POST', body: { sbp: +sys, dbp: +dia } });
      setOut({ r });
    } catch (e) { setOut({ err: e.message }); }
  }
  return (
    <div className="card">
      <h3>BP staging</h3>
      <p className="meta" style={{ marginBottom: 8 }}>ACC/AHA 2017 guidelines</p>
      <div className="field"><label>Systolic</label><input type="number" value={sys} onChange={(e) => setSys(e.target.value)} /></div>
      <div className="field"><label>Diastolic</label><input type="number" value={dia} onChange={(e) => setDia(e.target.value)} /></div>
      <button className="btn primary full" style={{ marginTop: 10 }} onClick={go}>Stage this reading</button>
      <ResultBox out={out} render={(r) => (
        <>
          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <h3>Stage {r.stage} · Tier {r.tier}</h3>
            <p className="meta">{r.action}</p>
            <div className="row"><span className="lbl">Pulse pressure</span><span className="val">{r.pulse_pressure}</span></div>
            <div className="row"><span className="lbl">MAP</span><span className="val">{r.map}</span></div>
          </div>
          {r.escalation && (
            <div className="card" style={{ background: 'rgba(251,113,133,0.08)', borderColor: 'rgba(251,113,133,0.4)', marginTop: 8 }}>
              <h3 style={{ color: 'var(--red)' }}>🚨 {r.escalation.level} ESCALATION</h3>
              <p className="meta">{r.escalation.message}</p>
            </div>
          )}
        </>
      )} />
    </div>
  );
}
