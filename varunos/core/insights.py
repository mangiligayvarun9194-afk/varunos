"""
VarunOS Insight Engine — deterministic personal analytics.

This is the "wow" layer: it finds real patterns in YOUR data and states them
in plain language. No LLM, no hallucination — just rank statistics and
threshold rules over your own daily history.

Two families:
  1. Correlations  — lagged Spearman between a behaviour and an outcome
                     ("late dinners → lower next-day HRV")
  2. Anomalies     — early-warning trend/threshold rules
                     ("resting HR up 4 days straight — possible illness")

Everything here is a pure function of a list of per-day feature dicts, so it
is 100% unit-testable and auditable. The brain only ever narrates these
outputs; it never computes them.
"""

from __future__ import annotations
from dataclasses import dataclass, asdict
from statistics import mean
from typing import Callable, Optional


# ---- Rank correlation (no numpy/scipy) -----------------------------------

def _ranks(vals: list[float]) -> list[float]:
    """Average ranks, handling ties (1-based)."""
    order = sorted(range(len(vals)), key=lambda i: vals[i])
    ranks = [0.0] * len(vals)
    i = 0
    while i < len(vals):
        j = i
        while j + 1 < len(vals) and vals[order[j + 1]] == vals[order[i]]:
            j += 1
        avg = (i + j) / 2 + 1
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    return ranks


def pearson(xs: list[float], ys: list[float]) -> Optional[float]:
    n = len(xs)
    if n < 2:
        return None
    mx, my = mean(xs), mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs) ** 0.5
    dy = sum((y - my) ** 2 for y in ys) ** 0.5
    if dx == 0 or dy == 0:
        return None
    return num / (dx * dy)


def spearman(xs: list[float], ys: list[float]) -> Optional[float]:
    """Spearman rank correlation = Pearson on ranks."""
    if len(xs) != len(ys) or len(xs) < 3:
        return None
    return pearson(_ranks(xs), _ranks(ys))


def strength_label(r: float) -> str:
    a = abs(r)
    if a >= 0.6:
        return "strong"
    if a >= 0.4:
        return "moderate"
    if a >= 0.25:
        return "mild"
    return "weak"


# ---- Correlation specs ---------------------------------------------------

@dataclass(frozen=True)
class CorrelationSpec:
    driver: str            # feature key on day N
    outcome: str           # feature key on day N+lag
    lag: int               # 0 = same day, 1 = next day
    up_title: str          # shown when r > 0 (driver up → outcome up)
    up_sev: str            # severity for the r>0 case
    down_title: str        # shown when r < 0 (driver up → outcome down)
    down_sev: str          # severity for the r<0 case


# The library of relationships VarunOS looks for. Each direction has its own
# title AND severity, hand-assigned so the framing is always correct.
DEFAULT_SPECS: list[CorrelationSpec] = [
    CorrelationSpec("sleep_hours", "hrv", 0,
                    "More sleep lifts your HRV", "good",
                    "More sleep, lower HRV — worth a look", "info"),
    CorrelationSpec("sleep_hours", "readiness", 0,
                    "Sleep is driving your readiness", "good",
                    "More sleep, lower readiness — unusual", "info"),
    CorrelationSpec("late_meal", "hrv", 1,
                    "Late dinners track with higher next-day HRV — unusual", "info",
                    "Late dinners lower your next-day HRV", "watch"),
    CorrelationSpec("late_meal", "sleep_hours", 0,
                    "Late dinners track with more sleep", "info",
                    "Late dinners cut your sleep", "watch"),
    CorrelationSpec("steps", "readiness", 1,
                    "Active days boost tomorrow's readiness", "good",
                    "More steps, lower next-day readiness — possible overreach", "watch"),
    CorrelationSpec("training_load", "readiness", 1,
                    "Training tracks with higher next-day readiness — adapting well", "good",
                    "Hard sessions cost next-day readiness", "watch"),
    CorrelationSpec("stress", "hrv", 0,
                    "Higher stress tracks with higher HRV — unusual", "info",
                    "Stress is suppressing your HRV", "watch"),
    CorrelationSpec("kcal", "readiness", 1,
                    "Eating enough supports tomorrow's readiness", "good",
                    "Higher intake, lower next-day readiness", "info"),
]


