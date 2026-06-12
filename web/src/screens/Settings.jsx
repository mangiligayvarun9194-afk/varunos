// Settings: profile, wearable sync, backend connection, device security
// (PIN + pairing links), surveillance consent, local data. All endpoints
// and localStorage keys identical to the legacy PWA.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, API_BASE, API_KEY, setConnection, getProfile, saveProfileLocal, makePairLink } from '../api.js';
import { Sheet, useToast, stagger, rise } from '../components/ui.jsx';
import { IconWatch, IconLock, IconLink, IconShield } from '../components/Icons.jsx';

export default function Settings({ onTab, onSetupPin }) {
  const toast = useToast();
  const [prof, setProf] = useState(getProfile());
  const [profStatus, setProfStatus] = useState(null);
  const [sync, setSync] = useState(undefined);
  const [showWatchHelp, setShowWatchHelp] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [connBase, setConnBase] = useState(API_BASE);
  const [connKey, setConnKey] = useState(API_KEY);
  const [connStatus, setConnStatus] = useState(null);
  const [surv, setSurv] = useState(undefined);
  const [survAck, setSurvAck] = useState(false);
  const [survStatus, setSurvStatus] = useState(null);

  async function refreshSync() {
    try { setSync(await api('/v1/sync/status')); } catch (_) { setSync(null); }
  }
  async function refreshConsent() {
    try { setSurv((await api('/v1/user/surveillance')).surveillance_on); } catch (_) { setSurv(null); }
  }
  useEffect(() => { refreshSync(); refreshConsent(); }, []);

  async function saveProfile() {
    const p = {
      ...prof,
      age: parseInt(prof.age), height_cm: parseFloat(prof.height_cm), weight_kg: parseFloat(prof.weight_kg),
      user_id: prof.user_id || 'user',
    };
    saveProfileLocal(p);
    try {
      await api('/v1/user/profile', { method: 'PUT', body: {
        name: p.user_id, sex: p.sex, age: p.age, height_cm: p.height_cm, weight_kg: p.weight_kg,
        activity: p.activity, goal: p.goal, workout_time_pref: p.workout_time_pref,
      }});
    } catch (_) {}
    setProfStatus('✓ Saved. Reloading Today…');
    setTimeout(() => onTab('today'), 600);
  }

  async function saveConn() {
    setConnection(connBase.trim(), connKey.trim());
    setConnStatus({ tone: 'meta', msg: 'Testing…' });
    try {
      const r = await fetch(connBase.trim() + '/v1/auth/check', {
        headers: connKey ? { Authorization: 'Bearer ' + connKey.trim() } : {},
      });
      setConnStatus(r.ok
        ? { tone: 'ok', msg: 'Connected & saved.' }
        : { tone: 'err', msg: `HTTP ${r.status} — check key.` });
    } catch (e) { setConnStatus({ tone: 'err', msg: e.message }); }
  }

  async function setConsent(on) {
    if (on && !survAck) { setSurvStatus({ tone: 'err', msg: 'Please tick the acknowledgement first.' }); return; }
    try {
      await api('/v1/user/surveillance', { method: 'POST', body: { on, acknowledged_medical_disclaimer: survAck } });
      setSurvStatus({ tone: 'ok', msg: on ? '✓ Enabled' : '✓ Disabled' });
      refreshConsent();
    } catch (e) { setSurvStatus({ tone: 'err', msg: e.message }); }
  }

  function copyPairLink() {
    const link = makePairLink();
    if (!link) { toast('Connect to your server first'); return; }
    navigator.clipboard.writeText(link).then(
      () => toast('Pairing link copied — open it on your other device'),
      () => prompt('Copy this pairing link:', link));
  }

  function removePin() {
    localStorage.removeItem('varunos_pin');
    localStorage.removeItem('varunos_bio');
    localStorage.setItem('varunos_pin_skipped', '1');
    toast('PIN lock removed');
  }

  function clearCache() {
    if (!confirm('Clear all VarunOS data stored in this browser? (server data is untouched.)')) return;
    ['varunos_api', 'varunos_key', 'varunos_profile', 'varunos_checkin', 'varunos_onboarded',
      'varunos_surveillance_ack', 'varunos_pin', 'varunos_bio', 'varunos_pin_skipped',
      'varunos_paired', 'varunos_avatar_url', 'twin_last_ex'].forEach((k) => localStorage.removeItem(k));
    location.reload();
  }

  const F = ({ label, children }) => <div className="field"><label>{label}</label>{children}</div>;
  const set = (k) => (e) => setProf({ ...prof, [k]: e.target.value });
  const srcNames = { apple_health: 'Apple Health', fitbit: 'Fitbit', oura: 'Oura', whoop: 'Whoop', garmin: 'Garmin' };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={rise} style={{ margin: '26px 0 20px' }}>
        <h2 className="display" style={{ fontSize: 30, fontWeight: 700 }}>Settings</h2>
        <p className="meta">Your profile drives every computation</p>
      </motion.div>

      <motion.div variants={rise} className="card">
        <h3 style={{ marginBottom: 8 }}>Profile</h3>
        <F label="Name"><input value={prof.user_id} onChange={set('user_id')} /></F>
        <F label="Age"><input type="number" value={prof.age} onChange={set('age')} /></F>
        <F label="Sex"><select value={prof.sex} onChange={set('sex')}><option value="M">Male</option><option value="F">Female</option></select></F>
        <F label="Height (cm)"><input type="number" value={prof.height_cm} onChange={set('height_cm')} /></F>
        <F label="Weight (kg)"><input type="number" step="0.1" value={prof.weight_kg} onChange={set('weight_kg')} /></F>
        <F label="Activity">
          <select value={prof.activity} onChange={set('activity')}>
            <option value="sedentary">Sedentary</option><option value="light">Light</option>
            <option value="moderate">Moderate</option><option value="very_active">Very Active</option>
            <option value="athlete">Athlete</option>
          </select></F>
        <F label="Goal">
          <select value={prof.goal} onChange={set('goal')}>
            <option value="cut">Cut</option><option value="recomp">Recomp</option>
            <option value="lean_bulk">Lean bulk</option><option value="bulk">Bulk</option>
          </select></F>
        <F label="Workout time">
          <select value={prof.workout_time_pref || 'flexible'} onChange={set('workout_time_pref')}>
            <option value="morning">Morning</option><option value="evening">Evening</option>
            <option value="flexible">Flexible</option>
          </select></F>
        <button className="btn primary full" style={{ marginTop: 12 }} onClick={saveProfile}>Save profile</button>
        {profStatus && <p className="ok" style={{ marginTop: 8 }}>{profStatus}</p>}
      </motion.div>

      <motion.div variants={rise} className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color: 'var(--mint)' }}><IconWatch width={18} height={18} /></span> Smartwatch sync
        </h3>
        <p className="meta" style={{ marginBottom: 10 }}>
          Auto-sync HRV, resting HR, sleep and steps each morning. Works with anything that
          writes to Apple Health.
        </p>
        <div className="row"><span className="lbl">Status</span>
          <span className="val">
            {sync === undefined ? 'checking…'
              : sync?.connected ? <span style={{ color: 'var(--green)' }}>● {srcNames[sync.source] || sync.source} · {new Date(sync.last_sync).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
              : sync === null ? <span style={{ color: 'var(--red)' }}>API unreachable</span>
              : <span style={{ color: 'var(--mute)' }}>● Not connected</span>}
          </span>
        </div>
        {sync?.connected && sync.today && (
          <>
            {sync.today.hrv_ms && <div className="row"><span className="lbl">HRV</span><span className="val">{Math.round(sync.today.hrv_ms)} ms</span></div>}
            {sync.today.rhr_bpm && <div className="row"><span className="lbl">Resting HR</span><span className="val">{Math.round(sync.today.rhr_bpm)} bpm</span></div>}
            {sync.today.sleep_min && <div className="row"><span className="lbl">Sleep</span><span className="val">{(sync.today.sleep_min / 60).toFixed(1)} h</span></div>}
            {sync.today.steps && <div className="row"><span className="lbl">Steps</span><span className="val">{sync.today.steps.toLocaleString()}</span></div>}
          </>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => setShowWatchHelp(!showWatchHelp)}>Set up auto-sync</button>
          <button className="btn ghost" onClick={() => setManualOpen(true)}>Enter manually</button>
        </div>
        {showWatchHelp && (
          <div className="card" style={{ background: 'var(--surface-2)', marginTop: 12 }}>
            <h3 style={{ fontSize: 14 }}>iPhone / Apple Watch (2 min, one time)</h3>
            <p className="meta" style={{ margin: '8px 0' }}>The free <b>Shortcuts</b> app reads Apple Health and posts to VarunOS each morning.</p>
            <ol className="meta" style={{ margin: '0 0 8px 18px', lineHeight: 1.9 }}>
              <li>Shortcuts → Automation → + → Time of Day → 7:00 AM</li>
              <li>Add <b>Get Health Sample</b> → HRV (most recent); repeat for RHR, Sleep, Steps</li>
              <li>Add <b>Get Contents of URL</b>: <code>{API_BASE}/v1/sync/wearable</code>, POST,
                header <code>Authorization: Bearer YOUR_KEY</code>,
                body <code>{'{"source":"apple_health","hrv_ms":[HRV],"rhr_bpm":[RHR],"sleep_hours":[Sleep],"steps":[Steps]}'}</code></li>
              <li>Turn off "Ask Before Running" → Done</li>
            </ol>
            <p className="meta">Full recipe: <code>shortcuts/README.md</code> in the repo.</p>
          </div>
        )}
      </motion.div>

      <motion.div variants={rise} className="card">
        <h3 style={{ marginBottom: 8 }}>Backend connection</h3>
        <p className="meta" style={{ marginBottom: 8 }}>Where this app talks to the VarunOS API. Stored only in this browser.</p>
        <F label="API base URL"><input style={{ width: 200, textAlign: 'left' }} value={connBase} onChange={(e) => setConnBase(e.target.value)} /></F>
        <F label="API key"><input style={{ width: 200, textAlign: 'left' }} type="password" value={connKey} onChange={(e) => setConnKey(e.target.value)} /></F>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn primary" onClick={saveConn}>Save & test</button>
          <button className="btn ghost" onClick={() => { localStorage.removeItem('varunos_api'); localStorage.removeItem('varunos_key'); setTimeout(() => location.reload(), 200); }}>Clear</button>
        </div>
        {connStatus && <p className={connStatus.tone} style={{ marginTop: 8 }}>{connStatus.msg}</p>}
      </motion.div>

      <motion.div variants={rise} className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color: 'var(--mint)' }}><IconLock width={17} height={17} /></span> Device security & pairing
        </h3>
        <p className="meta" style={{ marginBottom: 12 }}>
          Protect this device with a PIN (and Face ID / Touch ID), and add new devices by link
          instead of pasting keys.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn ghost full" onClick={onSetupPin}>Set up / change PIN</button>
          <button className="btn ghost full" onClick={copyPairLink}><IconLink width={16} height={16} /> Copy pairing link for a new device</button>
          <button className="btn danger full" onClick={removePin}>Remove PIN lock</button>
        </div>
        <p className="meta" style={{ marginTop: 10, fontSize: 11 }}>
          ⚠ The pairing link contains your API key — share it only with yourself (AirDrop / your
          own notes), never in chat groups.
        </p>
      </motion.div>

      <motion.div variants={rise} className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color: 'var(--mint)' }}><IconShield width={17} height={17} /></span> Health surveillance (opt-in)
        </h3>
        <p className="meta">
          Off by default. When OFF, BP / glucose values still compute a risk tier but raw numbers
          are NOT stored on the server. When ON, raw values are stored and used for the weekly trend.
        </p>
        <div className="row" style={{ marginTop: 8 }}>
          <span className="lbl">Status</span>
          <span className="val">
            {surv === undefined ? 'checking…'
              : surv === null ? <span style={{ color: 'var(--red)' }}>API unreachable</span>
              : surv ? <span style={{ color: 'var(--green)' }}>● ON (raw values stored)</span>
              : <span style={{ color: 'var(--amber)' }}>● OFF (only tiers)</span>}
          </span>
        </div>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', margin: '12px 0' }}>
          <input type="checkbox" checked={survAck} onChange={(e) => setSurvAck(e.target.checked)} style={{ width: 17, height: 17, marginTop: 2 }} />
          <span style={{ fontSize: 13, color: 'var(--dim)' }}>
            I understand VarunOS is a personal-use educational tool, not a medical device, and risk
            tiers are screening estimates, not diagnoses.
          </span>
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={() => setConsent(true)}>Enable</button>
          <button className="btn ghost" onClick={() => setConsent(false)}>Disable</button>
        </div>
        {survStatus && <p className={survStatus.tone} style={{ marginTop: 8 }}>{survStatus.msg}</p>}
      </motion.div>

      <motion.div variants={rise} className="card">
        <h3 style={{ marginBottom: 8 }}>System</h3>
        <div className="row"><span className="lbl">API endpoint</span><span className="val" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{API_BASE}</span></div>
        <div className="row"><span className="lbl">Version</span><span className="val">v3.0.0</span></div>
        <div className="row"><span className="lbl">Legacy UI</span><span className="val"><a href="/legacy" style={{ color: 'var(--mint)' }}>/legacy</a></span></div>
        <div style={{ marginTop: 12 }}>
          <button className="btn ghost" onClick={clearCache}>Clear browser cache</button>
        </div>
      </motion.div>

      <Sheet open={manualOpen} onClose={() => setManualOpen(false)} title="Enter today's watch data">
        <ManualSync onDone={() => { setManualOpen(false); refreshSync(); onTab('today'); }} />
      </Sheet>
    </motion.div>
  );
}

