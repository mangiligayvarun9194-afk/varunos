// First-run flow: welcome → connect → basics → safety → surveillance opt-in.
// Same localStorage contract as before; pairing links skip this entirely.
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { setConnection, saveProfileLocal } from '../api.js';
import { IconShield, IconSparkle } from '../components/Icons.jsx';

const slide = {
  initial: { opacity: 0, x: 36 },
  animate: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 320, damping: 32 } },
  exit: { opacity: 0, x: -28, transition: { duration: 0.18 } },
};

export default function Onboarding({ defaultApi, defaultKey, onDone }) {
  const [step, setStep] = useState(1);
  const [apiBase, setApiBase] = useState(defaultApi);
  const [apiKey, setApiKey] = useState(defaultKey);
  const [test, setTest] = useState(null); // {tone, msg}
  const [prof, setProf] = useState({ user_id: 'Varun', age: 30, sex: 'M', height_cm: 178, weight_kg: 78, activity: 'moderate', goal: 'recomp' });
  const [safetyAck, setSafetyAck] = useState(false);

  async function testConn() {
    setTest({ tone: 'dim', msg: 'Testing…' });
    try {
      const r = await fetch(apiBase.trim() + '/healthz');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const r2 = await fetch(apiBase.trim() + '/v1/auth/check', {
        headers: apiKey ? { Authorization: 'Bearer ' + apiKey.trim() } : {},
      });
      if (r2.status === 401) return setTest({ tone: 'err', msg: 'Server reached, but the API key is wrong.' });
      if (r2.status === 503) return setTest({ tone: 'warn', msg: 'Server reached, but no API key is configured on the server.' });
      if (r2.ok) return setTest({ tone: 'ok', msg: '✓ Connected & authenticated.' });
      setTest({ tone: 'warn', msg: 'Server reachable, unexpected response ' + r2.status + '.' });
    } catch (e) {
      setTest({ tone: 'err', msg: e.message + ' — check the server is running and CORS allows this origin.' });
    }
  }

  async function finish(enableSurveillance) {
    setConnection(apiBase.trim(), apiKey.trim());
    const p = { ...prof, age: parseInt(prof.age), height_cm: parseFloat(prof.height_cm), weight_kg: parseFloat(prof.weight_kg) };
    saveProfileLocal(p);
    if (enableSurveillance) {
      try {
        await fetch(apiBase.trim() + '/v1/user/surveillance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: 'Bearer ' + apiKey.trim() } : {}) },
          body: JSON.stringify({ on: true, acknowledged_medical_disclaimer: true }),
        });
      } catch (_) { /* offline; retry from Settings */ }
    }
    localStorage.setItem('varunos_onboarded', '1');
    onDone();
  }

  const F = ({ label, children }) => (
    <div className="field">{typeof label === 'string' ? <label>{label}</label> : label}{children}</div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'var(--bg)', overflowY: 'auto' }}>
      <div className="ambient" />
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '40px 22px 80px' }}>
        {/* progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 36 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <motion.div key={i} animate={{ background: i <= step ? 'var(--mint)' : 'rgba(255,255,255,0.08)' }}
              style={{ height: 3, flex: 1, borderRadius: 3 }} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="1" {...slide}>
              <div style={{ color: 'var(--mint)', marginBottom: 18 }}><IconSparkle width={34} height={34} /></div>
              <h2 className="display" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1, marginBottom: 14 }}>
                Your health,<br />running on <span style={{ color: 'var(--mint)' }}>your</span> server.
              </h2>
              <p className="meta" style={{ marginBottom: 10, fontSize: 14 }}>
                VarunOS is a personal AI coach OS. Data lives in your SQLite file. Nothing
                leaves the box unless you share it.
              </p>
              <p className="meta" style={{ marginBottom: 28, fontSize: 14 }}>
                It is an MVP for personal use — not a medical device. It computes risk tiers
                with the same validated screening tools a doctor would use, but it does not diagnose.
              </p>
              <button className="btn primary full" onClick={() => setStep(2)}>Get started</button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="2" {...slide}>
              <h2 className="display" style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>Connect to your server</h2>
              <div style={{ background: 'var(--mint-dim)', border: '1px solid rgba(46,230,168,0.25)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: 'var(--dim)', marginBottom: 18 }}>
                Already set up on another device? Open Settings → <b>Copy pairing link</b> there,
                then open that link here — this whole step disappears.
              </div>
              <div className="field"><label>API base URL</label>
                <input style={{ width: 220, textAlign: 'left' }} value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder="https://varunos.onrender.com" /></div>
              <div className="field"><label>API key</label>
                <input style={{ width: 220, textAlign: 'left' }} type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="VARUNOS_API_KEY" /></div>
              {test && <p className={test.tone} style={{ margin: '8px 0' }}>{test.msg}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn ghost" onClick={() => setStep(1)}>Back</button>
                <button className="btn ghost" onClick={testConn}>Test</button>
                <button className="btn primary" style={{ flex: 1 }} disabled={!apiBase.trim()} onClick={() => setStep(3)}>Continue</button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="3" {...slide}>
              <h2 className="display" style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Your basics</h2>
              <p className="meta" style={{ marginBottom: 16 }}>These drive every computation. Change them any time in Settings.</p>
              <F label="Name"><input value={prof.user_id} onChange={(e) => setProf({ ...prof, user_id: e.target.value })} /></F>
              <F label="Age"><input type="number" value={prof.age} onChange={(e) => setProf({ ...prof, age: e.target.value })} /></F>
              <F label="Sex">
                <select value={prof.sex} onChange={(e) => setProf({ ...prof, sex: e.target.value })}>
                  <option value="M">Male</option><option value="F">Female</option>
                </select>
              </F>
              <F label="Height (cm)"><input type="number" value={prof.height_cm} onChange={(e) => setProf({ ...prof, height_cm: e.target.value })} /></F>
              <F label="Weight (kg)"><input type="number" step="0.1" value={prof.weight_kg} onChange={(e) => setProf({ ...prof, weight_kg: e.target.value })} /></F>
              <F label="Activity">
                <select value={prof.activity} onChange={(e) => setProf({ ...prof, activity: e.target.value })}>
                  <option value="sedentary">Sedentary</option><option value="light">Light</option>
                  <option value="moderate">Moderate</option><option value="very_active">Very Active</option>
                  <option value="athlete">Athlete</option>
                </select>
              </F>
              <F label="Goal">
                <select value={prof.goal} onChange={(e) => setProf({ ...prof, goal: e.target.value })}>
                  <option value="cut">Cut</option><option value="recomp">Recomp</option>
                  <option value="lean_bulk">Lean bulk</option><option value="bulk">Bulk</option>
                </select>
              </F>
              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button className="btn ghost" onClick={() => setStep(2)}>Back</button>
                <button className="btn primary" style={{ flex: 1 }} onClick={() => setStep(4)}>Continue</button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="4" {...slide}>
              <div style={{ color: 'var(--amber)', marginBottom: 14 }}><IconShield width={30} height={30} /></div>
              <h2 className="display" style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>Safety</h2>
              <p className="meta" style={{ marginBottom: 12 }}>
                VarunOS is a personal-use educational tool, not a medical device. Risk tiers are
                screening estimates, not diagnoses.
              </p>
              <p className="meta" style={{ marginBottom: 12 }}>
                If you have symptoms — chest pain, sudden weakness on one side, slurred speech,
                severe headache, sudden vision loss — call your local emergency number
                (911 US, 108 India, 112 EU) immediately. The app will not do it for you.
              </p>
              <p className="meta" style={{ marginBottom: 18 }}>
                If a tier comes back elevated, the action label will be <i>"discuss with your doctor"</i> — not a diagnosis.
              </p>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 18 }}>
                <input type="checkbox" checked={safetyAck} onChange={(e) => setSafetyAck(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
                <span style={{ fontSize: 14, color: 'var(--dim)' }}>I understand and accept these limits.</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" onClick={() => setStep(3)}>Back</button>
                <button className="btn primary" style={{ flex: 1 }} disabled={!safetyAck} onClick={() => setStep(5)}>Continue</button>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="5" {...slide}>
              <h2 className="display" style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>Health surveillance</h2>
              <p className="meta" style={{ marginBottom: 12 }}>
                <b style={{ color: 'var(--text)' }}>OFF by default.</b> With it off, the app still computes
                risk tiers from your BP / glucose values, but raw numbers are not stored on the server.
              </p>
              <p className="meta" style={{ marginBottom: 20 }}>
                Turn it on for trends, weekly reports, and the doctor-share export to include raw values.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" onClick={() => setStep(4)}>Back</button>
                <button className="btn ghost" onClick={() => finish(false)}>Keep OFF</button>
                <button className="btn primary" style={{ flex: 1 }} onClick={() => finish(true)}>Enable & finish</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
