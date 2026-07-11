// API client — same localStorage contract as the legacy PWA so existing
// devices keep their connection, PIN and pairing state after the upgrade.

// Device pairing: consume a #pair= link (base64 {api,key} in the URL FRAGMENT,
// never sent to any server) and scrub it from history immediately.
(function consumePairLink() {
  if (!location.hash.startsWith('#pair=')) return;
  try {
    const data = JSON.parse(atob(decodeURIComponent(location.hash.slice(6))));
    if (data.api && data.key) {
      localStorage.setItem('varunos_api', data.api);
      localStorage.setItem('varunos_key', data.key);
      localStorage.setItem('varunos_onboarded', '1');
      localStorage.setItem('varunos_paired', '1');
      localStorage.setItem('sarathi_seen_landing', '1');   // paired device: straight to the app
      if (data.skipPin) localStorage.setItem('varunos_pin_skipped', '1');  // QA/dev hand-off links
    }
  } catch (_) {}
  history.replaceState(null, '', location.pathname + location.search);
})();

// When the app is served by the Sarathi server itself (Render or local
// uvicorn), same-origin is the right default. The localhost fallback only
// matters for `vite dev`.
const defaultBase = ['5173', '5174'].includes(location.port) ? 'http://127.0.0.1:8000' : location.origin;

export let API_BASE = localStorage.getItem('varunos_api') || defaultBase;
export let API_KEY = localStorage.getItem('varunos_key') || '';

export function setConnection(base, key) {
  API_BASE = base || defaultBase;
  API_KEY = key || '';
  localStorage.setItem('varunos_api', API_BASE);
  if (API_KEY) localStorage.setItem('varunos_key', API_KEY);
  else localStorage.removeItem('varunos_key');
}

export async function api(path, opts = {}) {
  const init = {
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      ...(opts.headers || {}),
    },
    ...opts,
  };
  if (init.body && typeof init.body !== 'string') init.body = JSON.stringify(init.body);
  const res = await fetch(API_BASE + path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function healthCheck() {
  try {
    const r = await fetch(API_BASE + '/healthz');
    return r.ok;
  } catch (_) {
    return false;
  }
}

export async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function makePairLink() {
  if (!API_KEY) return null;
  const payload = btoa(JSON.stringify({ api: API_BASE, key: API_KEY }));
  return location.origin + location.pathname + '#pair=' + encodeURIComponent(payload);
}

// ---- Profile (localStorage mirror; server copy via PUT /v1/user/profile) ----
const DEFAULT_PROFILE = {
  user_id: 'varun', sex: 'M', age: 30, height_cm: 178, weight_kg: 78,
  activity: 'moderate', goal: 'recomp', workout_time_pref: 'flexible',
};

export function getProfile() {
  try {
    return { ...DEFAULT_PROFILE, ...JSON.parse(localStorage.getItem('varunos_profile') || '{}') };
  } catch (_) {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveProfileLocal(p) {
  localStorage.setItem('varunos_profile', JSON.stringify(p));
}

export function mealContext() {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 19 ? 'snack' : 'dinner';
}

// Plate calculator: what to load per side on a 20 kg bar
export function plateText(weight) {
  if (!weight || weight <= 20) return 'empty bar';
  let per = (weight - 20) / 2;
  const plates = [25, 20, 15, 10, 5, 2.5, 1.25];
  const out = [];
  for (const p of plates) { while (per >= p - 0.01) { out.push(p); per -= p; } }
  return out.length ? out.join(' + ') + ' /side' : 'empty bar';
}

export function classifyExercise(id) {
  const s = (id || '').toLowerCase();
  if (/(squat|leg_press|lunge|deadlift|rdl)/.test(s)) return 'squat';
  if (/(bench|press|push|dip|fly)/.test(s)) return 'press';
  if (/(curl|row|pull|chin|lat)/.test(s)) return 'curl';
  return 'press';
}
