"""Server-side 3D refinement for Coach-Replay (Phase D v2).

The on-device replay path (web/src/lib/replaygrade.js) already grades a recorded
set in 3D, but it can only afford causal smoothing + linear gap-fill on the phone.
This module is the *cloud* pass the client can opt into: with the whole clip and a
real compute budget it runs heavier, zero-phase-lag signal processing that a phone
shouldn't:

  * INPAINT   — fill occluded (low-confidence) frames by interpolation across the gap.
  * SMOOTH    — bidirectional Savitzky-Golay: removes jitter while *preserving* the
                rep's peak depth (a plain moving-average would clip it), with no phase
                lag (unlike the live One-Euro filter).
  * BONE CLAMP — enforce anatomically plausible limb lengths on the 3D skeleton so an
                occluded joint that MediaPipe flung out gets pulled back along its bone
                to the median length. This is the honest, deterministic core of the
                "3D reconstruction" — a learned GPU model (MotionBERT/VideoPose3D) can
                later replace these internals behind the same refine() contract without
                changing the API or the client.

Pure NumPy, no I/O, so it unit-tests directly. It does NOT invent fully-occluded
joints from nothing (a hidden leg press stays a guess) — it cleans and constrains the
skeleton MediaPipe already produced.
"""

from __future__ import annotations

import numpy as np

CONF_MIN = 0.5            # frames below this are treated as occluded
BONE_TOL = 0.35           # clamp a bone whose length drifts more than this fraction

# BlazePose-33 skeleton, ordered parent -> child from the hips/shoulders outward so a
# single forward pass settles parents before the children that hang off them.
BONES = [
    (23, 25), (25, 27), (27, 31), (27, 29),   # left leg
    (24, 26), (26, 28), (28, 32), (28, 30),   # right leg
    (11, 13), (13, 15),                       # left arm
    (12, 14), (14, 16),                       # right arm
    (23, 11), (24, 12),                       # torso sides
    (11, 12), (23, 24),                       # shoulder / hip spans
]


def _savgol_coeffs(window: int, poly: int) -> np.ndarray:
    """Savitzky-Golay smoothing weights for the centre point."""
    half = window // 2
    A = np.array([[k ** i for i in range(poly + 1)] for k in range(-half, half + 1)], dtype=float)
    # Row 0 of (AᵀA)⁻¹Aᵀ maps the window samples -> the fitted value at the centre.
    return (np.linalg.pinv(A.T @ A) @ A.T)[0]


def savgol(y, window: int = 9, poly: int = 2) -> np.ndarray:
    """Zero-lag, peak-preserving smoothing. Reflect-pads the edges."""
    y = np.asarray(y, dtype=float)
    n = len(y)
    if window % 2 == 0:
        window += 1
    if n < window or window < 3:
        return y.copy()
    half = window // 2
    c = _savgol_coeffs(window, poly)
    yp = np.pad(y, (half, half), mode="reflect")
    # convolve flips the kernel; c[::-1] cancels it -> a true correlation with c.
    return np.convolve(yp, c[::-1], mode="valid")


def inpaint_1d(values, keep_mask) -> np.ndarray:
    """Linearly interpolate the entries where keep_mask is False (hold the ends)."""
    values = np.asarray(values, dtype=float)
    idx = np.where(keep_mask)[0]
    if len(idx) == 0:
        return values.copy()
    return np.interp(np.arange(len(values)), idx, values[idx])


def refine_angles(raw, conf, conf_min: float = CONF_MIN, window: int = 9):
    """Inpaint occluded frames then Savitzky-Golay smooth the joint-angle series.

    Returns (smoothed_raw, filled_fraction).
    """
    raw = np.array([np.nan if v is None else v for v in raw], dtype=float)
    conf = np.asarray(conf, dtype=float)
    keep = (conf >= conf_min) & np.isfinite(raw)
    filled = int((~keep).sum())
    filled_frac = filled / len(raw) if len(raw) else 0.0
    out = savgol(inpaint_1d(raw, keep), window, 2)
    return out, filled_frac


def refine_skeleton(skel, conf, conf_min: float = CONF_MIN, window: int = 9) -> np.ndarray:
    """Clean a (T, 33, 3) world-skeleton clip: per-axis inpaint + smooth, then clamp
    each bone toward its median length so occlusion-stretched limbs snap back."""
    sk = np.asarray(skel, dtype=float)
    if sk.ndim != 3 or sk.shape[0] == 0:
        return sk
    T, J, _ = sk.shape
    conf = np.asarray(conf, dtype=float)
    keep = conf >= conf_min
    if keep.sum() == 0:
        keep = np.ones(T, dtype=bool)

    # 1) temporal inpaint + smooth, independently per joint coordinate
    for j in range(J):
        for a in range(3):
            sk[:, j, a] = savgol(inpaint_1d(sk[:, j, a], keep), window, 2)

    # 2) bone-length clamp toward the median confident length
    med = {}
    for (p, c) in BONES:
        lens = np.linalg.norm(sk[keep, c] - sk[keep, p], axis=1)
        lens = lens[lens > 1e-6]
        med[(p, c)] = float(np.median(lens)) if len(lens) else 0.0
    for t in range(T):
        for (p, c) in BONES:
            m = med[(p, c)]
            if m <= 0:
                continue
            vec = sk[t, c] - sk[t, p]
            L = float(np.linalg.norm(vec))
            if L < 1e-6:
                continue
            if abs(L - m) > BONE_TOL * m:
                sk[t, c] = sk[t, p] + vec * (m / L)
    return sk


def refine(frames, skel=None, conf_min: float = CONF_MIN) -> dict:
    """Top-level cloud refinement. `frames` = [{t, raw, conf}], `skel` optional
    (T,33,3). Returns refined raw/conf/skel arrays + the occluded fraction."""
    raw = [f.get("raw") for f in frames]
    conf = [f.get("conf", 0.0) or 0.0 for f in frames]
    smoothed, filled_frac = refine_angles(raw, conf, conf_min)
    out = {
        "raw": [None if not np.isfinite(v) else float(v) for v in smoothed],
        "conf": [float(c) for c in conf],
        "filledFrac": filled_frac,
        "skel": None,
    }
    if skel:
        out["skel"] = refine_skeleton(skel, conf, conf_min).tolist()
    return out
