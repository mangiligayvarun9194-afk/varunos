"""
The Brain — VarunOS's coaching narrator.

SAFETY-CRITICAL DESIGN: the brain only ever sees TIERS, SCORES, ACTION LABELS
and INSIGHT SUMMARIES — never raw biomarkers (no glucose curves, no BP numbers).
`build_brain_context()` is the gate that enforces this. Whether narration is
done by an LLM or by the deterministic templates here, the input is the same
sanitised context, so the brain literally cannot leak raw medical data.

The LLM call (optional, behind an env key) lives in the API layer. This module
provides the context gate + a genuinely useful template narrator so the coach
works fully even with no LLM configured.
"""

from __future__ import annotations
from typing import Optional


SAFE_SYSTEM_PROMPT = (
    "You are VarunOS, a calm, precise personal fitness and health coach. "
    "You are given only computed tiers, scores and action labels — never raw "
    "medical values. Rules you must never break: (1) never diagnose; speak in "
    "terms of tiers and 'discuss with your doctor'. (2) never invent numbers — "
    "only use the figures provided. (3) for anything ELEVATED/HIGH/CRITICAL, "
    "advise seeing a doctor; for emergencies, advise calling local emergency "
    "services. (4) be concise, warm and actionable. (5) you are educational, "
    "not a medical device."
)


def build_brain_context(
    *,
    readiness: Optional[dict] = None,
    diet: Optional[dict] = None,
    workout: Optional[dict] = None,
    insights: Optional[dict] = None,
    consumed_kcal: Optional[float] = None,
) -> dict:
    """Assemble the ONLY information the brain is allowed to see.

    Deliberately excludes raw biomarkers. Tiers and scores only.
    """
    ctx: dict = {}
    if readiness:
        ctx["readiness"] = {
            "score": readiness.get("overall"),
            "color": readiness.get("color"),
            # component scores are 0-100 indices, not raw HRV/BP — safe
            "components": readiness.get("components"),
        }
    if diet:
        ctx["nutrition"] = {
            "target_kcal": diet.get("target_kcal"),
            "protein_g": diet.get("protein_g"),
            "fat_g": diet.get("fat_g"),
            "carbs_g": diet.get("carbs_g"),
            "consumed_kcal": round(consumed_kcal) if consumed_kcal is not None else None,
        }
    if workout:
        ctx["workout"] = {
            "day": workout.get("day_name"),
            "decision": workout.get("decision"),
            "exercises": [e.get("id") for e in workout.get("exercises", [])],
        }
    if insights:
        ctx["patterns"] = [c.get("title") for c in insights.get("correlations", [])][:5]
        ctx["warnings"] = [a.get("title") for a in insights.get("anomalies", [])][:5]
    return ctx


def narrate_template(question: str, ctx: dict) -> str:
    """Deterministic coach answer from the safe context. Used when no LLM key."""
    q = (question or "").lower()
    r = ctx.get("readiness") or {}
    n = ctx.get("nutrition") or {}
    w = ctx.get("workout") or {}
    patterns = ctx.get("patterns") or []
    warnings = ctx.get("warnings") or []

    def readiness_line() -> str:
        if not r.get("score"):
            return "Do a quick check-in or sync your watch and I'll have your readiness."
        comps = r.get("components") or {}
        parts = " · ".join(f"{k} {round(v)}" for k, v in comps.items())
        return f"You're {r['color']} today — readiness {round(r['score'])}/100 ({parts})."

    # Intent routing
    if any(k in q for k in ["how am i", "briefing", "status", "today", "should i train"]):
        line = readiness_line()
        if r.get("color") == "GREEN":
            line += " Good day to push hard."
        elif r.get("color") == "YELLOW":
            line += " Train, but trim a set or two and watch your effort."
        elif r.get("color") == "RED":
            line += " Keep it light — walk, stretch, recover."
        if warnings:
            line += " ⚠ " + warnings[0]
        return line

    if any(k in q for k in ["eat", "macro", "diet", "food", "calorie", "nutrition"]):
        if not n.get("target_kcal"):
            return "Set your profile and I'll compute your calorie + macro targets."
        eaten = n.get("consumed_kcal")
        base = (f"Target {n['target_kcal']} kcal — P{n['protein_g']}g · "
                f"F{n['fat_g']}g · C{n['carbs_g']}g.")
        if eaten is not None:
            left = n["target_kcal"] - eaten
            base += f" You've had {eaten}; {max(0, left)} to go."
        return base

    if any(k in q for k in ["workout", "train", "exercise", "gym", "lift"]):
        if not w.get("decision"):
            return "Open the Log tab to start today's session — I auto-detect PRs."
        exs = ", ".join((w.get("exercises") or [])[:4]).replace("_", " ")
        return f"{w.get('day')} day · {w['decision']} call. Main lifts: {exs}."

    if any(k in q for k in ["pattern", "insight", "why", "trend", "correlat"]):
        if patterns:
            return "Here's what I see in your data: " + "; ".join(patterns[:3]) + "."
        return "I need ~7 days of check-ins to surface your personal patterns."

    if warnings and any(k in q for k in ["wrong", "tired", "off", "sick", "recover"]):
        return "⚠ " + warnings[0] + " Prioritise sleep, hydration and an easy day."

    # Default
    bits = [readiness_line()]
    if patterns:
        bits.append("One pattern I've noticed: " + patterns[0] + ".")
    bits.append("Ask me about your workout, macros, patterns, or how you're doing.")
    return " ".join(bits)
