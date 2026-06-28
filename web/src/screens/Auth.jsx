// Auth — the public front door. Create an account or log in; the session token
// the server returns is stored exactly like the legacy API key (Bearer), so the
// rest of the app works unchanged. An "Advanced" panel keeps the owner's direct
// API-key path for self-hosting.
import { useState } from 'react';
import { API_BASE, setConnection } from '../api.js';
import { IconSparkle } from '../components/Icons.jsx';
import { LegalOverlay, LEGAL_VERSION } from './Legal.jsx';

export default function Auth({ onAuthed }) {
  const [mode, setMode] = useState('signup'); // signup | login
  const [base, setBase] = useState(API_BASE);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [advanced, setAdvanced] = useState(false);
  const [key, setKey] = useState('');
  const [legal, setLegal] = useState(null); // null | 'privacy' | 'terms'
  const linkBtn = { background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' };

  async function submit() {
    const e = email.trim().toLowerCase();
    if (!e || !pw) { setStatus({ tone: 'err', msg: 'Email and password are required.' }); return; }
    if (mode === 'signup' && pw.length < 8) { setStatus({ tone: 'err', msg: 'Password must be at least 8 characters.' }); return; }
    setBusy(true); setStatus({ tone: 'meta', msg: mode === 'signup' ? 'Creating your account…' : 'Signing in…' });
    try {
      const path = mode === 'signup' ? '/v1/auth/signup' : '/v1/auth/login';
      const body = mode === 'signup' ? { email: e, password: pw, name: name.trim() } : { email: e, password: pw };
      const res = await fetch(base.trim() + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        setConnection(base.trim(), data.token);
        localStorage.setItem('varunos_onboarded', '1');
        // Record acceptance of the current Privacy Policy + Terms (continuing use
        // = acceptance, per the notice below the form). Auditable server-side.
        if (localStorage.getItem('sarathi_legal_version') !== LEGAL_VERSION) {
          localStorage.setItem('sarathi_legal_version', LEGAL_VERSION);
          fetch(base.trim() + '/v1/legal/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.token },
            body: JSON.stringify({ version: LEGAL_VERSION }),
          }).catch(() => {});
        }
        if (data.user?.name) {
          const prof = JSON.parse(localStorage.getItem('varunos_profile') || '{}');
          localStorage.setItem('varunos_profile', JSON.stringify({ ...prof, name: data.user.name, user_id: data.user.user_id }));
        }
        setStatus({ tone: 'ok', msg: 'Welcome to Sarathi.' });
        setTimeout(onAuthed, 400);
      } else {
        setStatus({ tone: 'err', msg: data.detail || `Couldn't ${mode === 'signup' ? 'sign up' : 'sign in'} (${res.status}).` });
      }
    } catch (err) {
      setStatus({ tone: 'err', msg: err.message + ' — is the server URL right?' });
    }
    setBusy(false);
  }

  async function connectWithKey() {
    if (!key.trim()) { setStatus({ tone: 'err', msg: 'Paste your API key.' }); return; }
    setStatus({ tone: 'meta', msg: 'Connecting…' });
    try {
      const r = await fetch(base.trim() + '/v1/auth/check', { headers: { Authorization: 'Bearer ' + key.trim() } });
      if (r.ok) {
        setConnection(base.trim(), key.trim());
        localStorage.setItem('varunos_onboarded', '1');
        setStatus({ tone: 'ok', msg: 'Connected.' });
        setTimeout(onAuthed, 400);
      } else {
        setStatus({ tone: 'err', msg: 'That key was rejected.' });
      }
    } catch (err) { setStatus({ tone: 'err', msg: err.message }); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, overflowY: 'auto' }}>
      <div className="ambient" />
      {/* cinematic charioteer ambience — matches the homepage front door */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(60% 50% at 50% 32%, rgba(245,181,114,.12), transparent 64%)' }} />
      <img aria-hidden src="/img/charioteer-hero.webp" alt="" style={{ position: 'fixed', right: '-6%', bottom: '-4%', height: '92%', zIndex: 0,
        opacity: 0.14, pointerEvents: 'none', WebkitMaskImage: 'radial-gradient(70% 80% at 60% 45%, #000 40%, transparent 80%)', maskImage: 'radial-gradient(70% 80% at 60% 45%, #000 40%, transparent 80%)' }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380 }}>
        <div style={{ color: 'var(--accent)', display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <IconSparkle width={32} height={32} />
        </div>
        <p style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 11, letterSpacing: '0.28em',
          textTransform: 'uppercase', color: 'var(--accent)', textAlign: 'center', marginBottom: 10 }}>
          सारथि · the charioteer
        </p>
        <h2 className="display" style={{ fontSize: 26, fontWeight: 700, textAlign: 'center' }}>
          {mode === 'signup' ? 'Create your Sarathi' : 'Welcome back'}
        </h2>
        <p className="meta" style={{ textAlign: 'center', margin: '6px 0 20px' }}>
          Own your health. Talk to it, and watch yourself level up.
        </p>

        {/* mode toggle */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--surface-2)', borderRadius: 12, padding: 4, marginBottom: 16 }}>
          {['signup', 'login'].map((m) => (
            <button key={m} onClick={() => { setMode(m); setStatus(null); }}
              className={`btn ${mode === m ? 'primary' : 'ghost'}`}
              style={{ flex: 1, padding: '8px 0', fontSize: 13 }}>
              {m === 'signup' ? 'Create account' : 'Log in'}
            </button>
          ))}
        </div>

        {mode === 'signup' && (
          <div className="field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
            <label>Name</label>
            <input style={{ width: '100%', textAlign: 'left' }} value={name}
              onChange={(e) => setName(e.target.value)} placeholder="What should Hermes call you?" />
          </div>
        )}
        <div className="field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <label>Email</label>
          <input style={{ width: '100%', textAlign: 'left' }} type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
        </div>
        <div className="field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <label>Password</label>
          <input style={{ width: '100%', textAlign: 'left' }} type="password" value={pw}
            onChange={(e) => setPw(e.target.value)} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </div>
        <button className="btn primary full" style={{ marginTop: 14 }} onClick={submit} disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
        </button>
        {status && <p className={status.tone} style={{ textAlign: 'center', marginTop: 12 }}>{status.msg}</p>}

        <p className="meta" style={{ textAlign: 'center', fontSize: 11, marginTop: 18, lineHeight: 1.6 }}>
          Your raw health data never leaves your control. By continuing you accept our{' '}
          <button onClick={() => setLegal('terms')} style={linkBtn}>Terms</button> and{' '}
          <button onClick={() => setLegal('privacy')} style={linkBtn}>Privacy Policy</button>, and that
          Sarathi is an educational tool, not a medical device.
        </p>

        {/* advanced: self-host / owner key */}
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => setAdvanced(!advanced)}>
            {advanced ? 'Hide' : 'Self-hosting? Connect with an API key'}
          </button>
        </div>
        {advanced && (
          <div style={{ marginTop: 10, padding: 14, background: 'var(--surface-2)', borderRadius: 12 }}>
            <div className="field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <label>Server URL</label>
              <input style={{ width: '100%', textAlign: 'left' }} value={base} onChange={(e) => setBase(e.target.value)} />
            </div>
            <div className="field" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <label>API key</label>
              <input style={{ width: '100%', textAlign: 'left' }} type="password" value={key}
                onChange={(e) => setKey(e.target.value)} placeholder="VARUNOS_API_KEY"
                onKeyDown={(e) => e.key === 'Enter' && connectWithKey()} />
            </div>
            <button className="btn ghost full" style={{ marginTop: 10 }} onClick={connectWithKey}>Connect with key</button>
          </div>
        )}
      </div>
      {legal && <LegalOverlay doc={legal} onClose={() => setLegal(null)} />}
    </div>
  );
}
