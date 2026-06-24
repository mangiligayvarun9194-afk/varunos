// ============================================================================
// Sarathi UI Kit — production-grade, accessible, reusable primitives.
//
// Design goals:
//  • One source of truth for buttons, cards, fields, stats, and the four data
//    states (loading / empty / error / success) every async screen needs.
//  • Accessible by default: focus-visible rings, aria-busy/aria-disabled,
//    role="status" + aria-live for async regions, label↔input wiring, keyboard
//    support on interactive cards, reduced-motion awareness.
//  • Styled from CSS tokens in theme.css (var(--accent), --surface, …) so the
//    whole kit re-themes from one place.
//  • Tiny + dependency-light (no per-component animation libs) → great DX.
//
// See docs/UI_KIT.md for architecture, full props/API, examples and best
// practices.
// ============================================================================
import { forwardRef, useId } from 'react';

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- Spinner ---------------- */
export function Spinner({ size = 18, label = 'Loading', style }) {
  return (
    <span
      role="status" aria-label={label}
      style={{
        width: size, height: size, flexShrink: 0, display: 'inline-block',
        border: `2px solid rgba(245,181,114,0.25)`, borderTopColor: 'var(--accent)',
        borderRadius: '50%', animation: reduceMotion() ? 'none' : 'kit-spin 0.8s linear infinite',
        ...style,
      }}
    />
  );
}

/* ---------------- VisuallyHidden ---------------- */
export const VisuallyHidden = ({ children }) => <span className="sr-only">{children}</span>;

/* ---------------- Button ----------------
   variants: primary | ghost | danger   sizes: sm | md | lg
   loading shows a spinner + aria-busy and blocks clicks; renders <a> when href. */
export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled = false, full = false,
    iconLeft, iconRight, as, href, children, onClick, style, ...rest }, ref) {
  const Tag = as || (href ? 'a' : 'button');
  const blocked = disabled || loading;
  const cls = `btn ${variant}${full ? ' full' : ''}${size !== 'md' ? ` kit-${size}` : ''}`;
  return (
    <Tag
      ref={ref} className={cls} href={Tag === 'a' ? href : undefined}
      type={Tag === 'button' ? (rest.type || 'button') : undefined}
      disabled={Tag === 'button' ? blocked : undefined}
      aria-busy={loading || undefined}
      aria-disabled={blocked || undefined}
      onClick={blocked ? (e) => e.preventDefault() : onClick}
      style={{ position: 'relative', ...style }}
      {...rest}
    >
      {loading && <Spinner size={size === 'lg' ? 18 : 15} label="" />}
      {!loading && iconLeft}
      {children != null && <span>{children}</span>}
      {!loading && iconRight}
    </Tag>
  );
});

/* ---------------- Card ----------------
   interactive → keyboard-operable (role=button, Enter/Space), focus ring. */
export const Card = forwardRef(function Card(
  { as: Tag = 'div', interactive = false, onClick, accent, padding, children, style, ...rest }, ref) {
  const clickable = interactive || (!!onClick && Tag === 'div');
  const keyDown = clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(e); } } : undefined;
  return (
    <Tag
      ref={ref} className="card" onClick={onClick} onKeyDown={keyDown}
      role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}
      style={{
        ...(accent ? { borderLeft: `3px solid ${accent}` } : null),
        ...(padding != null ? { padding } : null),
        ...(clickable ? { cursor: 'pointer' } : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
});

/* ---------------- Skeleton ---------------- */
export function Skeleton({ width = '100%', height = 14, radius = 9, lines = 1, style }) {
  if (lines > 1) {
    return (
      <div aria-hidden="true" style={{ display: 'grid', gap: 8, ...style }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="skel" style={{ height, borderRadius: radius, width: i === lines - 1 ? '70%' : '100%' }} />
        ))}
      </div>
    );
  }
  return <div aria-hidden="true" className="skel" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonCard({ height = 120 }) {
  return <div className="card" aria-busy="true" aria-label="Loading"><Skeleton lines={3} /><Skeleton height={height - 70} style={{ marginTop: 12 }} /></div>;
}

