import { useEffect, useState } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { API_BASE, API_KEY, healthCheck, getProfile, setConnection } from './api.js';
import { ToastProvider, Dock } from './components/ui.jsx';
import { IconLock } from './components/Icons.jsx';
import Lock from './screens/Lock.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Today from './screens/Today.jsx';
import Log from './screens/Log.jsx';
import Twin from './screens/Twin.jsx';
import Insights from './screens/Insights.jsx';
import Coach from './screens/Coach.jsx';
import Settings from './screens/Settings.jsx';

export default function App() {
  const [onboarded, setOnboarded] = useState(!!localStorage.getItem('varunos_onboarded'));
  const [lockMode, setLockMode] = useState(() => {
    if (!localStorage.getItem('varunos_onboarded')) return null;
    if (localStorage.getItem('varunos_pin')) return 'unlock';
    if (!localStorage.getItem('varunos_pin_skipped')) return 'create';
    return null;
  });
  const [tab, setTab] = useState('today');
  const [sheet, setSheet] = useState(null); // checkin | workout | meal | bp | glucose
  const [connected, setConnected] = useState(null);
  const [authed, setAuthed] = useState(null); // null=checking, true=ok, false=bad/missing key
  const [tabEpoch, setTabEpoch] = useState(0); // remounts the active screen on revisit

  async function checkAuth() {
    try {
      const r = await fetch(API_BASE + '/v1/auth/check',
        { headers: API_KEY ? { Authorization: 'Bearer ' + API_KEY } : {} });
      // Only gate on a definitive auth failure — never lock the user out on a
      // network blip (that's the offline pill's job, not a full takeover).
      setAuthed(!(r.status === 401 || r.status === 403));
    } catch (_) { setAuthed(true); }
  }

  useEffect(() => {
    healthCheck().then(setConnected);
    checkAuth();
    const t = setInterval(() => healthCheck().then(setConnected), 30000);
    return () => clearInterval(t);
  }, []);

  function openTab(name) {
    setSheet(null);
    setTab(name);
    setTabEpoch((e) => e + 1);
  }

  function openSheet(kind) {
    if (tab !== 'log') setTab('log');
    setSheet(kind);
  }

  function setupPinFromSettings() {
    localStorage.removeItem('varunos_pin');
    localStorage.removeItem('varunos_pin_skipped');
    setLockMode('create');
  }

  if (!onboarded) {
    return (
      <ToastProvider>
        <Onboarding defaultApi={API_BASE} defaultKey={API_KEY}
          onDone={() => location.reload()} />
      </ToastProvider>
    );
  }

  // A bad or missing API key would make every call 401 and leave the app blank.
  // Catch it and guide the user to connect — never show an empty screen.
  if (authed === false) {
    return (
      <ToastProvider>
        <ConnectScreen onConnected={() => location.reload()} />
      </ToastProvider>
    );
  }

  const initial = getProfile().user_id?.charAt(0)?.toUpperCase() || 'V';

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <div className="ambient" />

        {lockMode && <Lock mode={lockMode} onUnlock={() => setLockMode(null)} />}

        {/* top bar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(6,8,13,0.75)', borderBottom: '1px solid var(--line)',
          backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h1 className="display" style={{ fontSize: 19, fontWeight: 700 }}>
            Sarathi
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 650,
              color: 'var(--mute)', border: '1px solid var(--line)', borderRadius: 999, padding: '4px 11px',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: connected === null ? 'var(--mute)' : connected ? 'var(--green)' : 'var(--red)',
                boxShadow: connected ? '0 0 8px rgba(52,211,153,0.9)' : 'none',
              }} />
              {connected === null ? 'checking' : connected ? 'connected' : 'offline'}
            </span>
            <div style={{
              width: 34, height: 34, borderRadius: 11, background: 'var(--mint)',
              color: '#04150e', fontWeight: 800, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(46,230,168,0.35)',
            }}>{initial}</div>
          </div>
        </header>

        <main className="app-main">
          <motion.div
            key={tab + tabEpoch}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            {tab === 'today' && <Today onOpenSheet={openSheet} onTab={openTab} />}
            {tab === 'log' && <Log sheet={sheet} onOpenSheet={setSheet} onCloseSheet={() => setSheet(null)} onTab={openTab} />}
            {tab === 'twin' && <Twin />}
            {tab === 'insights' && <Insights />}
            {tab === 'coach' && <Coach />}
            {tab === 'settings' && <Settings onTab={openTab} onSetupPin={setupPinFromSettings} />}
          </motion.div>
        </main>

        <Dock tab={tab} onTab={openTab} />
      </ToastProvider>
    </MotionConfig>
  );
}

function ConnectScreen({ onConnected }) {
  const [base, setBase] = useState(API_BASE);
  const [key, setKey] = useState(API_KEY);
  const [status, setStatus] = useState(null);

  async function connect() {
    if (!key.trim()) { setStatus({ tone: 'err', msg: 'Paste your server API key to connect.' }); return; }
    setStatus({ tone: 'meta', msg: 'Connecting…' });
    try {
      const r = await fetch(base.trim() + '/v1/auth/check',
        { headers: { Authorization: 'Bearer ' + key.trim() } });
      if (r.ok) {
        setConnection(base.trim(), key.trim());
        setStatus({ tone: 'ok', msg: 'Connected.' });
        setTimeout(onConnected, 400);
      } else if (r.status === 401 || r.status === 403) {
        setStatus({ tone: 'err', msg: 'That key was rejected — check it and try again.' });
      } else {
        setStatus({ tone: 'err', msg: 'Unexpected response (' + r.status + ').' });
      }
    } catch (e) {
      setStatus({ tone: 'err', msg: e.message + ' — is the server URL right?' });
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div className="ambient" />
      <div style={{ position: 'relative', width: '100%', maxWidth: 380 }}>
        <div style={{ color: 'var(--mint)', display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <IconLock width={30} height={30} />
        </div>
        <h2 className="display" style={{ fontSize: 24, fontWeight: 700, textAlign: 'center' }}>
          Connect to Sarathi
        </h2>
        <p className="meta" style={{ textAlign: 'center', margin: '6px 0 22px' }}>
          Enter your server's address and API key. Stored only on this device.
        </p>
        <div className="field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <label>Server URL</label>
          <input style={{ width: '100%', textAlign: 'left' }} value={base}
            onChange={(e) => setBase(e.target.value)} placeholder="https://your-server.onrender.com" />
        </div>
        <div className="field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <label>API key</label>
          <input style={{ width: '100%', textAlign: 'left' }} type="password" value={key}
            onChange={(e) => setKey(e.target.value)} placeholder="your VARUNOS_API_KEY"
            onKeyDown={(e) => e.key === 'Enter' && connect()} />
        </div>
        <button className="btn primary full" style={{ marginTop: 16 }} onClick={connect}>Connect</button>
        {status && <p className={status.tone} style={{ textAlign: 'center', marginTop: 12 }}>{status.msg}</p>}
      </div>
    </div>
  );
}
