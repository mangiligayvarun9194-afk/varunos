// Settings: profile, wearable sync, backend connection, device security
// (PIN + pairing links), surveillance consent, local data. All endpoints
// and localStorage keys identical to the legacy PWA.
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api, API_BASE, API_KEY, setConnection, getProfile, saveProfileLocal, makePairLink } from '../api.js';
import { Sheet, useToast, stagger, rise } from '../components/ui.jsx';
import { IconWatch, IconLock, IconLink, IconShield, IconVault, IconDownload } from '../components/Icons.jsx';

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
  const [vault, setVault] = useState(undefined);
  const [dl, setDl] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [me, setMe] = useState(null);
  const [imp, setImp] = useState(null);     // workout-history import status
  const importRef = useRef(null);

  async function importHistory(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setImp({ busy: true, msg: 'Reading file…' });
    try {
      const text = await file.text();
      const r = await api('/v1/import/hevy', { method: 'POST', body: { csv: text } });
      const s = r.summary || {};
      const extra = r.skipped_existing ? ` · ${r.skipped_existing} already present` : '';
      setImp({ busy: false, msg: `Imported ${r.imported} sessions (${s.sets || 0} sets)${extra}.` });
      toast('Workout history imported 💪');
    } catch (_) {
      setImp({ busy: false, msg: 'Import failed — make sure it’s a Hevy CSV export.' });
    }
    if (e.target) e.target.value = '';
  }

  // Exact, copy-paste-ready building blocks for the Shortcut — always reflect THIS
  // device's real backend URL + key, so there's nothing for the user to guess.
  const SYNC_URL = API_BASE + '/v1/sync/wearable';
  const SYNC_BODY = '{"source":"apple_health","hrv_ms":[HRV],"rhr_bpm":[RHR],"sleep_hours":[Sleep],"steps":[Steps]}';

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      toast((label || 'Copied') + ' copied');
    } catch (_) { toast('Copy failed — long-press to select'); }
  }

  // "Test connection": a real round-trip with dry_run, so it proves auth +
  // reachability + parsing + readiness without writing anything to history.
  async function testSync() {
    setTesting(true); setTestResult(null);
    try {
      const r = await api('/v1/sync/wearable', { method: 'POST', body: {
        dry_run: true, source: 'apple_health',
        hrv_ms: 62, rhr_bpm: 53, sleep_hours: 7.5, steps: 8200,
      } });
      setTestResult({ tone: r.ok ? 'ok' : 'warn',
        msg: r.ok ? '✓ ' + r.message : '⚠ ' + (r.message || 'No data parsed') });
    } catch (e) {
      const m = String(e && e.message || e);
      setTestResult({ tone: 'err', msg: /401|403/.test(m)
        ? '✕ Auth failed — check your API key under “Backend connection” below.'
        : '✕ Couldn’t reach the API — check the base URL and your connection.' });
    }
    setTesting(false);
  }

  async function refreshSync() {
    try { setSync(await api('/v1/sync/status')); } catch (_) { setSync(null); }
  }
  async function refreshConsent() {
    try { setSurv((await api('/v1/user/surveillance')).surveillance_on); } catch (_) { setSurv(null); }
  }
  async function refreshVault() {
    try { setVault(await api('/v1/vault/preview')); } catch (_) { setVault(null); }
  }
  useEffect(() => {
    refreshSync(); refreshConsent(); refreshVault();
    api('/v1/auth/me').then(setMe).catch(() => setMe(null));
  }, []);

  async function downloadVault() {
    setDl(true);
    try {
      const r = await fetch(API_BASE + '/v1/vault/export',
        { headers: API_KEY ? { Authorization: 'Bearer ' + API_KEY } : {} });
      if (!r.ok) throw new Error('export failed');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'sarathi-health-vault.zip';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast('Health Vault downloaded — it’s yours.');
    } catch (e) { toast('Couldn’t export — try again.'); }
    setDl(false);
  }

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

  async function logout() {
    if (!confirm('Log out of Sarathi on this device?')) return;
    try { await api('/v1/auth/logout', { method: 'POST' }); } catch (_) {}
    ['varunos_key', 'varunos_onboarded', 'varunos_paired'].forEach((k) => localStorage.removeItem(k));
    setTimeout(() => location.reload(), 150);
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
    if (!confirm('Clear all Sarathi data stored in this browser? (server data is untouched.)')) return;
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
          <button className="btn ghost" onClick={testSync} disabled={testing}>{testing ? 'Testing…' : 'Test connection'}</button>
          <button className="btn ghost" onClick={() => setManualOpen(true)}>Enter manually</button>
        </div>
        {testResult && <p className={testResult.tone} style={{ marginTop: 8 }}>{testResult.msg}</p>}
        {showWatchHelp && (
          <div className="card" style={{ background: 'var(--surface-2)', marginTop: 12 }}>
            <h3 style={{ fontSize: 14 }}>iPhone / Apple Watch (2 min, one time)</h3>
            <p className="meta" style={{ margin: '8px 0' }}>The free <b>Shortcuts</b> app reads Apple Health and posts to Sarathi each morning. Tap a button below to copy each value exactly — nothing to type.</p>
            <ol className="meta" style={{ margin: '0 0 8px 18px', lineHeight: 1.9 }}>
              <li>Open <b>Shortcuts</b> → <b>Automation</b> tab → <b>+</b> → <b>Time of Day</b> → 7:00 AM, Daily → <b>Run Immediately</b></li>
              <li>Add action <b>Find Health Samples</b> → HRV, sort Latest, Limit 1. Repeat for Resting Heart Rate, Sleep Analysis, Steps.</li>
              <li>Add <b>Get Contents of URL</b> and fill it in with the copied values below (Method <b>POST</b>):</li>
            </ol>
            <div style={{ display: 'grid', gap: 6, margin: '8px 0' }}>
              <CopyRow label="URL" hint={SYNC_URL} onCopy={() => copyText(SYNC_URL, 'Sync URL')} />
              <CopyRow label="Header" hint={'Authorization: Bearer ' + (API_KEY ? API_KEY.slice(0, 6) + '…' : 'YOUR_KEY')}
                onCopy={() => copyText('Bearer ' + (API_KEY || 'YOUR_KEY'), 'Authorization')} />
              <CopyRow label="Request Body (JSON)" hint={SYNC_BODY}
                onCopy={() => copyText(SYNC_BODY, 'JSON body')} />
            </div>
            <p className="meta" style={{ margin: '8px 0' }}>In the body, replace each <code>[HRV]</code>/<code>[RHR]</code>/<code>[Sleep]</code>/<code>[Steps]</code> with the matching <b>Find Health Samples</b> variable (the “Magic Variable”). Units don’t matter — Sarathi parses them.</p>
            <ol className="meta" style={{ margin: '0 0 8px 18px', lineHeight: 1.9 }} start="4">
              <li>Header → <b>Request Body: JSON</b>; add field <code>Authorization</code> with the copied Header value.</li>
              <li>Turn off <b>Ask Before Running</b> → <b>Done</b>. Then tap <b>Test connection</b> above to confirm.</li>
            </ol>
            <p className="meta">Full illustrated recipe + Siri (“Hey Siri, sync my health”): <code>shortcuts/README.md</code>.</p>
          </div>
        )}
      </motion.div>

      <motion.div variants={rise} className="card">
        <h3 style={{ marginBottom: 8 }}>Backend connection</h3>
        <p className="meta" style={{ marginBottom: 8 }}>Where this app talks to the Sarathi API. Stored only in this browser.</p>
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
            I understand Sarathi is a personal-use educational tool, not a medical device, and risk
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
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color: 'var(--cyan)' }}><IconVault width={17} height={17} /></span> Health Vault
        </h3>
        <p className="meta" style={{ marginBottom: 12 }}>
          Your whole health story as open Markdown files you own forever — every day,
          workout, and PR, cross-linked. Open it in Obsidian to see your graph, or keep it
          anywhere. We never hold your data hostage.
        </p>
        {vault && !vault.error && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {[['Days', vault.days], ['Exercises', vault.exercises], ['Meals', vault.meals]].map(([k, v]) => (
              <div key={k} style={{ textAlign: 'center', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 4px' }}>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{v}</div>
                <div style={{ fontSize: 9, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{k}</div>
              </div>
            ))}
          </div>
        )}
        <button className="btn primary full" disabled={dl} onClick={downloadVault}>
          <IconDownload width={16} height={16} /> {dl ? 'Preparing…' : 'Download your Health Vault'}
        </button>
      </motion.div>

      <motion.div variants={rise} className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color: 'var(--mint)' }}><IconDownload width={17} height={17} /></span> Import workout history
        </h3>
        <p className="meta" style={{ marginBottom: 12 }}>
          Bring your training history from Hevy (or any compatible CSV export). Your real
          dates, weights and reps flow straight into your progress, insights and the Twin’s
          muscle growth. Re-importing the same file is safe — duplicates are skipped.
        </p>
        <input ref={importRef} type="file" accept=".csv,text/csv" onChange={importHistory} style={{ display: 'none' }} />
        <button className="btn primary full" disabled={imp?.busy} onClick={() => importRef.current?.click()}>
          <IconDownload width={16} height={16} /> {imp?.busy ? 'Importing…' : 'Import a workout CSV'}
        </button>
        {imp && !imp.busy && <p className="meta" style={{ marginTop: 10, color: 'var(--mint)' }}>{imp.msg}</p>}
      </motion.div>

      <motion.div variants={rise} className="card">
        <h3 style={{ marginBottom: 8 }}>Account</h3>
        {me?.account
          ? <div className="row"><span className="lbl">Signed in as</span><span className="val">{me.email}</span></div>
          : <p className="meta" style={{ marginBottom: 4 }}>Connected with a self-hosted API key (owner mode).</p>}
        <div style={{ marginTop: 12 }}>
          <button className="btn ghost full" onClick={logout}>Log out</button>
        </div>
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

// One copy-to-clipboard row: a label, the exact value (truncated for display),
// and a Copy button — so the user never mistypes the URL, header or JSON body.
function CopyRow({ label, hint, onCopy }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)',
      border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="meta" style={{ fontSize: 11, color: 'var(--mute)' }}>{label}</div>
        <code style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis', fontSize: 12 }}>{hint}</code>
      </div>
      <button className="btn ghost" style={{ flexShrink: 0, padding: '6px 12px', fontSize: 12 }} onClick={onCopy}>Copy</button>
    </div>
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
