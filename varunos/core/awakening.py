"""The Awakening — onboarding as the five trials (T4 architecture §1).

First-run is the story made personal: five acts in ascending tattva order —
पृथ्वी → आपस् → अग्नि → वायु → आकाश, feet to crown — each act a real product
input that ignites one centre on the user's own Twin.

Design law: progress is DERIVED from the existence of real records, never
stored. No progress table to drift; existing users auto-complete instantly;
abandoning mid-flow costs nothing. The only stored bit is the user's optional
`air_skipped` choice (the camera act must be skippable without shame).

Pure: data in -> state out. The API layer supplies the aggregates.
"""
from __future__ import annotations

# The five acts, ascending the body: foundation → tides → fire → breath → sky.
ACTS = [
    {
        "element": "earth", "word": "पृथ्वी", "name": "The Foundation",
        "ask": "Tell the mirror your true size — height, weight, the numbers that are you.",
        "gift": "The mirror stands. Earth has met you.",
        "input": "measurements",
    },
    {
        "element": "water", "word": "आपस्", "name": "The Tides",
        "ask": "Six taps about your night and how you feel.",
        "gift": "The tide has read your night. Water knows you.",
        "input": "checkin",
    },
    {
        "element": "fire", "word": "अग्नि", "name": "The Flame",
        "ask": "Say one meal, in your own words.",
        "gift": "The flame is named. Fire feeds you now.",
        "input": "meal",
    },
    {
        "element": "air", "word": "वायु", "name": "The Breath",
        "ask": "Thirty seconds before the camera — let the wind watch one rep.",
        "gift": "The wind has watched you move. Air corrects you.",
        "input": "formcoach", "skippable": True,
    },
    {
        "element": "space", "word": "आकाश", "name": "The Seal",
        "ask": None,   # the seal asks nothing — it reveals
        "gift": "All of it is remembered. Space holds your story.",
        "input": None,
    },
]


def awakening_state(
    *,
    has_measurements: bool = False,
    checkins: int = 0,
    meals: int = 0,
    coached_sets: int = 0,
    vault_records: int = 0,
    air_skipped: bool = False,
    flow_skipped: bool = False,
) -> dict:
    """Derive the five-act state from what actually exists.

    Returns {acts: [{element, word, name, ask, gift, status, skippable?}],
             next, complete, pct, skipped}. `status` is 'done' or 'open';
    `next` is the first open act's element (None when complete). The seal
    (आकाश) closes itself once every other act is resolved and the vault
    holds at least one record — memory seals what the journey wrote.
    """
    done = {
        "earth": has_measurements,
        "water": checkins > 0,
        "fire": meals > 0,
        "air": coached_sets > 0 or air_skipped,
    }
    done["space"] = all(done.values()) and vault_records > 0

    acts = []
    for spec in ACTS:
        act = {k: spec[k] for k in ("element", "word", "name", "ask", "gift")}
        if spec.get("skippable"):
            act["skippable"] = True
        act["status"] = "done" if done[spec["element"]] else "open"
        acts.append(act)

    open_elements = [a["element"] for a in acts if a["status"] == "open"]
    complete = not open_elements
    return {
        "acts": acts,
        "next": None if complete else open_elements[0],
        "complete": complete,
        "pct": round(sum(done.values()) / len(ACTS), 2),
        "skipped": flow_skipped,
    }


def act_for(element: str) -> dict | None:
    """The act spec for an element, or None."""
    return next((a for a in ACTS if a["element"] == element), None)
