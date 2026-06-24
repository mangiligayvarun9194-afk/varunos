// Shared UI primitives: dock, sheet, ring, toast, confetti, pickers.
import { useEffect, useRef, useState, createContext, useContext } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { IconSun, IconPlus, IconBody, IconPulse, IconSparkle, IconGear, IconX } from './Icons.jsx';

/* ---------------- Toast ---------------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const timer = useRef();
  const show = (m) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  };
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: 18, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 10, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            style={{
              position: 'fixed', bottom: 112, left: '50%', zIndex: 700,
              background: 'rgba(14,18,28,0.92)', border: '1px solid var(--line-2)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              borderRadius: 999, padding: '11px 22px', fontSize: 13, fontWeight: 600,
              whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            {msg}
          </motion.div>
        )}
      </AnimatePresence>
    </ToastCtx.Provider>
  );
}

/* ---------------- Confetti ---------------- */
export function confettiBurst() {
  const colors = ['#f5b572', '#fbbf24', '#4cc9f0', '#f472b6', '#a78bfa'];
  for (let i = 0; i < 36; i++) {
    const b = document.createElement('div');
    b.className = 'confetti-bit';
    b.style.left = Math.random() * 100 + 'vw';
    b.style.background = colors[i % colors.length];
    b.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    b.style.animation = `confettiFall ${1.6 + Math.random() * 1.6}s ease-in ${Math.random() * 0.4}s forwards`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 4000);
  }
}

/* ---------------- Bottom dock ---------------- */
const TABS = [
  { id: 'today', label: 'Today', Icon: IconSun },
  { id: 'log', label: 'Log', Icon: IconPlus },
  { id: 'twin', label: 'Twin', Icon: IconBody },
  { id: 'insights', label: 'Insights', Icon: IconPulse },
  { id: 'coach', label: 'Hermes', Icon: IconSparkle },
  { id: 'settings', label: 'Settings', Icon: IconGear },
];

export function Dock({ tab, onTab }) {
  return (
    <nav
      style={{
        position: 'fixed', bottom: 'calc(10px + env(safe-area-inset-bottom))',
        left: 12, right: 12, maxWidth: 660, margin: '0 auto', zIndex: 100,
        background: 'rgba(10,13,20,0.82)', border: '1px solid var(--line)',
        backdropFilter: 'blur(24px) saturate(1.4)', WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        borderRadius: 26, display: 'flex', justifyContent: 'space-around',
        padding: '8px 6px', boxShadow: '0 16px 48px -12px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.04) inset',
      }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            onClick={() => onTab(id)}
            style={{
              position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
              color: active ? 'var(--mint)' : 'var(--mute)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '7px 11px', borderRadius: 15, fontFamily: 'var(--font-body)',
              transition: 'color 0.18s',
            }}
          >
            {active && (
              <motion.span
                layoutId="dock-pill"
                transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                style={{
                  position: 'absolute', inset: 0, borderRadius: 15,
                  background: 'linear-gradient(180deg, rgba(245,181,114,0.20), rgba(245,181,114,0.05))',
                  border: '1px solid rgba(245,181,114,0.3)',
                  boxShadow: '0 6px 20px -8px rgba(245,181,114,0.5)',
                }}
              >
                <span style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                  width: 18, height: 2, borderRadius: 2, background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
              </motion.span>
            )}
            <motion.span animate={{ scale: active ? 1.12 : 1, y: active ? -1 : 0 }} style={{ display: 'flex', position: 'relative' }}>
              <Icon />
            </motion.span>
            <span style={{ fontSize: 9, fontWeight: 650, letterSpacing: '0.06em', position: 'relative',
              textTransform: 'uppercase', fontFamily: active ? 'var(--font-eyebrow)' : 'var(--font-body)' }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ---------------- Sheet modal ---------------- */
export function Sheet({ open, onClose, children, title }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
          style={{
            position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'flex-end',
            background: 'rgba(2,4,8,0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            style={{
              background: 'rgba(13,16,26,0.97)', borderTop: '1px solid var(--line-2)',
              borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 680, margin: '0 auto',
              padding: 20, maxHeight: '86vh', overflowY: 'auto',
              boxShadow: '0 -16px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ width: 38, height: 4, borderRadius: 4, background: 'var(--line-2)', margin: '-4px auto 14px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 className="display" style={{ fontSize: 18, fontWeight: 600 }}>{title}</h3>
              <button onClick={onClose} aria-label="Close" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--dim)', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <IconX width={16} height={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Animated number ---------------- */
export function CountUp({ value, duration = 1.0, decimals = 0 }) {
  const [n, setN] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) { setN(value); return; }
    let raf; const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const backstop = setTimeout(() => setN(value), duration * 1000 + 150);
    return () => { cancelAnimationFrame(raf); clearTimeout(backstop); };
  }, [value, duration, reduced]);
  return <>{n.toFixed(decimals)}</>;
}

/* ---------------- Readiness ring ---------------- */
export function Ring({ score, color, size = 132, stroke = 9, label = 'Readiness' }) {
  const r = (size - stroke) / 2 - 4;
  const circ = 2 * Math.PI * r;
  const reduced = useReducedMotion();
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, filter: `drop-shadow(0 0 12px ${color}44)` }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - score / 100) }}
        transition={reduced ? { duration: 0 } : { duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dy="6" textAnchor="middle" fill={color}
        style={{ fontFamily: 'var(--font-display)', fontSize: size * 0.26, fontWeight: 700, letterSpacing: '-0.03em' }}>
        <CountUp value={score} duration={1.2} />
      </text>
      <text x="50%" y="50%" dy={size * 0.17} textAnchor="middle" fill="var(--mute)"
        style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
        {label}
      </text>
    </svg>
  );
}

/* ---------------- Stagger helpers ---------------- */
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
export const rise = {
  hidden: { opacity: 0, y: 16, scale: 0.99 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 340, damping: 30 } },
};

/* ---------------- Pick row (emoji scale picker) ---------------- */
export function PickRow({ options, value, onChange }) {
  return (
    <div className="pick-row">
      {options.map(([emoji, cap], i) => (
        <motion.div
          key={cap}
          whileTap={{ scale: 0.93 }}
          className={`pick${value === i + 1 ? ' sel' : ''}`}
          onClick={() => onChange(i + 1)}
        >
          <span className="emoji">{emoji}</span>
          <span className="cap">{cap}</span>
        </motion.div>
      ))}
    </div>
  );
}

/* ---------------- Stepper ---------------- */
export function Stepper({ value, onChange, step = 1, min = 0, unit }) {
  return (
    <div className="stepper">
      <motion.button whileTap={{ scale: 0.9 }} onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}>−</motion.button>
      <div className="sval">{value} {unit && <small>{unit}</small>}</div>
      <motion.button whileTap={{ scale: 0.9 }} onClick={() => onChange(+(value + step).toFixed(2))}>+</motion.button>
    </div>
  );
}