@dataclass
class Insight:
    kind: str           # "correlation" | "anomaly"
    title: str
    detail: str
    severity: str       # "info" | "good" | "watch" | "warn"
    r: Optional[float] = None
    n: Optional[int] = None
    strength: Optional[str] = None

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}


def find_correlations(
    daily: list[dict],
    specs: Optional[list[CorrelationSpec]] = None,
    *,
    min_pairs: int = 7,
    min_abs_r: float = 0.35,
) -> list[Insight]:
    """`daily` is a date-sorted list of per-day feature dicts.

    Returns surfaced insights (only relationships with enough data and a
    meaningful effect size). Sorted strongest-first.
    """
    specs = specs or DEFAULT_SPECS
    out: list[Insight] = []
    for s in specs:
        pairs: list[tuple[float, float]] = []
        for i in range(len(daily) - s.lag):
            dv = daily[i].get(s.driver)
            ov = daily[i + s.lag].get(s.outcome)
            if dv is None or ov is None:
                continue
            pairs.append((float(dv), float(ov)))
        if len(pairs) < min_pairs:
            continue
        r = spearman([p[0] for p in pairs], [p[1] for p in pairs])
        if r is None or abs(r) < min_abs_r:
            continue
        title = s.up_title if r > 0 else s.down_title
        sev = s.up_sev if r > 0 else s.down_sev
        lag_txt = "next day" if s.lag == 1 else "same day"
        detail = (f"{strength_label(r)} link over {len(pairs)} days "
                  f"({lag_txt}, r={r:+.2f}).")
        out.append(Insight("correlation", title, detail, sev,
                           r=round(r, 2), n=len(pairs), strength=strength_label(r)))
    out.sort(key=lambda i: abs(i.r or 0), reverse=True)
    return out


# ---- Anomaly / early-warning rules ---------------------------------------

def find_anomalies(daily: list[dict]) -> list[Insight]:
    """Threshold + streak rules over recent days. Protective, conservative."""
    out: list[Insight] = []
    if len(daily) < 5:
        return out
    recent = daily[-7:]

    # Resting HR creeping up: last 3 days each above the prior baseline
    rhr = [d.get("rhr") for d in daily if d.get("rhr") is not None]
    if len(rhr) >= 7:
        baseline = mean(rhr[:-3]) if len(rhr) > 3 else mean(rhr)
        last3 = rhr[-3:]
        if all(v >= baseline + 3 for v in last3):
            out.append(Insight(
                "anomaly", "Resting heart rate is trending up",
                f"Your last 3 readings ({', '.join(str(round(v)) for v in last3)} bpm) "
                f"are above your usual {round(baseline)} bpm. This often precedes "
                f"illness or signals accumulated fatigue — consider an easier day.",
                "warn"))

    # HRV crash: today well below recent mean
    hrv = [d.get("hrv") for d in daily if d.get("hrv") is not None]
    if len(hrv) >= 7:
        base = mean(hrv[:-1])
        sd = (sum((v - base) ** 2 for v in hrv[:-1]) / max(1, len(hrv) - 1)) ** 0.5
        if sd > 0 and hrv[-1] < base - 1.5 * sd:
            out.append(Insight(
                "anomaly", "HRV dropped sharply today",
                f"Today's HRV ({round(hrv[-1])} ms) is well below your recent "
                f"average ({round(base)} ms). Prioritise recovery — sleep, "
                f"hydration, lighter training.",
                "warn"))

    # Sleep debt: 3+ of last 4 nights under 6h
    short = [d for d in recent if (d.get("sleep_hours") or 99) < 6]
    if len(short) >= 3:
        out.append(Insight(
            "anomaly", "Sleep debt is building",
            f"{len(short)} of your last {len(recent)} nights were under 6 hours. "
            f"Sleep is the biggest lever on recovery — aim for an early night.",
            "warn"))

    return out


def build_insights(daily: list[dict]) -> dict:
    """Top-level: correlations + anomalies + a tiny summary."""
    corrs = find_correlations(daily)
    anoms = find_anomalies(daily)
    return {
        "days_analyzed": len(daily),
        "anomalies": [a.to_dict() for a in anoms],
        "correlations": [c.to_dict() for c in corrs],
        "enough_data": len(daily) >= 7,
    }
