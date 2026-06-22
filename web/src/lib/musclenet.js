// On-device muscle / exercise-position detector.
//
// A tiny logistic-regression classifier (trained offline on 2,700 labeled
// MediaPipe-33 frames) that reads the live pose and names what's being worked:
// rest, or left/right biceps / shoulders / triceps. Runs 100% in the browser —
// just a standardize + matrix-multiply + softmax, no TF.js, no network, video
// never leaves the device. Features are torso-normalized (origin at hip-center,
// scaled by torso length) so it's invariant to where you stand in frame.
//
// This module is pure (the trained weights are passed in) so it unit-tests in
// plain Node; the app supplies the bundled ./muscle_model.json.

const L_SHO = 11, R_SHO = 12, L_HIP = 23, R_HIP = 24;

export const MUSCLE_LABEL = {
  rest: 'Resting',
  left_bicep: 'Left biceps', right_bicep: 'Right biceps',
  left_shoulder: 'Left shoulder', right_shoulder: 'Right shoulder',
  left_tricep: 'Left triceps', right_tricep: 'Right triceps',
};

// Maps a detected class → the Form-Coach exercise it implies (for auto-suggest).
export const MUSCLE_TO_EXERCISE = {
  left_bicep: 'curl', right_bicep: 'curl',
};

// Build the 99-d torso-normalized feature vector from 33 BlazePose landmarks.
export function featurize(landmarks) {
  if (!landmarks || landmarks.length < 33) return null;
  const p = (i) => landmarks[i];
  const hx = (p(L_HIP).x + p(R_HIP).x) / 2, hy = (p(L_HIP).y + p(R_HIP).y) / 2, hz = (p(L_HIP).z + p(R_HIP).z) / 2;
  const sx = (p(L_SHO).x + p(R_SHO).x) / 2, sy = (p(L_SHO).y + p(R_SHO).y) / 2;
  const scale = Math.hypot(sx - hx, sy - hy) || 1;
  const f = new Array(99);
  for (let i = 0; i < 33; i++) {
    f[i * 3] = (p(i).x - hx) / scale;
    f[i * 3 + 1] = (p(i).y - hy) / scale;
    f[i * 3 + 2] = ((p(i).z || 0) - hz) / scale;
  }
  return f;
}

// Classify a pre-built 99-d feature vector with a given model → {label, confidence, probs}.
export function classify(model, f) {
  if (!f || !model) return null;
  const { classes, mean, scale, coef, intercept } = model;
  const z = f.map((v, i) => (v - mean[i]) / scale[i]);
  const logits = coef.map((row, c) => {
    let s = intercept[c];
    for (let i = 0; i < row.length; i++) s += row[i] * z[i];
    return s;
  });
  const m = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - m));
  const sum = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e) => e / sum);
  let best = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
  return { label: classes[best], confidence: probs[best], probs };
}

// Full path: model + live landmarks → detection.
export function detect(model, landmarks) {
  return classify(model, featurize(landmarks));
}
