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
