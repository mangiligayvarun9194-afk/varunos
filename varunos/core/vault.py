"""The Health Vault — your entire health story as open, linked Markdown.

Pure functions (data in -> {path: markdown} out, no I/O) so the export is
deterministic and fully testable. The API layer zips the result; the user opens
the folder in Obsidian and sees their life as a graph: day notes wiki-linked to
exercise notes, PRs, and meals. This is the "you own your data, forever" pillar
made real — plain files, portable anywhere, that we never hold hostage.

Links use bare note names (Obsidian resolves `[[2026-06-13]]` and
`[[bench_press]]` by basename), so day-dates and exercise-ids — which never
collide — wire the graph together automatically.
"""
from __future__ import annotations

from collections import defaultdict


def _num(v) -> str:
    """Render a number without trailing .0 (100.0 -> '100', 102.5 -> '102.5')."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return str(v)
    return str(int(f)) if f == int(f) else f"{f:g}"


def _title(exid: str) -> str:
    return (exid or "").replace("_", " ").strip().capitalize() or "Exercise"


def _date(ts: str) -> str:
    return (ts or "")[:10]


def build_vault(profile: dict, sets: list[dict], meals: list[dict]) -> dict[str, str]:
    """Build the Markdown vault. Returns {relative_path: file_contents}."""
    profile = profile or {}
    sets = sets or []
    meals = meals or []

    # ---- group by day and by exercise ----
    days_sets: dict[str, list[dict]] = defaultdict(list)
    days_meals: dict[str, list[dict]] = defaultdict(list)
    ex_history: dict[str, list[dict]] = defaultdict(list)

    for s in sets:
        d = _date(s.get("ts"))
        if not d:
            continue
        days_sets[d].append(s)
        ex = s.get("exercise_id") or "exercise"
        ex_history[ex].append({"date": d, "weight_kg": s.get("weight_kg") or 0,
                               "reps": s.get("reps") or 0, "rpe": s.get("rpe")})
    for m in meals:
        d = _date(m.get("ts"))
        if d:
            days_meals[d].append(m)

    all_dates = sorted(set(days_sets) | set(days_meals), reverse=True)
    files: dict[str, str] = {}

    # ---- per-exercise notes (with PR) ----
    for exid, hist in sorted(ex_history.items()):
        hist_sorted = sorted(hist, key=lambda h: h["date"], reverse=True)
        best = max(hist, key=lambda h: (h["weight_kg"], h["reps"]), default=None)
        best_kg = best["weight_kg"] if best else 0
        rows = "\n".join(
            f"| [[{h['date']}]] | {_num(h['weight_kg'])} kg | {h['reps']} |"
            + (f" {_num(h['rpe'])} |" if h.get("rpe") is not None else " — |")
            for h in hist_sorted
        )
        files[f"exercises/{exid}.md"] = (
            f"---\ntype: exercise\nexercise: {exid}\nbest_kg: {_num(best_kg)}\n---\n\n"
            f"# {_title(exid)}\n\n"
            f"**Personal best:** {_num(best_kg)} kg"
            + (f" × {best['reps']}\n\n" if best else "\n\n")
            + f"Logged **{len(hist)}** times.\n\n"
            f"| Day | Weight | Reps | RPE |\n|---|---|---|---|\n{rows}\n"
        )

    # ---- per-day notes ----
    for d in all_dates:
        parts = [f"---\ndate: {d}\ntype: day\n---\n", f"# {d}\n"]
        ds = days_sets.get(d, [])
        if ds:
            parts.append("## Training\n")
            for s in ds:
                ex = s.get("exercise_id") or "exercise"
                parts.append(
                    f"- [[{ex}]] — {_num(s.get('weight_kg') or 0)} kg × {s.get('reps') or 0}"
                    + (f" @ RPE {_num(s.get('rpe'))}" if s.get("rpe") is not None else "")
                )
            parts.append("")
        dm = days_meals.get(d, [])
        if dm:
            total = sum(m.get("kcal") or 0 for m in dm)
            parts.append("## Nutrition\n")
            for m in dm:
                name = (m.get("food_id") or "food").replace("_", " ")
                parts.append(
                    f"- {name} ×{_num(m.get('portions') or 1)} — "
                    f"{_num(m.get('kcal') or 0)} kcal "
                    f"(P{_num(m.get('p_g') or 0)} C{_num(m.get('c_g') or 0)} F{_num(m.get('f_g') or 0)})"
                )
            parts.append(f"\n**Day total:** {_num(total)} kcal\n")
        files[f"days/{d}.md"] = "\n".join(parts)

    # ---- profile ----
    name = profile.get("name") or profile.get("user_id") or "You"
    prof_rows = []
    for label, key, unit in [("Age", "age", ""), ("Sex", "sex", ""),
                             ("Height", "height_cm", " cm"), ("Weight", "weight_kg", " kg"),
                             ("Activity", "activity", ""), ("Goal", "goal", "")]:
        v = profile.get(key)
        if v not in (None, ""):
            prof_rows.append(f"| {label} | {_num(v) if unit else v}{unit} |")
    files["profile.md"] = (
        f"---\ntype: profile\n---\n\n# {name}\n\n"
        + ("| Field | Value |\n|---|---|\n" + "\n".join(prof_rows) + "\n" if prof_rows
           else "_Profile not filled in yet._\n")
    )

    # ---- README (the front door + graph hint) ----
    total_kcal_days = len(days_meals)
    files["README.md"] = (
        f"# {name}'s Sarathi Health Vault\n\n"
        "> Your health story — every day, workout, and meal — as open Markdown files "
        "you own forever. Nothing here is locked in.\n\n"
        "## At a glance\n\n"
        f"- **{len(all_dates)}** days logged\n"
        f"- **{len(sets)}** sets across **{len(ex_history)}** exercises\n"
        f"- **{len(meals)}** meals over **{total_kcal_days}** days\n\n"
        "## How to explore it\n\n"
        "Open this folder as a vault in [Obsidian](https://obsidian.md) and click "
        "**Graph view** — you'll see your days wired to your exercises and PRs. Or just "
        "read the files in any text editor; they're yours.\n\n"
        "- [[profile]] — your basics\n"
        "- `days/` — one note per day\n"
        "- `exercises/` — your history and PR for every lift\n\n"
        "_Exported by Sarathi — your charioteer._\n"
    )
    return files
