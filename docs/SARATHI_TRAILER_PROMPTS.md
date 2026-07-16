# SARATHI — "The Five Trials" · OpenArt Director prompt kit
### Calibrated to the live project (3 scenes, saved warrior character + void location, Guide-me mode)

## Why version_0 failed (tool-level root cause)
Director mapped the 3-act script into **3 long clips (10–12s)** — SHOT 2.1 alone had to carry fire, water, AND earth, so strikes blurred, centres misaligned, and nothing synced. Research + the Seedance handbook agree: **one action per clip, ≤10s, one element strike per shot.**

## The restructure (uses the existing project — don't start over)
Keep the 3 scenes. Add shots so each element strike owns a clip:

- **Scene 1 (The Void):** 1.1 lack · 1.2 SPACE trial · 1.3 AIR trial
- **Scene 2 (The Rising):** 2.1 FIRE trial · 2.2 WATER trial · 2.3 EARTH trial
- **Scene 3 (The Blaze):** 3.1 pack + five-strike · 3.2 elevation pull-back · 3.3 title background

## Golden rules for every generation (from the research playbook)
1. **Tag the saved warrior character and void location on every shot** — the character asset beats any text description; keep both in the prompt anyway.
2. **Guide-me gates:** approve the storyboard IMAGE of each shot before rendering video — images are cheap, video is not.
3. One camera move + one action per prompt. Start state → end state.
4. Keep clips 5–6s. Trim in Timeline.
5. Text-in-video never: the SARATHI title goes on the **Caption track** over shot 3.3.
6. Negatives inline as "no X" phrasing (Director hides which model runs a shot).

## Locked strings (paste into every shot)
- **CHARACTER:** `the saved warrior character — rugged man, dark curly hair, short beard, intricately engraved dark armor, deep-red hooded cloak`
- **WORLD:** `endless black wet salt-flat reflecting the sky, starless dark void, thin ground mist`
- **TAIL:** `continuous single take, no cuts, no morphing, no text, no daylight, no trees, cinematic, high definition`

## Chat opener to Ori (paste first)
> Restructure this project, keep my saved warrior character and void location on every shot. Same story, but every elemental strike gets its OWN shot: Scene 1 gets three shots (the lack, the space trial, the air trial), Scene 2 gets three (fire, water, earth trials), Scene 3 gets three (the five-strike, the elevation pull-back, a title background with no text). Each shot 5–6 seconds, 16:9, 1080p. Show me the storyboard image for every shot for approval BEFORE generating any video. Voiceover: deep, calm, mythic male voice, four lines only — I'll give placement after the storyboard. Music: one continuous track that starts as a single slow heartbeat with a low drone and adds one instrument per shot — hand drums from shot 2.1, massed male chant from 2.3, a conch blast at 3.1's impact, back to a single strong heartbeat under the title. Hard silence for one second right before each elemental strike lands.

## The nine shot prompts

**1.1 — THE LACK (5s)**
> Slow dolly push-in from wide to medium. CHARACTER stands alone, head bowed, eyes closed, shoulders sunken, armor dulled and colorless, grey ash drifting upward off his body into the dark. WORLD, a broken chariot wheel half-buried in the distance. Cold grey light from nowhere, his reflection sharp in the wet ground. Somber, emptied, mythic. TAIL.

**1.2 — SPACE TRIAL (6s)**
> Low-angle crane shot rising with the action. The dark sky tears open into a deep violet nebula; a colossal serpent made of stars and constellations coils down and strikes the crown of CHARACTER's head — he staggers, then his eyes snap open flooded with violet starlight, a glowing constellation crown forming above his head. WORLD reflecting the nebula so he stands between two skies. Violet rim light, cosmic scale, awe. TAIL, no snake body touching the ground.

**1.3 — AIR TRIAL (5s)**
> Static wide shot, waist-up. An invisible force of wind visible only as silver-cyan ribbons whips around CHARACTER mid-collapse — the gust snaps his bent knee straight and pulls his spine upright like a master correcting a student, his deep-red cloak cracking taut behind him, then perfect stillness. WORLD, mist ripped into long horizontal streaks, rings shivering in the ground-water around his boots. Cold cyan accents on grey. Disciplined, sudden, precise. TAIL.

**2.1 — FIRE TRIAL (5s)**
> Head-on medium shot, camera locked. A massive bull made of controlled sacred flame charges from the dark horizon straight through CHARACTER's chest — he does not flinch; as it passes, fine glowing gold veins ignite under the skin of his forearms and his grip tightens on his axe, embers raining around him. WORLD, hoof-prints burning like small lotus flames on the wet ground. Ember-orange glow against blackness. Ferocious, sacred. TAIL, no burning of the cloak, flame stays gold-orange.

**2.2 — WATER TRIAL (6s)**
> Medium shot, slight slow push-in. A rearing tidal wave shaped like a horse with a foaming mane crashes fully over CHARACTER — one held beat of him underwater in teal light shafts, grey cracks across his armor sealing shut with glowing teal — then he surfaces standing as the water calms to glass beneath his boots, a thin gold dawn-line on the horizon. WORLD becomes an infinite dark ocean. Deep teal, then first warm light. Baptismal, restorative. TAIL.

**2.3 — EARTH TRIAL (6s)**
> Wide shot, slow orbit left. A colossal stone giant with CHARACTER's own face rises out of the cracked ground behind him; they lock eyes; the giant kneels, then collapses into a storm of golden dust that packs onto CHARACTER's shoulders, chest and stance, visibly building mass and presence. WORLD, a mountain range assembling itself on the horizon, dust columns like temple pillars. Earthen gold on black. Monumental, reverent. TAIL, the giant's armor identical to his.

**3.1 — THE FIVE-STRIKE (6s)**
> Slow 180-degree orbit that stops dead for the impact. Five lights — violet, silver-cyan, ember-gold, teal, earth-gold — circle CHARACTER like a hunting pack, then strike his crown, spine, chest, heart and feet in one simultaneous chord; a golden aura ignites across his whole body and an ornate golden mandala halo blooms behind him like a turning chariot wheel. WORLD with nebula sky, ember rain, glass water and risen mountains layered together. Blinding warm gold on black. Apotheosis. TAIL, mandala stays behind him, five distinct light colors.

**3.2 — ELEVATION (5s)**
> Low-angle tilt rising from his boots to his blazing eyes, then a fast pull-back to an immense cosmic wide. CHARACTER stands fully awakened, five centres glowing, cloak thundering in the shockwave wind, the golden mandala turning slowly behind him, his tiny blazing figure against the entire assembled world. Full golden blaze against the void. Triumphant, colossal. TAIL.

**3.3 — TITLE BACKGROUND (4s)**
> Static shot. The golden blaze compresses into a single ember point floating on pure black, pulsing faintly like a heartbeat, one thin wisp of smoke. No figure, no text, black background only. Quiet, final. TAIL.
> *(Then: SARATHI + "Own your health. Level up." on the Caption track — never generated.)*

## Voiceover placement (4 lines, after storyboard approval)
- 1.1 → "Every body is a battlefield."
- 1.2 (on the eye-open) → "The sky remembered him."
- 2.3 (as the giant kneels) → "Five powers. One body."
- 3.3 → "Own your health. Level up."

## Assembly notes (Timeline)
Cut every shot ON its strike impact; the 1s pre-strike silences make impacts land. Total ≈ 48s full cut; for a 33s cut trim 1.1→4s, 1.2→4s, drop 3.2's cosmic wide tail, title→3.5s.
