"""Tests for the server-side Coach-Replay 3D refinement (Phase D v2)."""

import numpy as np

from varunos.core.pose_refine import (
    savgol, inpaint_1d, refine_angles, refine_skeleton, refine, BONES,
)


class TestSavgol:
    def test_preserves_a_constant(self):
        y = np.full(20, 7.0)
        assert np.allclose(savgol(y, 9, 2), 7.0)

    def test_denoises_but_keeps_amplitude(self):
        x = np.linspace(0, 2 * np.pi, 120)
        clean = 90 + 80 * np.sin(x)
        rng = np.random.default_rng(0)
        noisy = clean + rng.normal(0, 6, clean.shape)
        sm = savgol(noisy, 11, 2)
        # closer to the clean signal than the raw noise was
        assert np.std(sm - clean) < np.std(noisy - clean)
        # the peak (rep depth) is preserved, not clipped away
        assert abs(sm.max() - clean.max()) < 8

    def test_short_series_passthrough(self):
        y = [1.0, 2.0, 3.0]
        assert np.allclose(savgol(y, 9, 2), y)


class TestInpaint:
    def test_fills_a_gap_linearly(self):
        vals = [100.0, 999.0, 999.0, 70.0]
        keep = np.array([True, False, False, True])
        out = inpaint_1d(vals, keep)
        assert abs(out[1] - 90.0) < 1e-9 and abs(out[2] - 80.0) < 1e-9

    def test_holds_the_ends(self):
        out = inpaint_1d([0.0, 50.0], np.array([False, True]))
        assert out[0] == 50.0


class TestRefineAngles:
    def _cosine_rep(self, top=175.0, bottom=85.0, n=60):
        u = np.linspace(0, 1, n)
        return top - (top - bottom) * (0.5 - 0.5 * np.cos(2 * np.pi * u))

    def test_recovers_signal_through_occlusion(self):
        clean = self._cosine_rep()
        raw = clean.copy()
        conf = np.full(len(raw), 0.9)
        # blow out a chunk of frames + mark them occluded
        raw[25:40] = 0.0
        conf[25:40] = 0.2
        out, frac = refine_angles(raw, conf)
        assert frac > 0.2
        # the reconstructed region tracks the true signal far better than the garbage
        assert np.mean(np.abs(out[25:40] - clean[25:40])) < 20

    def test_filled_fraction_zero_when_all_confident(self):
        clean = self._cosine_rep()
        _, frac = refine_angles(clean, np.full(len(clean), 0.9))
        assert frac == 0.0


class TestRefineSkeleton:
    def _straight_clip(self, T=40):
        # a static skeleton with a left forearm (elbow 13 -> wrist 15) of length ~0.3
        base = np.zeros((33, 3))
        base[11] = [0.0, 0.0, 0.0]   # shoulder
        base[13] = [0.0, -0.3, 0.0]  # elbow
        base[15] = [0.0, -0.6, 0.0]  # wrist (forearm len 0.3)
        return np.repeat(base[None, :, :], T, axis=0)

    def test_bone_clamp_pulls_a_stretched_limb_back(self):
        sk = self._straight_clip()
        conf = np.full(len(sk), 0.9)
        sk[20, 15] = [0.0, -1.4, 0.0]   # one frame: wrist flung out (forearm ~1.1)
        out = refine_skeleton(sk, conf)
        forearm = np.linalg.norm(out[20, 15] - out[20, 13])
        assert abs(forearm - 0.3) < 0.12   # clamped back toward the ~0.3 median
        assert (13, 15) in BONES

    def test_handles_empty(self):
        assert refine_skeleton([], []).size == 0 if hasattr(refine_skeleton([], []), "size") else True


class TestRefineTop:
    def test_shapes_and_none_skel(self):
        frames = [{"t": i * 33, "raw": 100.0 + i, "conf": 0.9} for i in range(20)]
        out = refine(frames, skel=None)
        assert len(out["raw"]) == 20 and out["skel"] is None and out["filledFrac"] == 0.0

    def test_round_trips_skeleton(self):
        T = 15
        frames = [{"t": i * 33, "raw": 90.0, "conf": 0.9} for i in range(T)]
        skel = [[[0.0, 0.0, 0.0] for _ in range(33)] for _ in range(T)]
        out = refine(frames, skel=skel)
        assert len(out["skel"]) == T and len(out["skel"][0]) == 33 and len(out["skel"][0][0]) == 3

    def test_none_raw_survives(self):
        frames = [{"t": 0, "raw": None, "conf": 0.0}, {"t": 33, "raw": 90.0, "conf": 0.9},
                  {"t": 66, "raw": 100.0, "conf": 0.9}, {"t": 99, "raw": 95.0, "conf": 0.9}]
        out = refine(frames)
        assert len(out["raw"]) == 4 and all(v is None or isinstance(v, float) for v in out["raw"])
