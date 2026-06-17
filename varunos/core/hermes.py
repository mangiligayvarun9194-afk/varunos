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
