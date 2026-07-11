// journeydata — the manifest for the SarathiJourney experience (#journey).
// Structure cloned from NRG "Build Your Data Center" (mechanics only, our brand):
// enter gate → ivory manifesto → 5 phase chapters (dark, scroll-driven stage,
// letter-fill titles, STEP callouts, labeled pins, completion flood, next-pill)
// interleaved with ivory PROOF sections (real product screens) → explorable
// finale hotspot map → tracker-morph CTA.
//
// IMAGE SLOTS: each phase wants two cinematic stills from Varun —
//   /journey/<id>-lack.jpg  (the warrior without the element — dim, hollow)
//   /journey/<id>-gift.jpg  (the element pouring its power into him)
// Until a file exists, the stage falls back to the master portrait with the
// phase's tint, so the route is reviewable today and hot-swappable later.

export const GOLD = '#f5b572';
export const IVORY = { bg: '#f2ecdf', bg2: '#e9e1cf', ink: '#211a10', ink2: '#5c5343', line: 'rgba(33,26,16,.14)' };

export const PHASES = [
  {
    id: 'akasha', n: 1, word: 'आकाश', name: 'Space', title: 'SPACE', accent: '#c5b3ff',
    summary: 'In Phase 1, the sky itself starts remembering — every workout, meal and heartbeat becomes a living record.',
    lackCap: 'He forgot every battle he had won.',
    giftCap: 'So the sky began remembering for him.',
    img: { lack: '/img/journey/akasha-lack.jpg', gift: '/img/journey/akasha-gift.jpg' },
    glow: { x: 50, y: 22 },
    steps: [
      { t: 'A mind full of noise remembers nothing — sessions unlogged, sleep unexamined.' },
      { t: 'Memory returns as a river of starlight: the map of everything he has ever done.' },
    ],
    pins: [
      { x: 58, y: 26, t: 'Health Vault · every record yours' },
      { x: 68, y: 44, t: 'Lifelong memory' },
      { x: 56, y: 60, t: 'Syncs Apple Health' },
    ],
    proof: {
      k: 'the proof · आकाश', title: 'Sarathi remembers yours.',
      body: 'Every workout, meal and heartbeat written into a Health Vault you own — plain files, exportable anytime. Hermes, your coach, speaks with your whole history behind it.',
      shot: '/img/journey/proof-vault.png', shotAlt: 'The real Sarathi Health Vault',
      chips: ['Health Vault', 'Hermes memory', 'Apple Health sync'],
    },
  },
  {
    id: 'vayu', n: 2, word: 'वायु', name: 'Air', title: 'AIR', accent: '#7fd4f0',
    summary: 'In Phase 2, the wind becomes his coach — every rep watched, counted and corrected while he moves.',
    lackCap: 'No one watched his form — and it failed him.',
    giftCap: 'Then the wind itself became his coach.',
    img: { lack: '/img/journey/vayu-lack.jpg', gift: '/img/journey/vayu-gift.jpg' },
    glow: { x: 50, y: 38 },
    steps: [
      { t: 'Reps done alone and unseen — no one counting, no one correcting.' },
      { t: 'The wind traces his spine and knees; his posture straightens as it aligns him.' },
    ],
    pins: [
      { x: 58, y: 24, t: 'Form Coach · live rep grading' },
      { x: 68, y: 42, t: 'On-device camera AI' },
      { x: 56, y: 58, t: '3D replay · every rep scored' },
    ],
    proof: {
      k: 'the proof · वायु', title: 'Every rep seen, counted, corrected.',
      body: 'Point your phone at yourself and train. The Form Coach reads your joints live — reps counted, depth graded, mistakes named — and coached sets grow your Twin.',
      shot: '/img/journey/proof-coach.png', shotAlt: 'The real Sarathi Form Coach',
      chips: ['14 coached lifts', 'Rep grading', 'Muscle auto-detect'],
    },
  },
  {
    id: 'agni', n: 3, word: 'अग्नि', name: 'Fire', title: 'FIRE', accent: '#ff9e5e',
    summary: 'In Phase 3, the fire is named — one line per meal, and the furnace he feeds finally reads back.',
    lackCap: 'He fed his fire blind — and it burned him.',
    giftCap: 'Named rightly, the same fire forged him.',
    img: { lack: '/img/journey/agni-lack.jpg', gift: '/img/journey/agni-gift.jpg' },
    glow: { x: 50, y: 56 },
    steps: [
      { t: 'Meals eaten without knowing what they build — the furnace fed, never read.' },
      { t: 'Golden offerings fall; the flame leaps controlled — fuel becomes strength.' },
    ],
    pins: [
      { x: 58, y: 26, t: 'One-line meal logging' },
      { x: 68, y: 44, t: 'Macros read instantly' },
      { x: 56, y: 60, t: 'Protein ritual · Twin drinks with you' },
    ],
    proof: {
      k: 'the proof · अग्नि', title: 'Say what you ate. Sarathi reads the fuel.',
      body: '"2 rotis, dal, curd" — that is the whole job. Macros, protein and timing appear instantly, and Hermes keeps the flame honest against your training.',
      shot: '/img/journey/proof-meal.png', shotAlt: 'The real Sarathi one-line meal log',
      chips: ['Natural-language logging', 'Instant macros', 'Protein tracking'],
    },
  },
  {
    id: 'apas', n: 4, word: 'आपस्', name: 'Water', title: 'WATER', accent: '#2ec4b6',
    summary: 'In Phase 4, the ocean returns what sleep has earned — recovery becomes one honest number each dawn.',
    lackCap: 'He trained on nights that gave nothing back.',
    giftCap: 'Until the ocean returned what sleep had earned.',
    img: { lack: '/img/journey/apas-lack.jpg', gift: '/img/journey/apas-gift.jpg' },
    glow: { x: 50, y: 44 },
    steps: [
      { t: 'Tired mornings, guessed recovery — training hard on days the body asked for mercy.' },
      { t: 'The churned ocean pours into his heart; the fatigue-cracks seal with light.' },
    ],
    pins: [
      { x: 58, y: 26, t: 'Readiness score each dawn' },
      { x: 68, y: 42, t: 'Sleep · HRV · strain' },
      { x: 56, y: 58, t: 'Per-muscle recovery map' },
    ],
    proof: {
      k: 'the proof · आपस्', title: 'One honest number for how ready you are.',
      body: 'Sleep, HRV and strain from your watch flow into a single readiness score — green, yellow or red — plus a per-muscle recovery map that says what to train today.',
      shot: '/img/journey/proof-readiness.png', shotAlt: 'The real Sarathi readiness view',
      chips: ['Readiness score', 'Per-muscle recovery', 'Watch sync'],
    },
  },
  {
    id: 'prithvi', n: 5, word: 'पृथ्वी', name: 'Earth', title: 'EARTH', accent: '#d9b26a',
    summary: 'In Phase 5, the earth builds him a mirror that cannot lie — a Twin that grows the day he does.',
    lackCap: 'Nothing showed for his work — so he stopped.',
    giftCap: 'The earth built him a mirror that cannot lie.',
    img: { lack: '/img/journey/prithvi-lack.jpg', gift: '/img/journey/prithvi-gift.jpg' },
    glow: { x: 50, y: 60 },
    steps: [
      { t: 'Weeks of honest work with nothing to show — progress invisible, motivation crumbling.' },
      { t: 'Golden dust builds his reflection layer by layer, until the mirror stands strong.' },
    ],
    pins: [
      { x: 58, y: 26, t: 'True-size Twin · your measurements' },
      { x: 68, y: 44, t: 'Becoming slider · today → goal' },
      { x: 56, y: 60, t: 'Try-on · fits goal-you' },
    ],
    proof: {
      k: 'the proof · पृथ्वी', title: 'Your Twin grows the day you do.',
      body: 'A 3D body built from your real measurements. It gains what you gain, levels as you train, and the Becoming slider shows the body you are walking toward.',
      shot: '/img/journey/proof-twin.png', shotAlt: 'The real Sarathi 3D Twin',
      chips: ['True-size morphs', 'Becoming slider', 'Gym-wear try-on'],
    },
  },
];

// Finale hotspots — NRG's "Explore your data center" photo-chip pins.
export const HOTSPOTS = [
  { x: 50, y: 16, t: 'Mind · the Vault', d: 'Every record you create is yours — markdown files, one-click export.', accent: '#c5b3ff' },
  { x: 24, y: 38, t: 'Breath · Form Coach', d: 'Camera coaching on-device: reps counted, graded, corrected live.', accent: '#7fd4f0' },
  { x: 74, y: 40, t: 'Fire · Meals', d: 'One line per meal. Macros read instantly, protein kept honest.', accent: '#ff9e5e' },
  { x: 30, y: 62, t: 'Heart · Readiness', d: 'Sleep, HRV and strain → one honest number each dawn.', accent: '#2ec4b6' },
  { x: 70, y: 66, t: 'Foundation · the Twin', d: 'A true-size 3D mirror that grows the day you do.', accent: '#d9b26a' },
];

export const MANIFESTO = [
  'Every body is a battlefield.',
  'Apps count your steps and forget your name.',
  'Sarathi is different: a charioteer, not a dashboard —',
  'five ancient powers, rebuilt as one guide that remembers you.',
];
