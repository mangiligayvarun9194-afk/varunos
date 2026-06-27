"""Hermes — the companion that grows with you.

Named for the Greek messenger who *travels with* the hero. Hermes is the
relationship layer of Sarathi: a persistent, personal coach whose *mind* levels
up as it gets to know you — the mirror of the Twin, whose *body* levels up as you
train. Two growth bars: your body, and your coach.

This module is the **deterministic, pure** heart of Hermes (data in -> text/score
out, no I/O, no LLM, no network). It computes:

- `hermes_level` / `hermes_stage` — how well Hermes knows you (0-100), and the
  named relationship stage it maps to. Grows with days known, conversations, and
  the number of things it remembers about you.
- `hermes_skills` — which coaching abilities have unlocked at the current level.
- `compose_briefing` — a structured, proactive briefing (morning / midday /
  evening) built only from safe inputs: scores, labels, plan, streak, and the
  memories you chose to share. Never raw biomarkers.

The API layer may pass the composed briefing through an LLM for nicer *phrasing*,
but the substance — and the privacy gate — lives here. So Hermes works fully,
warmly, and safely with no model configured at all.
"""
from __future__ import annotations

from typing import Optional


# ---- How well Hermes knows you (the second growth bar) -----------------------

def hermes_level(
    *,
    days_known: int = 0,
    interactions: int = 0,
    memories: int = 0,
    briefings_seen: int = 0,
) -> int:
    """Relationship score 0-100. Deterministic and explainable.

    The coach's "mind" grows the way a real relationship does — through *time*
    together, *conversations*, the things it *remembers* about you, and showing
    up *daily*:

    - 30% time known (8 weeks ≈ maxed)
    - 30% conversations (120 turns ≈ maxed)
    - 25% memories it holds about you (20 ≈ maxed)
    - 15% briefings you've shared with it (60 ≈ maxed)
    """
    time = min(1.0, max(0, days_known) / 56)          # ~8 weeks
    convo = min(1.0, max(0, interactions) / 120)
    mem = min(1.0, max(0, memories) / 20)
    daily = min(1.0, max(0, briefings_seen) / 60)
    return round(100 * (0.30 * time + 0.30 * convo + 0.25 * mem + 0.15 * daily))


_STAGES = [
    (0,  "newcomer",  "Just met",        "Hermes is getting to know you."),
    (20, "acquainted", "Acquainted",     "Hermes is learning your rhythm."),
    (45, "attuned",   "Attuned",         "Hermes reads your patterns well."),
    (70, "trusted",   "Trusted",         "Hermes knows your goals and your tells."),
    (90, "inner",     "Inner circle",    "Hermes knows you better than your apps do."),
]


def hermes_stage(level: int) -> dict:
    """Map a level 0-100 to one of 5 named relationship stages."""
    idx, name, title, label = 0, _STAGES[0][1], _STAGES[0][2], _STAGES[0][3]
    for i, (cut, n, t, l) in enumerate(_STAGES):
        if level >= cut:
            idx, name, title, label = i, n, t, l
    nxt = _STAGES[idx + 1][0] if idx + 1 < len(_STAGES) else None
    return {
        "stage": idx + 1, "of": len(_STAGES), "name": name, "title": title,
        "label": label, "level": level, "next_at": nxt,
    }


# Coaching abilities unlock as Hermes levels up — so the *mind* visibly grows,
# the way the Twin's body does. Each tuple: (min_level, skill_id, description).
_SKILLS = [
    (0,  "briefings",   "Daily morning & evening briefings"),
    (0,  "logging",     "Understands plain-language logging"),
    (20, "patterns",    "Calls out patterns it spots in your data"),
    (45, "nudges",      "Proactive, in-the-moment nudges"),
    (45, "memory_recall", "Brings up what you told it before"),
    (70, "deload",      "Suggests deloads from your fatigue trend"),
    (70, "reflection",  "Asks sharper evening reflection questions"),
    (90, "foresight",   "Flags trajectory weeks ahead"),
]


def hermes_skills(level: int) -> list[dict]:
    """The abilities unlocked at this level, each with locked/unlocked state."""
    out = []
    for min_lvl, sid, desc in _SKILLS:
        out.append({"id": sid, "desc": desc, "min_level": min_lvl,
                    "unlocked": level >= min_lvl})
    return out


# ---- The proactive briefing (Hermes travels with you) ------------------------

