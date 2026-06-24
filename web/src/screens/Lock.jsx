// PIN lock: protects the device-stored key from shoulder surfers and borrowed
// phones. Server auth is still the bearer key. SHA-256 hash stored locally.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { sha256 } from '../api.js';
import { useToast } from '../components/ui.jsx';
import { IconLock } from '../components/Icons.jsx';

export async function offerBiometric(toast) {
  if (!window.PublicKeyCredential) return;
  try {
    const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!ok) return;
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Sarathi' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'varunos-user', displayName: 'Sarathi' },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 30000,
    }});
    if (cred) {
      localStorage.setItem('varunos_bio', btoa(String.fromCharCode(...new Uint8Array(cred.rawId))));
      toast && toast('Face ID / Touch ID enabled');
    }
  } catch (_) {}
}

export default function Lock({ mode: initialMode, onUnlock }) {
  const toast = useToast();
  const [mode, setMode] = useState(initialMode); // 'unlock' | 'create' | 'confirm'
  const [buf, setBuf] = useState('');
  const [first, setFirst] = useState('');
  const [shake, setShake] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const title = mode === 'unlock' ? 'Enter your PIN'
    : mode === 'confirm' ? 'Type it once more to confirm'
    : 'Create a 4-digit PIN to protect this device';

  const hasBio = !!localStorage.getItem('varunos_bio') && !!window.PublicKeyCredential;

  async function bioUnlock() {
    try {
      const rawId = Uint8Array.from(atob(localStorage.getItem('varunos_bio')), (c) => c.charCodeAt(0));
      const a = await navigator.credentials.get({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: rawId, type: 'public-key' }],
        userVerification: 'required', timeout: 30000,
      }});
      if (a) unlock();
    } catch (_) {} // fall back to PIN silently
  }

  useEffect(() => { if (mode === 'unlock' && hasBio) bioUnlock(); }, []); // eslint-disable-line

  function unlock() {
    setLeaving(true);
    setTimeout(onUnlock, 420);
  }

  function fail(nextTitleMode) {
    setBuf('');
    setShake((s) => s + 1);
    if (navigator.vibrate) navigator.vibrate(160);
    if (nextTitleMode) setMode(nextTitleMode);
  }

  async function tap(n) {
    if (buf.length >= 4) return;
    const next = buf + n;
    setBuf(next);
    if (next.length < 4) return;
    if (mode === 'unlock') {
      const h = await sha256(next);
      if (h === localStorage.getItem('varunos_pin')) unlock();
      else fail();
    } else if (mode === 'create') {
      setFirst(next);
      setTimeout(() => { setMode('confirm'); setBuf(''); }, 160);
    } else if (mode === 'confirm') {
      if (next === first) {
        localStorage.setItem('varunos_pin', await sha256(next));
        toast('PIN set');
        await offerBiometric(toast);
        unlock();
      } else {
        setFirst('');
        fail('create');
      }
    }
  }

  function skip() {
    localStorage.setItem('varunos_pin_skipped', '1');
    unlock();
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <motion.div
      animate={leaving ? { opacity: 0, scale: 1.05 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'fixed', inset: 0, zIndex: 600, background: 'var(--bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      <div className="ambient" />
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ color: 'var(--mint)', marginBottom: 6 }}
      >
        <IconLock width={30} height={30} />
      </motion.div>
      <h2 className="display" style={{ fontSize: 24, fontWeight: 700 }}>
        Sarathi
      </h2>
      <p style={{ color: 'var(--dim)', fontSize: 14 }}>{title}</p>

      <motion.div
        key={shake}
        animate={shake ? { x: [0, -10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        style={{ display: 'flex', gap: 14, margin: '18px 0 26px' }}
      >
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={i < buf.length
              ? { scale: 1.15, backgroundColor: 'var(--mint)', borderColor: 'var(--mint)', boxShadow: '0 0 12px rgba(245,181,114,0.7)' }
              : { scale: 1, backgroundColor: 'rgba(0,0,0,0)', borderColor: 'var(--mute)', boxShadow: 'none' }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            style={{ width: 13, height: 13, borderRadius: '50%', border: '1.5px solid var(--mute)' }}
          />
        ))}
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 74px)', gap: 13 }}>
        {keys.map((k) => <Key key={k} onTap={() => tap(k)}>{k}</Key>)}
        {mode !== 'unlock'
          ? <Key soft onTap={skip}>Skip</Key>
          : <span />}
        <Key onTap={() => tap('0')}>0</Key>
        <Key soft onTap={() => setBuf(buf.slice(0, -1))}>⌫</Key>
      </div>

      {mode === 'unlock' && hasBio && (
        <button className="btn ghost" style={{ marginTop: 22 }} onClick={bioUnlock}>
          Unlock with Face ID / Touch ID
        </button>
      )}
    </motion.div>
  );
}

function Key({ children, onTap, soft }) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      onClick={onTap}
      style={{
        width: 74, height: 74, borderRadius: '50%',
        border: soft ? 'none' : '1px solid var(--line)',
        background: soft ? 'transparent' : 'rgba(255,255,255,0.035)',
        backdropFilter: soft ? 'none' : 'blur(10px)',
        color: soft ? 'var(--dim)' : 'var(--text)',
        fontSize: soft ? 14 : 25, fontWeight: 600, fontFamily: 'var(--font-display)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}
    >
      {children}
    </motion.button>
  );
}
