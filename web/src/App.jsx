import { useEffect, useState } from 'react';
import { motion, MotionConfig, AnimatePresence } from 'framer-motion';
import { API_BASE, API_KEY, healthCheck, getProfile, setConnection } from './api.js';
import { ToastProvider, Dock } from './components/ui.jsx';
import Lock from './screens/Lock.jsx';
import Auth from './screens/Auth.jsx';
import Landing from './screens/Landing.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Today from './screens/Today.jsx';
import Log from './screens/Log.jsx';
import Twin from './screens/Twin.jsx';
import Insights from './screens/Insights.jsx';
import Library from './screens/Library.jsx';
import FormCoach from './screens/FormCoach.jsx';
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
  // Deep-linkable tabs: /?tab=twin opens the app on that tab (validated).
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    return ['today', 'log', 'coach', 'twin', 'insights', 'library', 'formcoach', 'settings'].includes(t) ? t : 'today';
  });
  const [sheet, setSheet] = useState(null); // checkin | workout | meal | bp | glucose
  const [connected, setConnected] = useState(null);
  const [authed, setAuthed] = useState(null); // null=checking, true=ok, false=bad/missing key
  const [tabEpoch, setTabEpoch] = useState(0); // remounts the active screen on revisit
  const [landingDone, setLandingDone] = useState(!!localStorage.getItem('sarathi_seen_landing'));

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

  // Public front door for new/logged-out visitors: the cinematic 3D landing,
  // shown once before the signup screen (CTA → Auth). Returning visitors and
  // anyone with a session skip straight past it.
  const loggedOut = !API_KEY || authed === false;
  if (loggedOut && !landingDone) {
    return (
      <ToastProvider>
        <Landing onStart={() => { localStorage.setItem('sarathi_seen_landing', '1'); setLandingDone(true); }} />
      </ToastProvider>
    );
  }
  if (loggedOut) {
    return (
      <ToastProvider>
        <Auth onAuthed={() => location.reload()} />
      </ToastProvider>
    );
  }

  // Has a session but hasn't completed first-run profile setup (legacy/owner).
  if (!onboarded) {
    return (
      <ToastProvider>
        <Onboarding defaultApi={API_BASE} defaultKey={API_KEY}
          onDone={() => location.reload()} />
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
          background: 'rgba(4,6,10,0.78)', borderBottom: '1px solid var(--line)',
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
              width: 34, height: 34, borderRadius: 11,
              background: 'linear-gradient(150deg, var(--accent-hi), var(--accent) 55%, var(--accent-2))',
              color: 'var(--accent-ink)', fontWeight: 800, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(245,181,114,0.4)',
            }}>{initial}</div>
          </div>
        </header>

        <main className="app-main">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab + tabEpoch}
              initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
              transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.7 }}
            >
              {tab === 'today' && <Today onOpenSheet={openSheet} onTab={openTab} />}
              {tab === 'log' && <Log sheet={sheet} onOpenSheet={setSheet} onCloseSheet={() => setSheet(null)} onTab={openTab} />}
              {tab === 'twin' && <Twin />}
              {tab === 'insights' && <Insights />}
              {tab === 'library' && <Library onTab={openTab} />}
              {tab === 'formcoach' && <FormCoach onTab={openTab} />}
              {tab === 'coach' && <Coach />}
              {tab === 'settings' && <Settings onTab={openTab} onSetupPin={setupPinFromSettings} />}
            </motion.div>
          </AnimatePresence>
        </main>

        <Dock tab={tab} onTab={openTab} />
      </ToastProvider>
    </MotionConfig>
  );
}

