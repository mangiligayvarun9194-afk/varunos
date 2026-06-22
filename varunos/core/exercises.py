"""The Sarathi strength-training exercise library — coach-grade form reference.

Pure data + accessors (no I/O, no LLM) so it's deterministic and testable, and so
Hermes can quote form cues without ever guessing. Each exercise carries the things
a real strength coach cares about: the target + synergist muscles (mapped to our
six groups so the Twin and per-muscle systems share one source of truth), the
range of motion, step-by-step execution, the key coaching cues, the common
mistakes, and a sane tempo.

Curated, classic-physique-style staples (heavy compounds + targeted hypertrophy) —
quality over a 1000-item dump. Grounded in standard strength-training biomechanics
(the ExRx / NSCA consensus on joint actions and muscle roles).
"""
from __future__ import annotations

# group = one of: chest, back, shoulders, arms, legs, core  (matches the Twin/readiness groups)
# mechanic = compound | isolation ; force = push | pull | hinge | static
EXERCISES: dict[str, dict] = {
    "barbell_back_squat": {
        "name": "Barbell Back Squat", "group": "legs", "mechanic": "compound", "force": "push",
        "equipment": "barbell", "level": "intermediate",
        "primary": ["quadriceps", "gluteus maximus"],
        "secondary": ["adductors", "hamstrings", "erector spinae", "soleus"],
        "rom": "Hips below the top of the knee (at/below parallel); knees track over toes.",
        "execution": [
            "Bar on upper traps (high-bar) or rear delts (low-bar); grip just outside shoulders.",
            "Brace the core, big breath, unrack and step back to shoulder-width stance.",
            "Sit hips back and down together, knees tracking over toes, chest tall.",
            "Descend to at/below parallel, then drive the floor away to stand tall.",
        ],
        "cues": ["Brace before you descend", "Knees out, track over toes", "Drive through mid-foot", "Stay tall — don't let the chest fall"],
        "mistakes": ["Knees caving in", "Heels rising / weight on toes", "Cutting depth above parallel", "Rounding the lower back"],
        "tempo": "2s down · brief pause · drive up",
    },
    "barbell_front_squat": {
        "name": "Barbell Front Squat", "group": "legs", "mechanic": "compound", "force": "push",
        "equipment": "barbell", "level": "intermediate",
        "primary": ["quadriceps"], "secondary": ["gluteus maximus", "erector spinae", "core"],
        "rom": "Deep squat to below parallel with a vertical torso.",
        "execution": [
            "Rack the bar on the front delts, elbows high, fingertips under the bar.",
            "Brace, sit straight down keeping the torso as vertical as possible.",
            "Descend below parallel, elbows up the whole time, then stand.",
        ],
        "cues": ["Elbows high", "Stay upright", "Knees forward and out"],
        "mistakes": ["Elbows dropping (bar rolls forward)", "Torso pitching forward", "Heels lifting"],
        "tempo": "2s down · 1s up",
    },
    "barbell_deadlift": {
        "name": "Barbell Deadlift", "group": "back", "mechanic": "compound", "force": "hinge",
        "equipment": "barbell", "level": "intermediate",
        "primary": ["erector spinae", "gluteus maximus", "hamstrings"],
        "secondary": ["quadriceps", "lats", "trapezius", "forearms"],
        "rom": "Bar from floor to full hip/knee lockout, traveling vertically over mid-foot.",
        "execution": [
            "Bar over mid-foot, shins ~an inch away; grip just outside knees.",
            "Hips back, flat neutral spine, shoulders slightly ahead of the bar, lats tight.",
            "Push the floor away and drive hips forward; bar drags up the legs to a tall lockout.",
            "Lower under control by hinging the hips back, then bending the knees.",
        ],
        "cues": ["Flat back — brace the whole spine", "Take the slack out before you pull", "Push the floor, don't yank", "Squeeze glutes at the top"],
        "mistakes": ["Rounding the lower back", "Bar drifting away from the shins", "Hips shooting up first (stiff-legging it)", "Hyperextending/leaning back at lockout"],
        "tempo": "Controlled pull · controlled lower (~2s)",
    },
    "romanian_deadlift": {
        "name": "Romanian Deadlift (RDL)", "group": "legs", "mechanic": "compound", "force": "hinge",
        "equipment": "barbell", "level": "intermediate",
        "primary": ["hamstrings", "gluteus maximus"], "secondary": ["erector spinae", "lats"],
        "rom": "Hinge until you feel a deep hamstring stretch (~mid-shin), back flat throughout.",
        "execution": [
            "Stand tall holding the bar, soft knees, bar against the thighs.",
            "Push hips straight back, sliding the bar down the legs, flat back.",
            "Stop at a strong hamstring stretch, then drive hips forward to stand.",
        ],
        "cues": ["Hips back, not down", "Bar stays close to the legs", "Feel the hamstring stretch — don't chase the floor"],
        "mistakes": ["Turning it into a squat (knees bending too much)", "Rounding the back", "Bar drifting forward"],
        "tempo": "3s eccentric · drive up",
    },
    "barbell_bench_press": {
        "name": "Barbell Bench Press", "group": "chest", "mechanic": "compound", "force": "push",
        "equipment": "barbell", "level": "intermediate",
        "primary": ["pectoralis major"], "secondary": ["anterior deltoid", "triceps"],
        "rom": "Bar from full lockout to a light touch on the lower chest/sternum.",
        "execution": [
            "Shoulder blades retracted and down, slight arch, feet planted.",
            "Grip ~1.5x shoulder width; unrack over the shoulders.",
            "Lower the bar with control to the lower chest, elbows ~45-75° from the torso.",
            "Press up and slightly back to lockout over the shoulders.",
        ],
        "cues": ["Retract and pin the shoulder blades", "Elbows tucked ~45-75°, not flared to 90°", "Touch the lower chest", "Leg drive into the floor"],
        "mistakes": ["Flaring elbows to 90° (shoulder strain)", "Bouncing off the chest", "Hips rising off the bench", "Half-repping (not touching)"],
        "tempo": "2s down · 1s press",
    },
    "incline_barbell_press": {
        "name": "Incline Barbell Press", "group": "chest", "mechanic": "compound", "force": "push",
        "equipment": "barbell", "level": "intermediate",
        "primary": ["pectoralis major (clavicular/upper)"], "secondary": ["anterior deltoid", "triceps"],
        "rom": "Bar to the upper chest/collarbone, full lockout above.",
        "execution": [
            "Bench at 30-45°; shoulder blades retracted.",
            "Lower the bar to the upper chest just below the collarbone.",
            "Press to lockout over the shoulders.",
        ],
        "cues": ["Keep the incline ~30-45° (steeper = more front delt)", "Touch high on the chest", "Shoulders pinned back"],
        "mistakes": ["Incline too steep (becomes a shoulder press)", "Flaring elbows", "Lowering to the lower chest"],
        "tempo": "2s down · 1s press",
    },
    "overhead_press": {
        "name": "Standing Overhead Press", "group": "shoulders", "mechanic": "compound", "force": "push",
        "equipment": "barbell", "level": "intermediate",
        "primary": ["anterior deltoid"], "secondary": ["lateral deltoid", "triceps", "upper trapezius", "core"],
        "rom": "Bar from the front delts/clavicle to full overhead lockout, biceps by the ears.",
        "execution": [
            "Bar on the front delts, grip just outside shoulders, elbows slightly in front.",
            "Brace hard, squeeze glutes; press the bar straight up, moving the head back slightly to clear it.",
            "Lock out with the bar over the mid-foot, shrug the traps up at the top.",
            "Lower under control back to the clavicle.",
        ],
        "cues": ["Squeeze glutes — don't lean back", "Bar path straight up, head 'through the window' at the top", "Full lockout, traps shrugged"],
        "mistakes": ["Excessive layback (turning it into an incline press)", "Pressing around the face instead of moving the head back", "Not locking out overhead"],
        "tempo": "1s press · 2s lower",
    },
    "barbell_row": {
        "name": "Bent-Over Barbell Row", "group": "back", "mechanic": "compound", "force": "pull",
        "equipment": "barbell", "level": "intermediate",
        "primary": ["lats", "rhomboids", "mid-trapezius"],
        "secondary": ["posterior deltoid", "biceps", "erector spinae"],
        "rom": "Bar from arms-extended to a touch on the lower ribs/upper abdomen; full scapular retraction.",
        "execution": [
            "Hinge to ~45° (or flatter), flat back, soft knees, bar hanging from the shoulders.",
            "Pull the bar to the lower chest/belly by driving the elbows back and squeezing the shoulder blades.",
            "Lower under control to a full stretch.",
        ],
        "cues": ["Lead with the elbows", "Squeeze the shoulder blades together", "Keep the torso angle fixed — no jerking up"],
        "mistakes": ["Using momentum / standing up into it", "Rounding the back", "Short ROM (not retracting)"],
        "tempo": "1s pull · 2s lower",
    },
    "pull_up": {
        "name": "Pull-Up", "group": "back", "mechanic": "compound", "force": "pull",
        "equipment": "bodyweight", "level": "intermediate",
        "primary": ["lats"], "secondary": ["biceps", "rhomboids", "mid-trapezius", "rear deltoid"],
        "rom": "Dead hang to chin clearly over the bar.",
        "execution": [
            "Hang from a shoulder-width-plus overhand grip, shoulders engaged (not fully passive).",
            "Pull the elbows down and back, driving the chest to the bar; chin over the bar.",
            "Lower all the way to a controlled dead hang.",
        ],
        "cues": ["Start by depressing the shoulder blades", "Drive elbows to the floor", "Chest up to the bar", "Full hang each rep"],
        "mistakes": ["Kipping/swinging", "Half-range (chin not over)", "Not reaching a full hang"],
        "tempo": "1s up · 2s down",
    },
    "lat_pulldown": {
        "name": "Lat Pulldown", "group": "back", "mechanic": "compound", "force": "pull",
        "equipment": "cable", "level": "beginner",
        "primary": ["lats"], "secondary": ["biceps", "rhomboids", "rear deltoid"],
        "rom": "Bar to the upper chest with full lat contraction; controlled return to full stretch.",
        "execution": [
            "Grip just outside shoulder width, thighs under the pad, slight back lean.",
            "Pull the bar to the upper chest, driving elbows down and back.",
            "Return under control to a full overhead stretch.",
        ],
        "cues": ["Depress the shoulders first", "Elbows down to the ribs", "Don't lean back excessively"],
        "mistakes": ["Heaving with the whole body", "Pulling behind the neck", "Short range at the top"],
        "tempo": "1s pull · 2s return",
    },
    "barbell_curl": {
        "name": "Barbell Biceps Curl", "group": "arms", "mechanic": "isolation", "force": "pull",
        "equipment": "barbell", "level": "beginner",
        "primary": ["biceps brachii"], "secondary": ["brachialis", "brachioradialis"],
        "rom": "Full elbow flexion (peak squeeze) to full extension at the bottom.",
        "execution": [
            "Stand tall, upper arms pinned at the sides, shoulder-width grip.",
            "Curl the bar up by flexing the elbows only; squeeze at the top.",
            "Lower under control to full extension.",
        ],
        "cues": ["Pin the elbows — no swinging the upper arm", "Squeeze hard at the top", "Full stretch at the bottom"],
        "mistakes": ["Swinging / using the back", "Elbows drifting forward", "Half-reps (cutting the stretch)"],
        "tempo": "1s up · 2s down",
    },
    "incline_dumbbell_curl": {
        "name": "Incline Dumbbell Curl", "group": "arms", "mechanic": "isolation", "force": "pull",
        "equipment": "dumbbell", "level": "beginner",
        "primary": ["biceps brachii (long head)"], "secondary": ["brachialis"],
        "rom": "Deep stretch with arms hanging back, full flexion at the top.",
        "execution": [
            "Sit on a ~60° incline, arms hanging straight down behind the torso.",
            "Curl with the upper arm fixed; squeeze, then lower to the deep stretch.",
        ],
        "cues": ["Let the arms hang back for the stretch", "Don't let the elbows swing forward", "Control the negative"],
        "mistakes": ["Shrugging the shoulders up", "Cutting the stretch short"],
        "tempo": "1s up · 3s down",
    },
    "triceps_pushdown": {
        "name": "Cable Triceps Pushdown", "group": "arms", "mechanic": "isolation", "force": "push",
        "equipment": "cable", "level": "beginner",
        "primary": ["triceps brachii"], "secondary": [],
        "rom": "Full elbow extension (lockout) to ~90° at the top.",
        "execution": [
            "Elbows pinned at the sides, slight forward lean.",
            "Extend the elbows fully, squeezing the triceps; return to ~90° under control.",
        ],
        "cues": ["Elbows glued to the sides", "Full lockout, squeeze", "Only the forearms move"],
        "mistakes": ["Elbows flaring out/forward", "Leaning in to push with the body", "Short ROM"],
        "tempo": "1s down · 2s up",
    },
    "lying_triceps_extension": {
        "name": "Lying Triceps Extension (Skull Crusher)", "group": "arms", "mechanic": "isolation", "force": "push",
        "equipment": "barbell", "level": "intermediate",
        "primary": ["triceps brachii (long head)"], "secondary": [],
        "rom": "Deep stretch (bar to forehead/behind head) to full lockout.",
        "execution": [
            "Lie back, press the bar up; upper arms angled slightly back.",
            "Bend only the elbows to lower the bar toward the forehead/behind the head.",
            "Extend to lockout, keeping the upper arms still.",
        ],
        "cues": ["Upper arms stay fixed", "Lower behind the head for a bigger stretch", "Control the descent"],
        "mistakes": ["Upper arms swinging (turning it into a press)", "Flaring the elbows"],
        "tempo": "2s down · 1s up",
    },
    "dumbbell_lateral_raise": {
        "name": "Dumbbell Lateral Raise", "group": "shoulders", "mechanic": "isolation", "force": "push",
        "equipment": "dumbbell", "level": "beginner",
        "primary": ["lateral deltoid"], "secondary": ["upper trapezius"],
        "rom": "Arms from the sides up to shoulder height (slightly above), controlled descent.",
        "execution": [
            "Stand tall, slight elbow bend, dumbbells at the sides.",
            "Raise out to the sides to shoulder height, leading with the elbows, pinkies slightly up.",
            "Lower slowly under control.",
        ],
        "cues": ["Lead with the elbows", "Don't shrug — keep the traps down", "Control the negative (no dropping)"],
        "mistakes": ["Using momentum / swinging", "Going way above shoulder height into the traps", "Too heavy → cheating"],
        "tempo": "1s up · 2s down",
    },
    "face_pull": {
        "name": "Cable Face Pull", "group": "shoulders", "mechanic": "compound", "force": "pull",
        "equipment": "cable", "level": "beginner",
        "primary": ["posterior deltoid", "rhomboids", "mid-trapezius"], "secondary": ["external rotators"],
        "rom": "Rope from arms-extended to the hands beside the ears, elbows high.",
        "execution": [
            "Rope at face height; pull toward the face, splitting the rope, elbows high and wide.",
            "Externally rotate at the end (knuckles back), squeeze; return under control.",
        ],
        "cues": ["Elbows high", "Pull to the forehead, hands past the ears", "Squeeze the rear delts/upper back"],
        "mistakes": ["Pulling low to the chest", "Using too much weight (turns into a row)"],
        "tempo": "1s pull · 2s return",
    },
    "leg_press": {
        "name": "Leg Press", "group": "legs", "mechanic": "compound", "force": "push",
        "equipment": "machine", "level": "beginner",
        "primary": ["quadriceps", "gluteus maximus"], "secondary": ["hamstrings", "adductors"],
        "rom": "Knees toward the chest to ~90° or deeper (low back stays on the pad), then near-lockout.",
        "execution": [
            "Feet shoulder-width on the platform, back and hips flat against the pad.",
            "Lower the platform under control until the knees approach the chest (keep the low back down).",
            "Press through the mid-foot to near-lockout — don't slam the knees straight.",
        ],
        "cues": ["Keep the lower back glued to the pad", "Knees track over toes", "Don't fully lock the knees hard"],
        "mistakes": ["Lowering so far the hips/low-back round off the pad", "Knees caving in", "Bouncing at the bottom"],
        "tempo": "2s down · 1s up",
    },
    "leg_extension": {
        "name": "Leg Extension", "group": "legs", "mechanic": "isolation", "force": "push",
        "equipment": "machine", "level": "beginner",
        "primary": ["quadriceps"], "secondary": [],
        "rom": "Full knee extension (squeeze) to a deep bend, controlled.",
        "execution": [
            "Align the knee with the machine pivot, pad on the lower shin.",
            "Extend to full lockout and squeeze the quads; lower slowly.",
        ],
        "cues": ["Squeeze at the top", "Control the negative", "Point toes slightly to bias different quad heads"],
        "mistakes": ["Swinging the weight up", "Half-reps", "Banging the stack on the negative"],
        "tempo": "1s up · 2s down",
    },
    "lying_leg_curl": {
        "name": "Lying Leg Curl", "group": "legs", "mechanic": "isolation", "force": "pull",
        "equipment": "machine", "level": "beginner",
        "primary": ["hamstrings"], "secondary": ["calves"],
        "rom": "Full knee flexion (heels to glutes) to a controlled stretch.",
        "execution": [
            "Pad just above the heels, hips pressed into the bench.",
            "Curl the heels toward the glutes, squeeze; lower under control.",
        ],
        "cues": ["Keep the hips down", "Squeeze the hamstrings at the top", "Slow the negative"],
        "mistakes": ["Hips lifting off the pad", "Using momentum", "Partial range"],
        "tempo": "1s up · 2s down",
    },
    "standing_calf_raise": {
        "name": "Standing Calf Raise", "group": "legs", "mechanic": "isolation", "force": "push",
        "equipment": "machine", "level": "beginner",
        "primary": ["gastrocnemius"], "secondary": ["soleus"],
        "rom": "Full stretch at the bottom (heels below the platform) to a full contraction on the toes.",
        "execution": [
            "Balls of the feet on the platform, legs straight.",
            "Drop the heels for a deep stretch, then rise as high as possible onto the toes; pause.",
        ],
        "cues": ["Full stretch then full squeeze", "Pause at the top", "Don't bounce"],
        "mistakes": ["Short, bouncy reps", "Bending the knees (shifts to soleus)"],
        "tempo": "1s up · pause · 2s down",
    },
    "cable_fly": {
        "name": "Cable Chest Fly", "group": "chest", "mechanic": "isolation", "force": "push",
        "equipment": "cable", "level": "beginner",
        "primary": ["pectoralis major"], "secondary": ["anterior deltoid"],
        "rom": "Deep stretch with arms wide to a squeeze with the hands meeting in front.",
        "execution": [
            "Slight forward lean, soft elbow bend held constant.",
            "Open the arms to a deep chest stretch, then bring the hands together in front, squeezing the chest.",
        ],
        "cues": ["Fixed elbow angle (it's a fly, not a press)", "Hug the movement", "Squeeze the chest at the midline"],
        "mistakes": ["Bending the elbows (turning it into a press)", "Going too heavy and losing the stretch"],
        "tempo": "2s open · 1s squeeze",
    },
    "hanging_leg_raise": {
        "name": "Hanging Leg Raise", "group": "core", "mechanic": "compound", "force": "static",
        "equipment": "bodyweight", "level": "intermediate",
        "primary": ["rectus abdominis", "hip flexors"], "secondary": ["obliques", "forearms"],
        "rom": "Legs from a hang up to hips/legs at (or above) parallel, posterior pelvic tilt.",
        "execution": [
            "Hang from a bar; brace the core.",
            "Raise the legs by curling the pelvis up (not just the hips), to parallel or higher.",
            "Lower under control without swinging.",
        ],
        "cues": ["Curl the pelvis — don't just lift the legs", "No swinging", "Control the lower"],
        "mistakes": ["Swinging/kipping", "Only using the hip flexors (no pelvic curl)"],
        "tempo": "Controlled both ways",
    },
    "plank": {
        "name": "Plank", "group": "core", "mechanic": "isolation", "force": "static",
        "equipment": "bodyweight", "level": "beginner",
        "primary": ["rectus abdominis", "transverse abdominis"], "secondary": ["obliques", "glutes"],
        "rom": "Isometric hold — straight line from head to heels.",
        "execution": [
            "Forearms under the shoulders, body in a straight line.",
            "Brace the abs, squeeze the glutes, tuck the pelvis slightly; hold.",
        ],
        "cues": ["Straight line — no sagging hips", "Brace abs + squeeze glutes", "Breathe"],
        "mistakes": ["Hips sagging or piking up", "Holding the breath", "Neck craning up"],
        "tempo": "Hold for time",
    },
    "barbell_hip_thrust": {
        "name": "Barbell Hip Thrust", "group": "legs", "mechanic": "compound", "force": "hinge",
        "equipment": "barbell", "level": "intermediate",
        "primary": ["gluteus maximus"], "secondary": ["hamstrings", "quadriceps"],
        "rom": "Hips from below to full extension (torso parallel to floor), ribs down.",
        "execution": [
            "Upper back on a bench, bar across the hips (use a pad).",
            "Drive through the heels to full hip extension; squeeze the glutes hard at the top, chin tucked.",
            "Lower under control.",
        ],
        "cues": ["Drive through the heels", "Squeeze the glutes at the top", "Ribs down — don't hyperextend the back", "Chin tucked"],
        "mistakes": ["Overarching the lower back at the top", "Pushing through the toes", "Short ROM"],
        "tempo": "1s up · pause · 2s down",
    },
}

