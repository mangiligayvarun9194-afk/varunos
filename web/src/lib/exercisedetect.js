// Exercise auto-detect — names the lift you're doing from live pose geometry, so
// the Form Coach doesn't make you tap a pill first. Runs 100% on-device, pure and
// framework-free (the React screen feeds BlazePose-33 landmarks; tests feed
// synthetic poses), so it unit-tests in plain Node exactly like the rep engine.
//
// HONEST DESIGN. A single phone camera cannot perfectly separate all 14 lifts —
// some pairs are genuinely ambiguous in 2D (RDL vs deadlift, lateral vs front
// raise, OHP vs pull-up). So this is NOT a 14-way black-box classifier. It reads a
// few orthogonal, explainable signals over a short window of motion and routes to
// the single best-fitting lift, reporting a calibrated CONFIDENCE. The screen only
// auto-switches when the read is confident AND stable; otherwise it keeps the
// user's pick and the pills remain a one-tap override.
//
// The signals (all derived from landmark geometry, torso-normalized so they're
// invariant to where you stand):
//   • orientation     — standing vs on-the-floor/horizontal (ankle-below-hip span).
//   • primary mover   — which joint travels the most: knee / hip / elbow / shoulder.
//   • torso hinge     — how far the torso leaned (separates squat from hinge/row).
//   • wrist path      — overhead vs at-the-side vs out-to-the-side (separates the
//                       arm lifts that share the shoulder-elbow-wrist joint).
// A small decision procedure (not weights) maps the signature → a lift, which keeps
// every classification auditable.

import { angleDeg } from './formcoach.js';

// BlazePose-33 indices.
const I = { LSH: 11, RSH: 12, LEL: 13, REL: 14, LWR: 15, RWR: 16, LHIP: 23, RHIP: 24, LKN: 25, RKN: 26, LAN: 27, RAN: 28 };

const visOf = (p) => (p && typeof p.visibility === 'number' ? p.visibility : (p ? 1 : 0));
const avg = (a, b, k) => {
  const xs = [];
  if (a && typeof a[k] === 'number') xs.push(a[k]);
  if (b && typeof b[k] === 'number') xs.push(b[k]);
  return xs.length ? xs.reduce((p, q) => p + q, 0) / xs.length : null;
};

// Per-frame geometric features from one set of landmarks. Returns null when the
// core torso isn't usable. Picks the more-visible body side for the limb angles.
export function frameFeatures(L) {
  if (!L || L.length < 29) return null;
  const g = (i) => L[i];
  const left = visOf(g(I.LSH)) + visOf(g(I.LEL)) + visOf(g(I.LWR)) + visOf(g(I.LHIP)) + visOf(g(I.LKN)) + visOf(g(I.LAN));
  const right = visOf(g(I.RSH)) + visOf(g(I.REL)) + visOf(g(I.RWR)) + visOf(g(I.RHIP)) + visOf(g(I.RKN)) + visOf(g(I.RAN));
  const s = left >= right
    ? { sh: I.LSH, el: I.LEL, wr: I.LWR, hip: I.LHIP, kn: I.LKN, an: I.LAN }
    : { sh: I.RSH, el: I.REL, wr: I.RWR, hip: I.RHIP, kn: I.RKN, an: I.RAN };
  const SH = g(s.sh), EL = g(s.el), WR = g(s.wr), HIP = g(s.hip), KN = g(s.kn), AN = g(s.an);
  if (!SH || !HIP) return null;

  // Torso frame: shoulder-center → hip-center. Tilt 0° = upright, ~90° = lying.
  const scx = avg(g(I.LSH), g(I.RSH), 'x'), scy = avg(g(I.LSH), g(I.RSH), 'y');
  const hcx = avg(g(I.LHIP), g(I.RHIP), 'x'), hcy = avg(g(I.LHIP), g(I.RHIP), 'y');
  if (scx == null || hcx == null) return null;
  const torsoLen = Math.hypot(scx - hcx, scy - hcy) || 0.001;
  const torsoTilt = Math.atan2(Math.abs(hcx - scx), hcy - scy) * 180 / Math.PI;

  // Stance: how far the ankles sit below the hips (standing → large; floor → ~0).
  const acy = avg(g(I.LAN), g(I.RAN), 'y');
  const verticalStance = acy == null ? 0 : (acy - hcy) / torsoLen;
  const ankleStagger = (g(I.LAN) && g(I.RAN)) ? Math.abs(g(I.LAN).y - g(I.RAN).y) / torsoLen : 0;

  // Joint angles (interior, 0..180).
  const knee = angleDeg(HIP, KN, AN);
  const hip = angleDeg(SH, HIP, KN);
  const elbow = angleDeg(SH, EL, WR);
  const shoulderAbd = angleDeg(HIP, SH, EL);

  // Wrist path, relative to the shoulder of the working side.
  const wristAbove = WR ? (SH.y - WR.y) / torsoLen : 0;          // + = wrist above shoulder
  const wristLateral = WR ? Math.abs(WR.x - SH.x) / torsoLen : 0; // out-to-the-side distance

  return { ok: true, side: left >= right ? 'left' : 'right', torsoTilt, verticalStance, ankleStagger, knee, hip, elbow, shoulderAbd, wristAbove, wristLateral };
}

const range = (a) => (a.length ? Math.max(...a) - Math.min(...a) : 0);
const median = (a) => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

