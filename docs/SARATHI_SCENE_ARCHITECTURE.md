# सारथि — SCENE ARCHITECTURE v1 · The Film Bible
*Cula-grade, scene-by-scene. Pipeline: **KREA (photoreal frames) → SEEDANCE 2.0 on Higgsfield
(motion) → the Sarathi 3D scroll engine (already built: pinned card · traveling camera ·
element collection · orbs/mandala/dust).* Every scene below specifies: the narrative, the exact
screen, the camera, the interaction, the KREA frame prompts, and the SEEDANCE brief.*

---

## 0 · THE PIPELINE (who makes what)
1. **KREA (you):** generate the new photoreal master + per-scene START and END frames.
   Same man in every frame (use Krea's image-reference with the master). Real skin, film light.
2. **HIGGSFIELD · Seedance 2.0 (you):** animate each scene — start-frame (+ end-frame where
   given) + the motion prompt below. 5–8s, 1080p, 16:9 **and** 9:16. Scenes 1 & 7 loop.
3. **ME (engine, built):** each video becomes a **texture on the 3D billboard** inside the live
   three.js scene — the traveling camera, mandala rings, element orbs, dust, pinned card and
   the element-collection chips all continue to run around the footage. Videos carry NO text —
   all words live in the card.
> Current visuals are placeholders; they get replaced the moment each Krea/Seedance asset lands
> (we don't delete before replacement or the site goes dark — we swap scene by scene).

## 0.1 · THE GRAMMAR (Cula's laws, ours now)
- **One continuous world.** No cuts between scenes: each scene's END frame ≈ the next scene's
  START framing (match position/light), so scroll = one unbroken shot.
- **One pinned card** holds every word; titles swap in place; gathered elements accumulate as
  glowing chips inside it.
- **Camera = the storyteller.** Every scene is a camera move down the body (head → breath →
  belly → heart → legs → whole), scrubbed by scroll — backward scroll plays it backward.
- **Interaction = presence.** In every scene the cursor does something element-true (spec per
  scene below), the orbs are clickable (jump to their chapter), the chips are clickable too.

## 0.2 · THE CHARACTER LOCK (Krea master, generate FIRST)
**KREA master prompt** (then reuse as image-reference for every other frame):
> Cinematic photorealistic full-body portrait of a divine charioteer-guardian standing in an
> endless black void: a heroic athletic Indian man, early thirties, warm brown skin with real
> pores, dark wavy hair, short beard, calm powerful benevolent expression. Matte obsidian-black
> plate armor — deep black, never blue — laced with molten-gold filigree; gold chariot-wheel
> emblems on the shoulder guards and belt; a glowing teal circular core embedded in the center
> of his chest; a perfect circular ring of golden flame behind his head; a long dark
> gold-trimmed cape. Volumetric god-rays, fine gold embers, deep black background, shallow
> depth of field, 85mm cinema lens, film grain. Not anime, not CGI-doll, not a videogame render.
- Also generate: **3/4 view · side · back · chest closeup · face closeup · open-hand gesture**
  (all "same character, same armor, same lighting" + reference image).

---

# THE SEVEN SCENES

## SCENE 1 — THE GATE · "You are the chariot." (loops)
**Narrative.** Darkness. A single ember falls upward. Then — a breath of gold light — the
charioteer stands revealed, monumental and calm, the flame-ring igniting behind his head. He is
not looking *past* you; he is waiting *for* you.
**Screen.** Full-body hero shot dead-center in a black void. The flame halo ignites from a thin
gold thread into a full burning ring (2s). Embers rise around him; god-rays breathe from above;
the teal chest-core pulses once every 4s like a resting heartbeat. Cape hem drifts as if in slow
wind. **Web layer:** the 3D mandala rings align with the filmed halo; five dim orbs orbit far;
card shows the invocation + "the five elements await"; SCROLL TO BEGIN hint.
**Camera.** Locked, then an almost imperceptible push-in (3%) — Villeneuve stillness.
**Interaction.** Mouse = window-parallax (built). Hovering the charioteer makes the halo lean
toward the cursor by a few degrees (web layer, subtle).
**KREA start-frame:** the master itself.
**SEEDANCE 2.0 brief:** *"The armored divine guardian stands perfectly still in a black void,
breathing slowly. The circular ring of golden flame behind his head ignites from a thin thread
of light into a full burning ring, casting warm light on his armor. Fine gold embers drift
upward, his long dark cape sways gently, the teal core in his chest pulses softly. Volumetric
god-rays. Slow, reverent, monumental — almost no camera movement, seamless loop, no cuts."*
6s · perfect loop · 16:9 + 9:16.

## SCENE 2 — AKASHA · space · the mind · "Space remembers."
**Narrative.** The camera rises to his face — and the void behind him is not empty: it is a
library of stars. Every point of light is a day of your life, remembered.
**Screen.** Head-and-shoulders hero shot. Behind the halo, the darkness resolves into a slow
starfield; faint golden glyphs (Devanagari fragments) orbit the flame-ring like satellites; his
eyes track slowly, aware. Violet-white light breathes at the edges. **Web layer:** star-motes
canvas + violet ambient tint; the आकाश orb glides in and lights; chip #1 ignites in the card.
**Camera.** Slow rise from chest to face (scroll-scrubbed), settling at eye level.
**Interaction.** The orbiting glyphs are cursor-magnetic — they drift toward the pointer like
memories surfacing; click the आकाश orb → card shows a one-line "memory" ("Tue — squat 5×5,
felt strong").
**KREA start-frame:** "same character, cinematic head-and-shoulders portrait, gold flame halo,
deep black background scattered with faint stars, violet-white rim light."
**SEEDANCE brief:** *"Slow cinematic rise to a head-and-shoulders shot of the armored guardian.
Behind his flame halo the darkness fills with a drifting starfield; faint glowing golden script
fragments orbit the halo like satellites of memory. His eyes track slowly, calm and aware.
Violet-white light breathes. Sacred, intelligent, quiet."* 6s.

## SCENE 3 — VAYU · air · the breath · "Air moves you."
**Narrative.** He inhales — and you SEE the breath: silver currents spiral into his chest,
travel his arms, and his hand rises through the wind in one perfect, deliberate motion.
**Screen.** Waist-up. Visible ribbons of silver-cyan air flow around his torso and arms; as his
hand rises, luminous cyan trace-lines follow his joints — divine motion-capture, elbow and
wrist glowing as nodes. Cape and hair respond to the wind. **Web layer:** air-streak canvas;
cyan tint; वायु orb lights; chip #2 ignites.
**Camera.** Slow lateral arc (15°) around him as the arm rises — the move itself feels like wind.
**Interaction.** The cursor becomes wind: moving it bends the on-screen air-streaks around a
soft vortex at the pointer; quick mouse flicks shed small cyan eddies.
**KREA start-frame:** "same character, waist-up, one hand beginning to rise, ribbons of glowing
silver-cyan wind curling around his arms and chest, black void."
**SEEDANCE brief:** *"The armored guardian inhales; visible ribbons of silver-cyan wind spiral
into his chest and along his arms. He raises one hand in a slow deliberate guiding motion; thin
glowing cyan lines trace his shoulder, elbow and wrist like sacred motion-capture. His cape and
hair move in the wind. Slow lateral camera arc. Fluid, powerful, precise."* 6s.

## SCENE 4 — AGNI · fire · the furnace · "Fire transforms you."
**Narrative.** The camera sinks to his core. Under the black-and-gold plates, something glows —
the furnace the Gita named Vaiśvānara. The filigree veins catch fire like poured metal.
**Screen.** Tight on the torso, belt-to-chest. The gold filigree lines over the abdomen ignite
one vein at a time — molten light crawling the engravings like a circuit of lava; heat-shimmer
rises; ember bursts punctuate; the chariot-wheel buckle glows to amber. **Web layer:** ember
canvas intensifies; fire tint; अग्नि orb lights; chip #3.
**Camera.** Slow dolly-down + slight push-in to the core; ends framing the glowing buckle.
**Interaction.** Embers are cursor-shy — they curl away from the pointer like a real flame
disturbed; holding the cursor still over the core makes the furnace glow swell (readiness to
"feed the fire").
**KREA start-frame:** "same character, tight shot of the armored torso from belt to chest, the
gold filigree over the abdomen beginning to glow molten orange from within, heat shimmer, black
void."
**SEEDANCE brief:** *"Tight cinematic shot of the guardian's armored torso. The molten-gold
filigree engraved across the abdomen ignites vein by vein, glowing like poured metal; heat
shimmer rises; small ember bursts drift upward; the gold chariot-wheel belt buckle glows amber.
Slow downward dolly with a gentle push-in. Powerful, transformative, controlled fire."* 6s.

## SCENE 5 — APAS · water · the tides ★ THE CENTERPIECE · "Water restores you."
**Narrative.** The heart. The armor does the impossible: it OPENS. Plates unlock along their
gold seams and bloom outward in concentric rings — a mandala unfolding — and inside is not
machinery but a molten-gold heart, beating, with the teal core shining at its center like a
pearl under the sea. Tide-rings of light ripple outward with every beat.
**Screen.** Chest-centered. Sequence: (1) seams ignite teal-gold; (2) plates rotate open in
three concentric rings, petals of black armor edged in gold; (3) the heart revealed — molten
gold, translucent, alive; (4) teal ripple-rings radiate on each heartbeat; light catches his
chin above. **Web layer:** ripple canvas + the heartbeat core bloom sync; आपस् orb lights;
chip #4; the card holds slightly longer here (scene weight 1.3×).
**Camera.** Reverent dolly-in from mid-torso to the open heart — the slowest move on the site.
**Interaction.** Clicking anywhere sends a ripple through the scene from the click point toward
the heart; the heartbeat rate subtly syncs to scroll speed (scroll gently → calm 52bpm; stop →
it settles — teaching "rest" through the body of the page).
**KREA frames:** START = "same character, chest-centered, armor sealed, teal core glowing
through the seams." END = "the chest armor open in three concentric mandala rings of black-gold
petals, revealing a molten-gold anatomical heart with a bright teal core, teal light rippling."
**SEEDANCE brief (use start+end frames):** *"Slow reverent dolly toward the guardian's chest.
The armor seams ignite with teal-gold light, then the chest plates unlock and rotate outward in
three concentric rings like a blooming mandala, revealing a radiant molten-gold anatomical
heart beating with living light, a glowing teal core at its center. Teal ripple-rings radiate
outward with each heartbeat; golden embers and god-rays. Sacred, awe-inspiring, unhurried.
Settle on the beating heart."* 8s.

## SCENE 6 — PRITHVI · earth · the foundation · "Earth is what you build."
**Narrative.** Down to the legs — the pillars. Dust hangs in the light like a temple at dawn.
He shifts his stance and PLANTS: the ground answers with a slow shockwave of golden dust, and
gold light climbs his greaves from the earth itself, as if strength were drawn up by roots.
**Screen.** Low hero angle, knees-to-ground dominant, his full silhouette towering above.
Falling bronze dust; on the stance-plant a radial dust-wave rolls out; gold light rises up the
leg filigree; faint cracks of light vein the ground. **Web layer:** dust canvas; bronze tint;
पृथ्वी orb lights; chip #5 — all five now burn in the card.
**Camera.** Low-angle rise: starts at the boots, climbs to reveal the full figure against the
halo — the "power ascension" move.
**Interaction.** The cursor gathers dust — motes settle into a faint line along the pointer's
recent path (you literally build ground by moving); a slow build-meter fills the card's rule.
**KREA start-frame:** "same character, dramatic low-angle from the ground, armored legs and
greaves dominant, bronze dust hanging in god-rays, full figure towering, black void."
**SEEDANCE brief:** *"Dramatic low-angle shot of the armored guardian. He shifts and plants his
stance; a slow radial wave of golden dust rolls across the ground; warm gold light climbs the
engravings of his greaves from the earth upward; bronze dust hangs in volumetric light. The
camera rises slowly from his boots to reveal the full towering figure. Monumental, grounded,
triumphant."* 6s.

## SCENE 7 — BALANCE · the invitation · "When the five align, you rise." (loops)
**Narrative.** Full figure again — but changed. The five lights you gathered come home: violet,
cyan, fire, teal, bronze orbs spiral in and align in a vertical column through his body — mind,
breath, fire, heart, ground. The halo flares to daylight-gold. He extends his open hand. To you.
**Screen.** Full-body, slightly wider than Scene 1 (growth). The five orbs converge (web layer
already does this in 3D — the film should show faint matching light-streams entering frame);
halo at maximum radiance; the open hand reaches toward camera, palm up; embers become a slow
golden snowfall. **Web layer:** align-mode orbs complete the column; ALL chips lit; the CTA
button rises in the card.
**Camera.** Gentle pull-back + settle; the hand toward lens gives natural depth.
**Interaction.** The extended hand is a живой CTA: hovering it makes the five column-lights
pulse in sequence and the card CTA glows; clicking the hand = clicking "Meet your Twin."
**KREA START:** master full-body. **END:** "same character, open hand extended toward camera,
halo at full radiance, five small lights (violet, cyan, orange, teal, bronze) aligned vertically
through his body."
**SEEDANCE brief (start+end):** *"The armored guardian stands full-body in a black void as five
small spheres of light — violet, cyan, orange, teal and bronze — spiral gently in and align in
a vertical column through his body. His golden flame halo flares to full radiance. He extends
an open hand toward the camera, palm up, calm and inviting. Golden embers fall like slow snow.
Hopeful, sacred, welcoming. Seamless loop."* 7s · loop.

---

## ASSET MANIFEST
| File | Source | Spec |
|---|---|---|
| `krea-master.png` + 6 angle/detail shots | Krea | photoreal, same character, 2:3 |
| `scene-1-gate.mp4` … `scene-7-balance.mp4` | Seedance 2.0 | 1080p, 16:9 **and** 9:16, 6–8s, no text, scenes 1&7 seamless loops, H.264 |
| Poster stills (first frame of each) | export from Krea/Seedance | webp ≤250KB |
| Budget | — | ≤1.5MB/clip after compression (I compress on intake) |

## ENGINE INTEGRATION (mine, per scene as it lands)
1. Swap the billboard texture to `VideoTexture(scene-N)`; scrub `video.currentTime` from the
   scene's local scroll progress p (reverse-safe) — or autoplay-loop for scenes 1/7.
2. Match my 3D layers to the footage (mandala aligned to the filmed halo; orbs handoff at
   Scene 7; heartbeat core sync in Scene 5).
3. Wire the per-scene interactions listed above (cursor-wind, ember-avoidance, click-ripples,
   dust-gathering, hand-hover CTA).
4. Compress, posters-first loading, reduced-motion → poster + card story.

## ORDER OF PRODUCTION (do it in this order)
1. **Krea master** (+ the 6 supporting shots) → send to me → I approve consistency.
2. **Scene 5 (the heart)** — the centerpiece sells everything.
3. Scene 1 (gate loop) → 7 (invitation loop) → 2 → 3 → 4 → 6.
Each scene goes live on the site the day it lands — the site upgrades scene by scene, never dark.
