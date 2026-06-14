"""Natural-language intent parser — the brain behind plain-language input.

Turns how a normal person types ("I benched 100 for 5", "I weigh 77 today",
"had 3 eggs and dal") into a structured Intent the API layer can act on. No
commands, no syntax to memorise.

This is deterministic and pure (same input -> same output, no I/O, no network),
so it runs free, works with no LLM key, and is fully testable. The API layer
may fall back to an LLM for messages this can't classify, but everything here
is the guaranteed-available spine.

WHY deterministic-first: it keeps the high-frequency logging path instant and
private (your words never need to leave the box to log a set), and it makes the
behaviour test-pinnable instead of model-dependent.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# action ∈ {log_workout, log_weight, log_meal, question}
# "question" is the catch-all the API routes to the coach narrator.
QUESTION = "question"
LOG_WORKOUT = "log_workout"
LOG_WEIGHT = "log_weight"
LOG_MEAL = "log_meal"


@dataclass
class Intent:
    action: str
    fields: dict = field(default_factory=dict)
    confidence: float = 0.0  # 0..1; the API uses this to decide on LLM fallback


_NUM = r"(\d+(?:\.\d+)?)"

# Verbs/nouns that signal a logged resistance set. Past-tense forms map to the
# canonical lift so "benched" and "bench" both resolve to bench_press downstream.
_LIFT_WORDS = (
    "bench", "benched", "squat", "squatted", "deadlift", "deadlifted", "press",
    "pressed", "ohp", "curl", "curled", "row", "rowed", "pull", "pulled",
    "pushup", "pushdown", "lunge", "lunged", "dip", "dipped", "fly", "raise",
    "rdl", "chinup", "chin", "pullup", "latpulldown", "legpress", "extension",
)
_FOOD_VERBS = ("ate", "eaten", "eat", "had", "having", "log meal", "drank", "consumed")

# kg/lbs unit token (optional in most patterns)
_UNIT = r"(?:kg|kgs|kilo|kilos|kilogram|kilograms|lb|lbs|pound|pounds)"


def _to_kg(value: float, unit: str | None) -> float:
    if unit and unit.startswith(("lb", "pound")):
        return round(value * 0.453592, 1)
    return value


def parse_intent(text: str) -> Intent:
    """Classify a free-text message and extract structured fields."""
    raw = (text or "").strip()
    t = raw.lower()
    if not t:
        return Intent(QUESTION, {}, 0.0)

    # ---- WEIGHT: "I weigh 77", "weight 77 kg", "bodyweight 77 today" ----
    # Require an explicit weigh/weight/bodyweight cue so we never mistake an age
    # or a rep count for a bodyweight entry.
    wm = re.search(
        r"\b(?:i\s*weigh(?:ed)?|weight|body\s*weight|bodyweight)\b[^0-9]{0,15}"
        + _NUM + r"\s*(" + _UNIT + r")?",
        t,
    )
    if wm:
        kg = _to_kg(float(wm.group(1)), wm.group(2))
        if 25 <= kg <= 350:  # sane human bodyweight guard
            return Intent(LOG_WEIGHT, {"weight_kg": kg}, 0.95)

    # ---- WORKOUT SET ----
    lift = _find_lift(t)
    if lift:
        wk = _parse_set(t)
        if wk:
            weight_kg, reps = wk
            return Intent(
                LOG_WORKOUT,
                {"exercise": lift, "weight_kg": weight_kg, "reps": reps},
                0.9,
            )

    # ---- MEAL: "had 3 eggs and dal", "ate 2 rotis", "log meal: paneer" ----
    if _looks_like_meal(t):
        foods = _extract_food_phrase(raw)
        if foods:
            return Intent(LOG_MEAL, {"foods_text": foods}, 0.7)

    # ---- Everything else is a question for the coach ----
    return Intent(QUESTION, {"text": raw}, 0.0)


def _find_lift(t: str) -> str | None:
    """Return the canonical lift name if the text names a known lift."""
    # Tokenise on non-letters so "100kg" doesn't swallow a lift word.
    words = re.findall(r"[a-z]+", t)
    wset = set(words)
    # Two-word forms first — "leg press" must beat the single word "press".
    if "leg" in wset and "press" in wset:
        return "leg_press"
    if ("lat" in wset or "lats" in wset) and ("pulldown" in wset or "pull" in wset):
        return "lat_pulldown"
    for w in _LIFT_WORDS:
        if w in wset:
            return _canonical_lift(w)
    return None


def _canonical_lift(word: str) -> str:
    table = {
        "bench": "bench_press", "benched": "bench_press",
        "squat": "squat", "squatted": "squat",
        "deadlift": "deadlift", "deadlifted": "deadlift",
        "ohp": "overhead_press", "press": "overhead_press", "pressed": "overhead_press",
        "curl": "curl", "curled": "curl",
        "row": "row", "rowed": "row",
        "pushdown": "tricep_pushdown", "rdl": "romanian_deadlift",
        "lunge": "lunge", "lunged": "lunge", "dip": "dip", "dipped": "dip",
        "fly": "fly", "raise": "lateral_raise",
        "pullup": "pullup", "chinup": "chinup", "chin": "chinup",
    }
    return table.get(word, word)


def _parse_set(t: str) -> tuple[float, int] | None:
    """Extract (weight_kg, reps) from common set phrasings."""
    # "100 for 5", "100kg x 5", "100 x5", "100kg for 5 reps"
    m = re.search(_NUM + r"\s*(" + _UNIT + r")?\s*(?:x|×|\*|for)\s*" + _NUM + r"\s*(?:reps?)?", t)
    if m:
        weight = _to_kg(float(m.group(1)), m.group(2))
        reps = int(float(m.group(3)))
        if reps <= 100 and weight <= 1000:
            return weight, reps
    # "100kg 5 reps" (no connector, but explicit "reps")
    m = re.search(_NUM + r"\s*" + _UNIT + r"\s+" + _NUM + r"\s*reps?", t)
    if m:
        return _to_kg(float(m.group(1)), "kg"), int(float(m.group(2)))
    return None


_QUESTION_CUES = ("what", "how", "why", "when", "where", "which", "who",
                  "should", "can", "could", "would", "do", "does", "is", "are",
                  "?")


def _looks_like_meal(t: str) -> bool:
    if t.startswith(("log meal", "logmeal")):
        return True
    # A question that merely contains "eat" ("what should I eat?") is not a log.
    if t.endswith("?") or t.split(" ", 1)[0] in _QUESTION_CUES:
        return False
    words = re.findall(r"[a-z]+", t)
    return any(v in words for v in ("ate", "eaten", "had", "having", "drank", "consumed")) \
        or words[:1] == ["eat"]


def _extract_food_phrase(raw: str) -> str:
    """Strip the leading verb so 'had 3 eggs and dal' -> '3 eggs and dal'."""
    t = raw.strip()
    t = re.sub(r"(?i)^\s*(?:log meal\s*[:\-]?\s*|i\s+)?(?:just\s+)?"
               r"(?:ate|eaten|eat|had|having|drank|consumed)\s+", "", t).strip()
    t = re.sub(r"(?i)\b(?:for|as)\s+(?:breakfast|lunch|dinner|snack)\b", "", t).strip()
    return t


# ---- LLM fallback: validate a model's structured extraction (pure) ----
def _safe_float(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _safe_int(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def intent_from_extraction(d: dict | None) -> Intent:
    """Turn an LLM's loose JSON extraction into a *validated* Intent.

    The model may hallucinate or pick the wrong action, so every field is
    range-checked here before we trust it. Anything that doesn't pass becomes a
    plain question — we never log a value we can't vouch for. Pure + testable so
    the safety guard doesn't depend on the network path that produced `d`.
    """
    d = d or {}
    action = d.get("action")

    if action == LOG_WEIGHT:
        kg = _safe_float(d.get("weight_kg"))
        if kg is not None and 25 <= kg <= 350:
            return Intent(LOG_WEIGHT, {"weight_kg": round(kg, 1)}, 0.8)

    elif action == LOG_WORKOUT:
        ex = (d.get("exercise") or "").strip().lower().replace(" ", "_")
        kg = _safe_float(d.get("weight_kg"))
        reps = _safe_int(d.get("reps"))
        if ex and kg is not None and reps and 0 < kg <= 1000 and 0 < reps <= 100:
            return Intent(LOG_WORKOUT,
                          {"exercise": ex, "weight_kg": round(kg, 1), "reps": reps}, 0.8)

    elif action == LOG_MEAL:
        foods = (d.get("foods_text") or "").strip()
        if foods:
            return Intent(LOG_MEAL, {"foods_text": foods}, 0.6)

    return Intent(QUESTION, {}, 0.0)


# ---- Food-term resolution helper (used by the API layer; pure) ----
def split_food_terms(phrase: str) -> list[tuple[float, str]]:
    """Break 'two rotis, 3 eggs and a bowl of dal' into [(qty, term), ...].

    Returns best-effort (quantity, food-term) pairs. Quantity defaults to 1.
    The API layer matches each term against the deterministic food DB.
    """
    if not phrase:
        return []
    words_to_num = {
        "a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "half": 0.5,
    }
    chunks = re.split(r"\s*(?:,|\band\b|\bwith\b|\bplus\b|\+)\s*", phrase.lower())
    out: list[tuple[float, str]] = []
    for ch in chunks:
        ch = ch.strip()
        if not ch:
            continue
        qty = 1.0
        m = re.match(r"^" + _NUM + r"\s+(.*)$", ch)
        if m:
            qty = float(m.group(1))
            ch = m.group(2)
        else:
            first = ch.split(" ", 1)[0]
            if first in words_to_num:
                qty = float(words_to_num[first])
                ch = ch[len(first):].strip()
        # drop filler measure words
        ch = re.sub(r"^(?:bowls?|cups?|glass(?:es)?|plates?|pieces?|slices?|of)\s+",
                    "", ch).strip()
        ch = re.sub(r"\bof\b", " ", ch).strip()
        if ch:
            out.append((qty, ch))
    return out