/* ---------------- EmptyState ---------------- */
export function EmptyState({ icon, title, message, action, dashed = true }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '28px 20px', ...(dashed ? { borderStyle: 'dashed' } : null) }}>
      {icon && <div style={{ color: 'var(--mute)', display: 'flex', justifyContent: 'center', marginBottom: 10 }}>{icon}</div>}
      {title && <h3 className="display" style={{ fontSize: 15, fontWeight: 650, marginBottom: 4 }}>{title}</h3>}
      {message && <p className="meta" style={{ maxWidth: 320, margin: '0 auto' }}>{message}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

/* ---------------- ErrorState ---------------- */
export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="card" role="alert" style={{ textAlign: 'center', padding: '24px 20px', borderColor: 'rgba(251,113,133,0.3)' }}>
      <h3 className="display" style={{ fontSize: 15, fontWeight: 650, color: 'var(--red)', marginBottom: 4 }}>{title}</h3>
      {message && <p className="meta" style={{ maxWidth: 320, margin: '0 auto 14px' }}>{message}</p>}
      {onRetry && <Button variant="ghost" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/* ---------------- DataState ----------------
   The async state machine every data screen should use. Renders exactly one of
   loading / error / empty / children, in an aria-live region so screen readers
   announce transitions. Pass booleans (or error as string) + optional custom
   renderers. */
export function DataState({
  loading, error, empty, onRetry,
  skeleton, emptyState, errorState, children,
}) {
  let body;
  if (loading) body = skeleton ?? <SkeletonCard />;
  else if (error) body = errorState ?? <ErrorState message={typeof error === 'string' ? error : 'Please try again.'} onRetry={onRetry} />;
  else if (empty) body = emptyState ?? <EmptyState message="Nothing here yet." />;
  else body = children;
  return <div aria-live="polite" aria-busy={!!loading}>{body}</div>;
}

/* ---------------- Field ----------------
   Accessible input row: label↔input wired by id, hint + error with
   aria-describedby, required + aria-invalid. Renders any control via `render`. */
export function Field({ label, hint, error, required, htmlFor, children, render, ...rest }) {
  const auto = useId();
  const id = htmlFor || auto;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const described = [hintId, errId].filter(Boolean).join(' ') || undefined;
  const control = render
    ? render({ id, 'aria-describedby': described, 'aria-invalid': !!error || undefined, required })
    : children;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }} {...rest}>
      {label && (
        <label htmlFor={id} style={{ fontSize: 13, color: 'var(--dim)' }}>
          {label}{required && <span style={{ color: 'var(--accent)' }} aria-hidden="true"> *</span>}
        </label>
      )}
      {control}
      {hint && !error && <span id={hintId} className="meta" style={{ fontSize: 12 }}>{hint}</span>}
      {error && <span id={errId} className="err" role="alert" style={{ fontSize: 12 }}>{error}</span>}
    </div>
  );
}

/* ---------------- Badge ---------------- */
export function Badge({ tone = 'neutral', children, style }) {
  const tones = {
    neutral: ['var(--dim)', 'var(--surface-2)'],
    accent: ['var(--accent)', 'rgba(245,181,114,0.12)'],
    cyan: ['var(--cyan)', 'rgba(76,201,240,0.12)'],
    good: ['var(--green)', 'rgba(52,211,153,0.12)'],
    warn: ['var(--amber)', 'rgba(251,191,36,0.12)'],
    danger: ['var(--red)', 'rgba(251,113,133,0.12)'],
  };
  const [fg, bg] = tones[tone] || tones.neutral;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600,
      color: fg, background: bg, borderRadius: 999, padding: '3px 10px', textTransform: 'capitalize', ...style }}>
      {children}
    </span>
  );
}

/* ---------------- Stat ----------------
   Big numeral with eyebrow label + optional unit/trend; shows a skeleton while
   loading. Numeric `value` can be pre-animated by the caller (useCountUp). */
export function Stat({ label, value, unit, trend, trendTone = 'var(--accent)', loading = false, align = 'left' }) {
  return (
    <div style={{ textAlign: align, minWidth: 88 }}>
      <div style={{ fontFamily: 'var(--font-eyebrow)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--mute)' }}>{label}</div>
      {loading
        ? <Skeleton width={64} height={24} style={{ marginTop: 6 }} />
        : (
          <div className="display" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1, marginTop: 2 }}>
            {value}{unit && <span style={{ fontSize: 13, color: 'var(--accent)', marginLeft: 3 }}>{unit}</span>}
            {trend && <span style={{ fontSize: 12, color: trendTone, marginLeft: 8 }}>{trend}</span>}
          </div>
        )}
    </div>
  );
}