function ManualSync({ onDone }) {
  const [v, setV] = useState({ hrv: '', rhr: '', sleep: '', steps: '' });
  const [out, setOut] = useState(null);
  async function submit() {
    const body = { source: 'apple_health' };
    if (v.hrv) body.hrv_ms = parseFloat(v.hrv);
    if (v.rhr) body.rhr_bpm = parseFloat(v.rhr);
    if (v.sleep) body.sleep_hours = parseFloat(v.sleep);
    if (v.steps) body.steps = parseInt(v.steps);
    setOut({ busy: true });
    try {
      const r = await api('/v1/sync/wearable', { method: 'POST', body });
      setOut({ r: r.readiness });
    } catch (e) { setOut({ err: e.message }); }
  }
  const tone = out?.r ? (out.r.color === 'GREEN' ? 'var(--green)' : out.r.color === 'YELLOW' ? 'var(--amber)' : 'var(--red)') : null;
  return (
    <div>
      <p className="meta" style={{ marginBottom: 14 }}>Read these off your watch/app. Leave any blank.</p>
      <div className="field"><label>HRV (ms)</label><input type="number" placeholder="62" value={v.hrv} onChange={(e) => setV({ ...v, hrv: e.target.value })} /></div>
      <div className="field"><label>Resting HR (bpm)</label><input type="number" placeholder="54" value={v.rhr} onChange={(e) => setV({ ...v, rhr: e.target.value })} /></div>
      <div className="field"><label>Sleep (hours)</label><input type="number" step="0.1" placeholder="7.5" value={v.sleep} onChange={(e) => setV({ ...v, sleep: e.target.value })} /></div>
      <div className="field"><label>Steps</label><input type="number" placeholder="8000" value={v.steps} onChange={(e) => setV({ ...v, steps: e.target.value })} /></div>
      <button className="btn primary full" style={{ marginTop: 14 }} disabled={out?.busy} onClick={submit}>
        {out?.busy ? 'Syncing…' : 'Sync & compute readiness'}
      </button>
      {out?.err && <p className="err" style={{ marginTop: 10 }}>{out.err}</p>}
      {out?.r && (
        <div className="card" style={{ marginTop: 12, borderColor: `${tone}55` }}>
          <h3 style={{ color: tone }}>Readiness {Math.round(out.r.overall)} · {out.r.color}</h3>
          <p className="meta">Synced ✓ Components: {Object.keys(out.r.components).join(', ')}</p>
          <button className="btn primary full" style={{ marginTop: 10 }} onClick={onDone}>Done</button>
        </div>
      )}
    </div>
  );
}
