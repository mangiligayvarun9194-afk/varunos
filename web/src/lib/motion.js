// Reusable motion primitives for the "Obsidian × Warm Human" redesign.
// Lightweight, dependency-free (IntersectionObserver + rAF), reduced-motion aware.
import { useEffect, useRef, useState } from 'react';

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Scroll-reveal: attach the returned ref to an element that has `data-reveal`.
// When it scrolls into view, sets data-in="1" (CSS handles the transition).
export function useReveal(threshold = 0.18) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReduced()) { el.setAttribute('data-in', '1'); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { el.setAttribute('data-in', '1'); io.unobserve(el); } });
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

// Reveal every [data-reveal] inside a container (for scenes with many children).
export function useRevealAll(threshold = 0.16) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll('[data-reveal]');
    if (prefersReduced()) { els.forEach((el) => el.setAttribute('data-in', '1')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.setAttribute('data-in', '1'); io.unobserve(e.target); } });
    }, { threshold });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

// Returns [ref, inView] — true once the element scrolls into view (once).
export function useInView(threshold = 0.4) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { setInView(true); io.unobserve(el); } });
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView];
}

// Document scroll progress (0..1) — for a top progress rail. rAF-throttled.
export function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? Math.min(1, h.scrollTop / max) : 0);
      raf = 0;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, []);
  return p;
}

// Scroll-linked parallax: translates the element by its distance from the viewport
// centre × speed (negative = drifts up as you scroll down). Reduced-motion → off.
export function useParallax(speed = 0.12) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced()) return;
    el.style.willChange = 'transform';
    let raf = 0;
    const update = () => {
      const r = el.getBoundingClientRect();
      const c = r.top + r.height / 2 - window.innerHeight / 2;
      el.style.transform = `translate3d(0, ${(-c * speed).toFixed(1)}px, 0)`;
      raf = 0;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, [speed]);
  return ref;
}

// Magnetic hover: the element drifts toward the pointer and springs back on leave.
export function useMagnetic(strength = 0.3) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced()) return;
    el.style.transition = 'transform .3s cubic-bezier(.22,1,.36,1)';
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${(x * strength).toFixed(1)}px, ${(y * strength).toFixed(1)}px)`;
    };
    const leave = () => { el.style.transform = 'translate(0,0)'; };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, [strength]);
  return ref;
}

// Animated number that counts up to `value` once `start` is true (cubic ease-out).
export function useCountUp(value, start = true, { duration = 1300, decimals = 0 } = {}) {
  const [display, setDisplay] = useState(() => (prefersReduced() ? value : 0));
  const raf = useRef(0);
  useEffect(() => {
    if (!start) return;
    if (prefersReduced()) { setDisplay(value); return; }
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(value * e);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, start, duration]);
  return Number(display).toFixed(decimals);
}