def _greeting(part_of_day: str, name: Optional[str]) -> str:
    who = f", {name}" if name else ""
    return {
        "morning": f"Good morning{who}",
        "midday": f"Hey{who}",
        "evening": f"Evening{who}",
    }.get(part_of_day, f"Hi{who}")


def _readiness_focus(color: Optional[str]) -> tuple[str, str]:
    """(headline-tail, focus) tuned to today's readiness band."""
    return {
        "GREEN": ("you're recovered and ready", "Good day to push — chase a PR."),
        "YELLOW": ("you're partially recovered", "Train, but trim a set or two and keep effort honest."),
        "RED": ("your body's asking for a break", "Keep it light today — a walk, mobility, real recovery."),
    }.get((color or "").upper(), ("let's get a read on your recovery",
                                  "Do a quick check-in or sync your watch and I'll tailor today."))


def compose_briefing(
    *,
    part_of_day: str = "morning",
    name: Optional[str] = None,
    readiness: Optional[dict] = None,
    plan: Optional[dict] = None,
    streak_weeks: int = 0,
    memories: Optional[list[dict]] = None,
    last_win: Optional[str] = None,
    level: int = 0,
) -> dict:
    """Build a structured, proactive briefing from SAFE inputs only.

    `readiness` carries scores/colors (not raw HRV/BP). `memories` are short
    user-chosen strings (goals/preferences/wins). Returns a dict of parts the UI
    (or an LLM phrasing pass) can render. Pure — no I/O.
    """
    memories = memories or []
    color = (readiness or {}).get("color")
    score = (readiness or {}).get("overall")
    tail, focus = _readiness_focus(color)

    greeting = _greeting(part_of_day, name)
    if score is not None:
        headline = f"{tail.capitalize()} — readiness {round(score)}/100 ({color})."
    else:
        headline = tail.capitalize() + "."

    # A nudge that references what Hermes remembers, once it's attuned enough.
    nudge = None
    goal_mem = next((m for m in memories if m.get("kind") == "goal"), None)
    if level >= 20 and goal_mem:
        nudge = f"Keeping your goal in mind: {goal_mem['text']}."
    elif streak_weeks >= 2:
        nudge = f"You're on a {streak_weeks}-week streak — protect it."
    elif last_win:
        nudge = f"Last win I logged: {last_win}. Let's build on it."

    # Plan line from the (already safe) workout summary.
    plan_line = None
    if plan and plan.get("day_name"):
        decision = plan.get("decision")
        plan_line = f"Today: {plan['day_name']}" + (f" · {decision} call." if decision else ".")

    reflection_prompt = None
    if part_of_day == "evening":
        reflection_prompt = ("One line — what went well today, and what's one thing "
                             "you'll do differently tomorrow?")
        focus = "Wind down. Sleep is where today's training actually sticks."

    signoff = {
        "morning": "I've got your back today.",
        "midday": "Small choices add up. Keep going.",
        "evening": "Rest well — we go again tomorrow.",
    }.get(part_of_day, "I'm here whenever you need me.")

    return {
        "part_of_day": part_of_day,
        "greeting": greeting,
        "headline": headline,
        "plan": plan_line,
        "focus": focus,
        "nudge": nudge,
        "reflection_prompt": reflection_prompt,
        "signoff": signoff,
        "readiness_color": color,
    }


def briefing_text(b: dict) -> str:
    """Flatten a composed briefing into one friendly paragraph (LLM-free)."""
    parts = [f"{b['greeting']}. {b['headline']}"]
    if b.get("plan"):
        parts.append(b["plan"])
    if b.get("focus"):
        parts.append(b["focus"])
    if b.get("nudge"):
        parts.append(b["nudge"])
    if b.get("reflection_prompt"):
        parts.append(b["reflection_prompt"])
    parts.append(b["signoff"])
    return " ".join(p for p in parts if p)


def part_of_day(hour: int) -> str:
    """Local hour (0-23) -> 'morning' | 'midday' | 'evening'."""
    if 4 <= hour < 12:
        return "morning"
    if 12 <= hour < 18:
        return "midday"
    return "evening"


# ============================================================================
# Hermes v2 — memory that *notices*. Deterministic goal tracking + a ranked
# "observations" engine, so Hermes references your actual history and goals
# instead of generic advice. All pure: data in -> safe strings out, no I/O/LLM.
# This is the wedge: every competitor's AI coach is hated for being forgetful.
# ============================================================================

