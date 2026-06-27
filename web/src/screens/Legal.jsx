// Legal — Privacy Policy + Terms of Service, shown as an accessible overlay from
// Auth, Settings and the Landing footer. Content describes Sarathi's ACTUAL data
// practices. ⚠️ This is a founder draft — have it reviewed by counsel before you
// rely on it. Bump LEGAL_VERSION whenever the substance changes (re-acceptance).
import { useState, useEffect } from 'react';
import { IconX, IconShield } from '../components/Icons.jsx';

export const LEGAL_VERSION = '2026-06-01';
const UPDATED = 'June 2026';
const SUPPORT_EMAIL = 'support@sarathi.app';   // ← set to your real support inbox

const PRIVACY = [
  ['Who we are', [
    'Sarathi is a private AI health companion. This policy explains what we collect, why, where it lives, and the control you have. Sarathi is an educational tool, not a medical device — see the Terms.',
  ]],
  ['What we collect', [
    'Account data: your email and a one-way hashed password (we never store your password in readable form).',
    'Health data you provide: workouts, meals, daily check-ins, goals, and body metrics you enter.',
    'Wearable data you choose to sync: HRV, resting heart rate, sleep and steps from Apple Health / Health Connect.',
    'Limited usage events (e.g. "logged a workout") to make the app work and improve it.',
  ]],
  ['What stays on your device', [
    'Camera-based form coaching runs 100% on your device. Your camera feed and pose data are processed locally and are never uploaded to our servers.',
    'The on-device muscle/exercise detection model also runs locally.',
  ]],
  ['How we use AI', [
    'Some coaching text may be generated using a third-party AI provider (Anthropic). When this happens we send only a privacy-preserving "safe context" — derived tiers and summaries, never your raw biomarkers — and we never send your identity to the model.',
    'We do not sell your data or use it to train third-party models.',
  ]],
  ['Where your data lives', [
    'Account and logged data are stored in our managed database to sync across your devices. We use reasonable security (hashed passwords, encrypted transport, session tokens).',
    'Your Health Vault is exportable at any time as open Markdown files you own — no lock-in.',
  ]],
  ['Your rights & control', [
    'Export: download your full Health Vault whenever you want (Settings → Health Vault).',
    'Delete: request deletion of your account and associated data; we remove it from active systems.',
    'You can stop wearable sync or revoke camera access at any time from your device.',
  ]],
  ['Data retention & children', [
    'We keep your data while your account is active and delete it on request. Sarathi is not directed to children under 16.',
  ]],
  ['Changes & contact', [
    `We may update this policy; material changes bump the version and we ask you to re-accept. Questions: ${SUPPORT_EMAIL}.`,
  ]],
];

const TERMS = [
  ['Acceptance', [
    'By creating an account or using Sarathi you agree to these Terms and the Privacy Policy. If you do not agree, do not use the service.',
  ]],
  ['Not medical advice', [
    'Sarathi is an educational and motivational tool — NOT a medical device, and not a substitute for professional medical advice, diagnosis, or treatment. Risk tiers and scores use standard screening logic but do not diagnose.',
    'Always consult a qualified clinician before making health, training, medication or nutrition decisions. In an emergency, call your local emergency number — do not rely on Sarathi.',
  ]],
  ['Your account', [
    'You are responsible for the accuracy of the data you enter, for keeping your password secure, and for activity under your account. Provide truthful information.',
    'Use Sarathi only for your own personal, non-commercial use, and within the law. Do not attempt to disrupt, reverse-engineer for abuse, or overload the service.',
  ]],
  ['Service & changes', [
    'Sarathi is offered "as is" and "as available," and is under active development; features may change or pause. We may set fair-use limits (including on AI usage) to keep the service sustainable.',
  ]],
  ['Disclaimers & liability', [
    'To the maximum extent permitted by law, Sarathi is provided without warranties of any kind, and we are not liable for any indirect, incidental or consequential damages, or for decisions you make based on the app. Your use is at your own risk.',
  ]],
  ['Termination', [
    'You may stop using Sarathi and delete your account at any time. We may suspend accounts that abuse the service or these Terms.',
  ]],
  ['Governing terms & contact', [
    `These Terms are governed by the laws of your place of residence unless required otherwise. Questions: ${SUPPORT_EMAIL}.`,
  ]],
];

function Doc({ title, sections, updated }) {
  return (
    <div>
      <p style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 14 }}>
        Last updated {updated} · v{LEGAL_VERSION}
      </p>
      {sections.map(([h, paras]) => (
        <section key={h} style={{ marginBottom: 18 }}>
          <h3 className="display" style={{ fontSize: 15, fontWeight: 650, marginBottom: 6 }}>{h}</h3>
          {paras.map((p, i) => (
            <p key={i} className="meta" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>{p}</p>
          ))}
        </section>
      ))}
    </div>
  );
}

// Accessible modal overlay. `doc`: 'privacy' | 'terms'. Esc / backdrop / × closes.
export function LegalOverlay({ doc = 'privacy', onClose }) {
  const [tab, setTab] = useState(doc);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Legal documents" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(4,6,11,0.8)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} className="card"
        style={{ width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', borderRadius: '20px 20px 0 0', padding: 20, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, position: 'sticky', top: -20, background: 'var(--surface)', paddingTop: 4 }}>
          <div style={{ display: 'flex', gap: 6, background: 'var(--surface-2)', borderRadius: 12, padding: 4 }}>
            <button className={`btn ${tab === 'privacy' ? 'primary' : 'ghost'}`} style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => setTab('privacy')}>Privacy</button>
            <button className={`btn ${tab === 'terms' ? 'primary' : 'ghost'}`} style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => setTab('terms')}>Terms</button>
          </div>
          <button className="btn ghost" style={{ padding: 6 }} onClick={onClose} aria-label="Close"><IconX width={16} height={16} /></button>
        </div>
        {tab === 'privacy'
          ? <Doc title="Privacy Policy" sections={PRIVACY} updated={UPDATED} />
          : <Doc title="Terms of Service" sections={TERMS} updated={UPDATED} />}
        <p className="meta" style={{ fontSize: 11, marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconShield width={13} height={13} /> Your camera feed and pose data never leave your device.
        </p>
      </div>
    </div>
  );
}
