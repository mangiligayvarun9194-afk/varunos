// Twin acts — the Twin's living gestures as pure clip data. No three.js,
// no DOM: each factory returns { id, duration, loop, poseAt(t01) } where
// poseAt maps normalized time 0..1 to a full pose over semantic parts.
// The stage (Twin.jsx) owns the actual bones; it just adds these euler
// radians onto the rig's rest rotations each frame, exactly like its own
// procedural warmup poses. All curves are smoothstep/sine segments, so
// every channel is continuous and every clip starts and ends at neutral.
// Tests: web/test/twinacts.test.mjs

export const PARTS = [
  'head', 'spine', 'hips',
  'lArm', 'rArm', 'lForeArm', 'rForeArm',
  'lLeg', 'rLeg',
];

const clamp01 = (t) => {
  const n = Number(t);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
};

const smoothstep = (e0, e1, t) => {
  const x = clamp01((t - e0) / (e1 - e0));
  return x * x * (3 - 2 * x);
};

// Smooth on/off window: eases 0→1 over [r0,r1], holds, eases 1→0 over [f0,f1].
const win = (t, r0, r1, f0, f1) =>
  smoothstep(r0, r1, t) * (1 - smoothstep(f0, f1, t));

const neutralPose = () => {
  const p = {};
  for (const k of PARTS) p[k] = { rx: 0, ry: 0, rz: 0 };
  return p;
};

// --- greeting: a namaste --------------------------------------------------
// Arms rise and fold inward to the sternum (lArm rz +, rArm rz −, forearms
// bend to meet), the head bows over held hands, spine gives a slight bow,
// then everything releases back to neutral.
export function clipGreeting() {
  return {
    id: 'greeting',
    duration: 4,
    loop: false,
    poseAt(t01) {
      const t = clamp01(t01);
      const p = neutralPose();
      const arm = win(t, 0, 0.28, 0.7, 0.98);   // raise → hold → release
      const bow = win(t, 0.2, 0.42, 0.6, 0.9);  // bow inside the hold
      p.lArm.rz = 0.55 * arm;
      p.rArm.rz = -0.55 * arm;
      p.lArm.rx = -0.15 * arm;
      p.rArm.rx = -0.15 * arm;
      p.lForeArm.rz = 0.75 * arm;               // fold in: palms meet
      p.rForeArm.rz = -0.75 * arm;
      p.lForeArm.ry = 0.2 * arm;
      p.rForeArm.ry = -0.2 * arm;
      p.head.rx = 0.25 * bow;                   // bow peak ~0.25
      p.spine.rx = 0.08 * bow;
      return p;
    },
  };
}

// --- celebrate: double fist-pump -------------------------------------------
// Two overhead pumps on a 2-cycle raised-cosine carrier shaped by a
// sin²(πt) envelope (zero at both ends): arms swing up twice, hips sway,
// legs give a small bounce, head tilts up with the pumps.
export function clipCelebrate() {
  return {
    id: 'celebrate',
    duration: 2.6,
    loop: false,
    poseAt(t01) {
      const t = clamp01(t01);
      const p = neutralPose();
      const env = Math.sin(Math.PI * t) ** 2;             // 0 at t=0 and t=1
      const pump = 0.5 - 0.5 * Math.cos(4 * Math.PI * t); // two pumps
      const sway = Math.sin(4 * Math.PI * t);
      p.lArm.rz = 0.8 * env * pump;
      p.rArm.rz = -0.8 * env * pump;
      p.lArm.rx = -0.45 * env * pump;                     // swing overhead
      p.rArm.rx = -0.45 * env * pump;
      p.lForeArm.rz = 0.35 * env * pump;                  // fists stay bent
      p.rForeArm.rz = -0.35 * env * pump;
      p.head.rx = -0.15 * env * pump;                     // chin up
      p.spine.rx = -0.06 * env * pump;
      p.hips.ry = 0.1 * env * sway;                       // hip sway
      p.lLeg.rx = 0.08 * env * pump;                      // little bounce
      p.rLeg.rx = 0.08 * env * pump;
      return p;
    },
  };
}

// --- shake: protein shaker --------------------------------------------------
// Right arm raises the shaker, three rapid low-amplitude shakes between
// t 0.35–0.65 (10 Hz carrier under a smooth window = 3 cycles), then a
// drink tilt (head back, forearm to mouth) and lower to neutral. The left
// side never moves.
export function clipShake() {
  const SHAKE_FREQ = 2 * Math.PI * 10; // 3 cycles across the 0.35–0.65 window
  return {
    id: 'shake',
    duration: 5,
    loop: false,
    poseAt(t01) {
      const t = clamp01(t01);
      const p = neutralPose();
      const raise = win(t, 0.05, 0.3, 0.8, 0.98);
      const shake = win(t, 0.35, 0.42, 0.58, 0.65);
      const drink = win(t, 0.66, 0.78, 0.85, 0.97);
      const wob = Math.sin(SHAKE_FREQ * (t - 0.35));
      p.rArm.rz = -0.65 * raise - 0.05 * shake * wob;
      p.rArm.rx = -0.15 * raise - 0.1 * drink;
      p.rForeArm.rz = -0.55 * raise + 0.12 * shake * wob - 0.2 * drink;
      p.rForeArm.rx = -0.1 * raise
        + 0.06 * shake * Math.sin(SHAKE_FREQ * (t - 0.35) + 1.3);
      p.head.rx = -0.2 * drink;                 // drink tilt
      p.head.ry = -0.06 * raise;                // eyes the shaker
      p.spine.rx = 0.04 * raise;
      return p;
    },
  };
}

export const CLIPS = {
  greeting: clipGreeting,
  celebrate: clipCelebrate,
  shake: clipShake,
};

export const listClips = () => Object.keys(CLIPS);