import re as _re

# Plain-language lift names -> the exercise_id the logger stores.
_LIFT_ALIASES = {
    "deadlift": "deadlift", "dead lift": "deadlift",
    "bench": "bench_press", "bench press": "bench_press",
    "squat": "squat", "back squat": "squat",
    "overhead press": "overhead_press", "ohp": "overhead_press", "press": "overhead_press",
    "row": "barbell_row", "barbell row": "barbell_row",
    "pull up": "pull_up", "pullup": "pull_up", "chin up": "pull_up",
    "clean": "power_clean", "snatch": "snatch",
}

_MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july",
     "august", "september", "october", "november", "december"], start=1)}


def parse_goal(text: str) -> Optional[dict]:
    """Extract a structured target from a plain-language goal, or None.

    Handles two shapes Hermes can actually track:
      - a strength target:  "deadlift 180kg by December" ->
        {kind: strength, exercise: deadlift, target_kg: 180, deadline_month: 12}
      - a bodyweight target: "lose 5 kg" / "get to 75kg" ->
        {kind: weight, ...}
    Honest by design: only returns a goal it can measure against logged data.
    """
    if not text:
        return None
    t = text.lower()

    # deadline month, if any ("by december")
    deadline_month = None
    m = _re.search(r"by\s+([a-z]+)", t)
    if m and m.group(1) in _MONTHS:
        deadline_month = _MONTHS[m.group(1)]

    # weight (bodyweight) goals
    wt = _re.search(r"(lose|drop|cut)\s+(\d+(?:\.\d+)?)\s*kg", t)
    if wt:
        return {"kind": "weight", "direction": "lose", "amount_kg": float(wt.group(2)),
                "deadline_month": deadline_month}
    wt2 = _re.search(r"(?:get to|reach|hit)\s+(\d+(?:\.\d+)?)\s*kg(?!\s*[x×])", t)
    if wt2 and not any(a in t for a in _LIFT_ALIASES):
        return {"kind": "weight", "direction": "target", "target_kg": float(wt2.group(2)),
                "deadline_month": deadline_month}

    # strength goals: a known lift + a kg number
    for alias, exid in _LIFT_ALIASES.items():
        if alias in t:
            num = _re.search(r"(\d+(?:\.\d+)?)\s*kg", t) or _re.search(rf"{alias}\D*(\d+(?:\.\d+)?)", t)
            if num:
                return {"kind": "strength", "exercise": exid, "alias": alias,
                        "target_kg": float(num.group(1)), "deadline_month": deadline_month}
    return None


def goal_progress(goal: dict, *, current_kg: Optional[float] = None,
                  month: Optional[int] = None) -> dict:
    """Honest progress for a parsed goal. No fabricated 'pace' — just the real
    gap, a percentage, and whether it's achieved, plus months-left if dated."""
    out = {"kind": goal.get("kind"), "achieved": False, "text": None}
    months_left = None
    if goal.get("deadline_month") and month:
        months_left = (goal["deadline_month"] - month) % 12
        out["months_left"] = months_left

    if goal["kind"] == "strength":
        target = goal["target_kg"]
        cur = current_kg or 0
        out["target_kg"], out["current_kg"] = target, cur
        out["pct"] = round(100 * cur / target) if target else 0
        if cur >= target:
            out["achieved"] = True
            out["text"] = f"You hit your {goal['alias']} goal of {_num(target)}kg. 🎉"
        else:
            gap = round(target - cur, 1)
            base = (f"{goal['alias'].capitalize()} goal: {_num(cur)} / {_num(target)}kg "
                    f"({out['pct']}%) — {_num(gap)}kg to go")
            out["text"] = base + (f", ~{months_left} month(s) left." if months_left else ".")
        return out

    if goal["kind"] == "weight":
        if goal.get("direction") == "lose":
            out["text"] = f"Goal: lose {_num(goal['amount_kg'])}kg" + (
                f" by {list(_MONTHS)[goal['deadline_month'] - 1].capitalize()}." if goal.get("deadline_month") else ".")
        else:
            out["text"] = f"Goal: reach {_num(goal.get('target_kg'))}kg."
        return out
    return out


def _num(v) -> str:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return str(v)
    return str(int(f)) if f == int(f) else f"{f:g}"