// Collapse a window of per-frame features into the signal set the classifier uses.
export function aggregate(frames) {
  const F = (frames || []).filter((f) => f && f.ok);
  if (F.length < 6) return null;
  const col = (k) => F.map((f) => f[k]).filter((v) => v != null && isFinite(v));
  const knee = col('knee'), hip = col('hip'), elbow = col('elbow'), sh = col('shoulderAbd');
  const wa = col('wristAbove');

  // Elbow & shoulder extreme frames (to read the wrist path at the rep's ends).
  let eMinI = -1, eMaxI = -1, eMin = 1e9, eMax = -1e9, sMaxI = -1, sMax = -1e9;
  F.forEach((f, i) => {
    if (f.elbow != null) { if (f.elbow < eMin) { eMin = f.elbow; eMinI = i; } if (f.elbow > eMax) { eMax = f.elbow; eMaxI = i; } }
    if (f.shoulderAbd != null && f.shoulderAbd > sMax) { sMax = f.shoulderAbd; sMaxI = i; }
  });

  return {
    kneeRange: range(knee), hipRange: range(hip), elbowRange: range(elbow), shoulderRange: range(sh),
    peakTilt: Math.max(...col('torsoTilt'), 0),
    tiltRange: range(col('torsoTilt')),
    vstance: median(col('verticalStance')),
    ankleStaggerMax: Math.max(...col('ankleStagger'), 0),
    wristAboveMaxAll: wa.length ? Math.max(...wa) : -9,
    wristAboveMin: wa.length ? Math.min(...wa) : 9,
    waAtElbowMin: eMinI >= 0 ? F[eMinI].wristAbove : 0,
    waAtElbowMax: eMaxI >= 0 ? F[eMaxI].wristAbove : 0,
    wristLateralAtPeak: sMaxI >= 0 ? F[sMaxI].wristLateral : 0,
  };
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round2 = (x) => Math.round(x * 100) / 100;

const MIN_MOVE = 22;   // below this much joint travel, nothing is "being done"
const STANDING = 0.8;  // verticalStance above this → standing (else floor/horizontal)

// Map an aggregated signature → { exId, confidence (0..1), mover }. Confidence
// scales with how much real motion was seen times how cleanly the signature was
// separated, so an ambiguous default reports honestly lower confidence.
export function classify(a) {
  const none = { exId: null, confidence: 0, mover: null };
  if (!a) return none;
  const ranges = { knee: a.kneeRange, hip: a.hipRange, elbow: a.elbowRange, shoulder: a.shoulderRange };
  let mover = 'knee';
  for (const k of Object.keys(ranges)) if (ranges[k] > ranges[mover]) mover = k;
  const domR = ranges[mover];
  if (domR < MIN_MOVE) return none;

  // Motion clarity: ~0 at the threshold, saturating by ~70° of travel.
  const conf0 = clamp((domR - MIN_MOVE) / 50, 0, 1);
  const mk = (exId, clarity) => ({ exId, confidence: round2(clamp(conf0 * clarity, 0, 0.95)), mover });

  const standing = a.vstance > STANDING;

  if (!standing) {
    // On the floor / horizontal.
    if (mover === 'elbow') return mk('pushup', 0.95);
    if (a.tiltRange > 35) return mk('situp', 0.9);   // torso rises from lying to sitting
    return mk('hipthrust', 0.78);                     // hips bridge, torso stays flat
  }

  // Standing.
  if (mover === 'knee') {
    if (a.ankleStaggerMax > 0.45) return mk('lunge', 0.7);  // split stance
    return mk('squat', 0.92);
  }
  if (mover === 'hip') {
    if (a.peakTilt > 40) return a.kneeRange > 32 ? mk('deadlift', 0.7) : mk('rdl', 0.85); // forward hinge
    return mk('squat', 0.5); // upright hip travel w/o a hinge → most likely a squat
  }
  if (mover === 'shoulder') {
    if (a.wristAboveMin > 0.35) return mk('pullup', 0.7);     // hands stay overhead
    if (a.wristAboveMaxAll > 0.5) return mk('ohp', 0.75);     // arms travel overhead → a press
    return a.wristLateralAtPeak > 0.7 ? mk('lateralraise', 0.9) : mk('frontraise', 0.65);
  }
  // mover === 'elbow', standing.
  if (a.peakTilt > 45 && a.waAtElbowMin < 0.3 && a.waAtElbowMax < 0.3) return mk('row', 0.8); // hinged pull, wrist low
  if (a.wristAboveMin > 0.35) return mk('pullup', 0.72);                                       // hands overhead throughout
  if (a.waAtElbowMax > 0.55 && a.waAtElbowMin < 0.45) return mk('ohp', 0.9);                   // press up to overhead
  return mk('curl', 0.62);                                                                      // arm at the side (curl/pushdown)
}

// Stateful live detector with a rolling time window + dwell hysteresis, so the
// screen gets a steady answer instead of a per-frame flicker.
export class ExerciseDetector {
  constructor({ maxMs = 2600, dwell = 2, minConf = 0.7 } = {}) {
    this.maxMs = maxMs; this.dwell = dwell; this.minConf = minConf;
    this.reset();
  }
  reset() {
    this.win = [];
    this.current = { exId: null, confidence: 0, stable: false, mover: null };
    this._cand = null; this._n = 0;
  }
  // Feed live landmarks + a timestamp (ms). Returns the current best read.
  push(landmarks, t) {
    const f = frameFeatures(landmarks);
    if (f) { f.t = t; this.win.push(f); }
    const cut = t - this.maxMs;
    while (this.win.length && this.win[0].t < cut) this.win.shift();

    const c = classify(aggregate(this.win));
    if (c.exId && c.confidence >= this.minConf) {
      if (c.exId === this._cand) this._n += 1; else { this._cand = c.exId; this._n = 1; }
    } else { this._cand = null; this._n = 0; }

    this.current = { exId: c.exId, confidence: c.confidence, mover: c.mover, stable: this._n >= this.dwell };
    return this.current;
  }
}