_VALID_GROUPS = {"chest", "back", "shoulders", "arms", "legs", "core"}


def list_exercises(group: str | None = None) -> list[dict]:
    """All exercises (id + summary fields), optionally filtered by muscle group."""
    out = []
    for eid, e in EXERCISES.items():
        if group and e["group"] != group:
            continue
        out.append({
            "id": eid, "name": e["name"], "group": e["group"],
            "mechanic": e["mechanic"], "force": e["force"], "equipment": e["equipment"],
            "level": e["level"], "primary": e["primary"],
        })
    return sorted(out, key=lambda x: (x["group"], x["name"]))


def get_exercise(exercise_id: str) -> dict | None:
    """Full form detail for one exercise, or None."""
    e = EXERCISES.get(exercise_id)
    if not e:
        return None
    return {"id": exercise_id, **e}


def groups() -> list[str]:
    """The muscle groups present, in a sensible training order."""
    order = ["chest", "back", "shoulders", "arms", "legs", "core"]
    present = {e["group"] for e in EXERCISES.values()}
    return [g for g in order if g in present]


def search(term: str) -> list[dict]:
    """Find exercises by name/muscle/equipment substring."""
    t = (term or "").strip().lower()
    if not t:
        return []
    hits = []
    for eid, e in EXERCISES.items():
        hay = " ".join([e["name"], e["group"], e["equipment"],
                        " ".join(e["primary"]), " ".join(e.get("secondary", []))]).lower()
        if t in hay or t in eid:
            hits.append({"id": eid, "name": e["name"], "group": e["group"], "primary": e["primary"]})
    return hits