def _readiness_observations(readiness: Optional[dict]) -> list[dict]:
    """One recovery-aware coaching line from per-muscle readiness. The actionable
    'ease off' warning wins; otherwise suggest what's fresh."""
    if not readiness:
        return []
    cap = lambda gs: ", ".join(g.capitalize() for g in gs)
    avoid = readiness.get("avoid") or []
    train = readiness.get("train_today") or []
    if avoid:
        verb = "is" if len(avoid) == 1 else "are"
        return [{"kind": "coach", "text": f"{cap(avoid)} {verb} still recovering — ease off there today."}]
    if train:
        verb = "is" if len(train) == 1 else "are"
        return [{"kind": "coach", "text": f"{cap(train)} {verb} fresh and ready — a good day to train them."}]
    return []


def _strength_observations(strength: Optional[dict]) -> list[dict]:
    """Turn a strength_intel report into 0-3 specific coaching lines, ranked
    most-actionable first. Empty if there's nothing true to say."""
    if not strength:
        return []
    h = strength.get("highlights", {}) or {}
    out: list[dict] = []
    # A fresh strength peak — celebrate momentum.
    for e in (h.get("prs") or [])[:1]:
        out.append({"kind": "win",
                    "text": f"New strength peak on {e['name']} — up {e['pct']}%. That's real progress."})
    # A stalled or slipping lift — the highest-value nudge.
    for e in (h.get("stalled") or [])[:1]:
        if e.get("status") == "declining":
            out.append({"kind": "coach",
                        "text": f"{e['name']} has slipped {abs(e.get('pct') or 0)}% — worth a deload or a form check."})
        else:
            out.append({"kind": "coach",
                        "text": f"{e['name']} has been flat for {e.get('span_days', 0)} days — time to change the stimulus (add a set or a little load)."})
    # A neglected / under-trained muscle group.
    neglected = h.get("neglected") or []
    under = h.get("undertrained") or []
    if neglected:
        out.append({"kind": "coach",
                    "text": f"You haven't trained {neglected[0]} at all lately — let's not let it fall behind."})
    elif under:
        out.append({"kind": "coach",
                    "text": f"Your {under[0]} volume is low next to everything else — bring it up this week."})
    return out


def observations(
    *,
    goal_lines: Optional[list[str]] = None,
    warnings: Optional[list[str]] = None,
    correlations: Optional[list[str]] = None,
    memories: Optional[list[dict]] = None,
    last_workout_days: Optional[int] = None,
    streak_weeks: int = 0,
    readiness_trend: Optional[str] = None,  # "down" | "up" | None
    strength: Optional[dict] = None,         # strength_intel.analyze() output
    readiness: Optional[dict] = None,        # readiness_muscle.analyze() output
    level: int = 0,
    limit: int = 4,
) -> list[dict]:
    """Rank the specific, true things Hermes can say right now. Each item:
    {text, kind}. Generic filler is deliberately excluded — if we have nothing
    specific, we return an empty list rather than something hollow."""
    out: list[dict] = []
    for g in (goal_lines or []):
        out.append({"kind": "goal", "text": g})
    for w in (warnings or [])[:2]:
        out.append({"kind": "warning", "text": w})
    # Strength-intelligence coaching — specific, drawn from real logged history.
    out.extend(_strength_observations(strength))
    # Recovery-aware "what to train today" from per-muscle readiness.
    out.extend(_readiness_observations(readiness))
    if last_workout_days is not None and last_workout_days >= 4:
        out.append({"kind": "nudge",
                    "text": f"It's been {last_workout_days} days since your last logged session."})
    if readiness_trend == "down":
        out.append({"kind": "warning", "text": "Your readiness has been trending down — protect your sleep."})
    for c in (correlations or [])[:1]:
        out.append({"kind": "pattern", "text": c})
    # Memory recall only once Hermes is attuned enough to have earned it.
    if level >= 20:
        struggle = next((m for m in (memories or []) if m.get("kind") == "struggle"), None)
        if struggle:
            out.append({"kind": "recall", "text": f"You told me you struggle with: {struggle['text']}."})
    if streak_weeks >= 2:
        out.append({"kind": "win", "text": f"You're on a {streak_weeks}-week training streak — keep it alive."})
    # de-dupe by text, cap
    seen, ranked = set(), []
    for o in out:
        if o["text"] not in seen:
            seen.add(o["text"])
            ranked.append(o)
    return ranked[:limit]
