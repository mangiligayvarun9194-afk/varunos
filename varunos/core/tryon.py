"""
Twin Try-On engine — gymwear catalog + deterministic size fitting.

Pure and deterministic like everything in core/: same inputs, same outputs,
no I/O. The catalog is fixed module-level data (8 items). Fitting answers one
question per garment: "given this body, which size, and how does it sit?"

Tops (tee / tank / hoodie) are governed by chest_cm; bottoms (joggers /
shorts) by waist_cm. Each item carries an ordered S→XXL size chart of
[lo, hi] ranges in cm, modeled on real Indian gymwear charts. Charts are
contiguous (next size starts 1 cm above the previous ceiling), so the
gap-fallback path should rarely fire in practice — but it is defined.

Verdicts:
  'need_measurements' — the governing measurement is missing
  'true'              — inside a size's range (or in a chart gap → nearest size)
  'size_down'         — below the smallest size, within NEAR_MISS_CM of it
  'size_up'           — above the largest size, within NEAR_MISS_CM of it
  'no_fit'            — outside the chart by more than NEAR_MISS_CM
"""

from __future__ import annotations


TOP_KINDS: frozenset[str] = frozenset({"tee", "tank", "hoodie"})
BOTTOM_KINDS: frozenset[str] = frozenset({"joggers", "shorts"})

# How far (cm) outside the chart still earns a size_up / size_down nudge
# instead of a flat no_fit.
NEAR_MISS_CM = 4.0

# The catalog. Prices in INR (799–2499). Names are premium and
# element-flavored (earth / fire / air / sky / flow) — no deity names.
# sizes is an ordered mapping size → (lo, hi) of the governing girth in cm.
CATALOG: tuple[dict, ...] = (
    {
        "id": "tee-core", "name": "Stonecore Tee", "kind": "tee",
        "price_inr": 1099,
        "sizes": {"S": (86.0, 91.0), "M": (92.0, 97.0), "L": (98.0, 104.0),
                  "XL": (105.0, 112.0), "XXL": (113.0, 120.0)},
    },
    {
        "id": "tee-oversize", "name": "Monsoon Oversize Tee", "kind": "tee",
        "price_inr": 1299,
        "sizes": {"S": (88.0, 94.0), "M": (95.0, 101.0), "L": (102.0, 108.0),
                  "XL": (109.0, 116.0), "XXL": (117.0, 124.0)},
    },
    {
        "id": "tank-train", "name": "Ember Training Tank", "kind": "tank",
        "price_inr": 899,
        "sizes": {"S": (85.0, 90.0), "M": (91.0, 96.0), "L": (97.0, 103.0),
                  "XL": (104.0, 111.0), "XXL": (112.0, 119.0)},
    },
    {
        "id": "hoodie-flow", "name": "Flowstate Hoodie", "kind": "hoodie",
        "price_inr": 2499,
        "sizes": {"S": (88.0, 93.0), "M": (94.0, 100.0), "L": (101.0, 107.0),
                  "XL": (108.0, 115.0), "XXL": (116.0, 123.0)},
    },
    {
        "id": "joggers-earth", "name": "Terrain Joggers", "kind": "joggers",
        "price_inr": 1999,
        "sizes": {"S": (71.0, 76.0), "M": (77.0, 82.0), "L": (83.0, 89.0),
                  "XL": (90.0, 97.0), "XXL": (98.0, 106.0)},
    },
    {
        "id": "shorts-agni", "name": "Emberline Shorts", "kind": "shorts",
        "price_inr": 1199,
        "sizes": {"S": (70.0, 75.0), "M": (76.0, 81.0), "L": (82.0, 88.0),
                  "XL": (89.0, 96.0), "XXL": (97.0, 105.0)},
    },
    {
        "id": "tee-vayu", "name": "Zephyr Featherlight Tee", "kind": "tee",
        "price_inr": 1499,
        "sizes": {"S": (86.0, 91.0), "M": (92.0, 97.0), "L": (98.0, 104.0),
                  "XL": (105.0, 112.0), "XXL": (113.0, 120.0)},
    },
    {
        "id": "joggers-akasha", "name": "Skyline Tapered Joggers", "kind": "joggers",
        "price_inr": 2199,
        "sizes": {"S": (72.0, 77.0), "M": (78.0, 83.0), "L": (84.0, 90.0),
                  "XL": (91.0, 98.0), "XXL": (99.0, 107.0)},
    },
)

CATALOG_BY_ID: dict[str, dict] = {item["id"]: item for item in CATALOG}


def governing_field(item: dict) -> str:
    """Which measurement decides this garment's size."""
    return "chest_cm" if item["kind"] in TOP_KINDS else "waist_cm"


def fit_item(item: dict, m: dict) -> dict:
    """Fit one garment to one body. Returns {'size': str|None, 'verdict': str}."""
    value = (m or {}).get(governing_field(item))
    if value is None or isinstance(value, bool) or not isinstance(value, (int, float)):
        return {"size": None, "verdict": "need_measurements"}
    v = float(value)
    sizes: dict[str, tuple[float, float]] = item["sizes"]
    names = list(sizes)

    for name in names:
        lo, hi = sizes[name]
        if lo <= v <= hi:
            return {"size": name, "verdict": "true"}

    smallest_lo = sizes[names[0]][0]
    largest_hi = sizes[names[-1]][1]
    if v < smallest_lo:
        if smallest_lo - v <= NEAR_MISS_CM:
            return {"size": names[0], "verdict": "size_down"}
        return {"size": None, "verdict": "no_fit"}
    if v > largest_hi:
        if v - largest_hi <= NEAR_MISS_CM:
            return {"size": names[-1], "verdict": "size_up"}
        return {"size": None, "verdict": "no_fit"}

    # Inside the chart but between two ranges (a gap) → nearest size, worn true.
    best, best_dist = names[0], float("inf")
    for name in names:
        lo, hi = sizes[name]
        dist = min(abs(v - lo), abs(v - hi))
        if dist < best_dist:
            best, best_dist = name, dist
    return {"size": best, "verdict": "true"}


def fit_catalog(m: dict, goal_m: dict) -> list[dict]:
    """Fit every catalog item against today's body and the goal body.

    Returns the public item shape (id, name, kind, price_inr, sizes) plus
    'today' and 'goal' fit results. The size chart ships as [lo, hi] lists so
    the payload is plain JSON.
    """
    out = []
    for item in CATALOG:
        out.append({
            "id": item["id"],
            "name": item["name"],
            "kind": item["kind"],
            "price_inr": item["price_inr"],
            "sizes": {s: [lo, hi] for s, (lo, hi) in item["sizes"].items()},
            "today": fit_item(item, m),
            "goal": fit_item(item, goal_m),
        })
    return out
