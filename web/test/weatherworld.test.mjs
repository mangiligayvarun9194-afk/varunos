// Tests for the pure parts of the weather → Twin-world preset mapping.
// Network (fetchWeatherPreset) and geolocation (getLocationPreset) are
// intentionally NOT tested here.
// Run: node web/test/weatherworld.test.mjs
import { presetFromWeather, fallbackPreset } from '../src/lib/weatherworld.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const P = (code, tempC = 20, isDay = true) => presetFromWeather({ code, tempC, isDay });

// --- snow: 71–77, 85, 86 ---
for (const c of [71, 73, 75, 77, 85, 86]) {
  const p = P(c);
  ok(p.mode === 'snow', `code ${c} → snow (got ${p.mode})`);
}
{
  const p = P(71, -5, true);
  ok(p.tint === '#a8c5e0', 'snow tint #a8c5e0');
  ok(p.intensity === 0.6, 'snow default intensity 0.6');
  ok(p.night === false, 'snow by day → night false');
  ok(typeof p.label === 'string' && p.label.length > 0, 'snow has a label');
}

// --- rain: 51–67, 80–82 at intensity 0.6 ---
for (const c of [51, 55, 61, 63, 65, 66, 67, 80, 81, 82]) {
  const p = P(c);
  ok(p.mode === 'rain', `code ${c} → rain (got ${p.mode})`);
  ok(p.intensity === 0.6, `code ${c} rain intensity 0.6 (got ${p.intensity})`);
}
ok(P(61).tint === '#6f8cff', 'rain tint #6f8cff');

// --- storm: 95–99 → rain intensity 1.0 ---
for (const c of [95, 96, 99]) {
  const p = P(c);
  ok(p.mode === 'rain', `code ${c} → rain/storm (got ${p.mode})`);
  ok(p.intensity === 1.0, `code ${c} storm intensity 1.0 (got ${p.intensity})`);
}
ok(P(95).tint === '#6f8cff', 'storm keeps rain tint');
ok(P(95).label === 'heavy storm', 'storm label "heavy storm"');

// --- fog: 45, 48 ---
for (const c of [45, 48]) {
  const p = P(c);
  ok(p.mode === 'fog', `code ${c} → fog (got ${p.mode})`);
}
ok(P(45).tint === '#8e9ab8', 'fog tint #8e9ab8');
ok(P(45).intensity === 0.6, 'fog default intensity 0.6');

// --- heat: non-precip code + tempC >= 38 ---
{
  const p = P(0, 41, true);
  ok(p.mode === 'heat', 'clear code at 41C → heat');
  ok(p.tint === '#ff9e5e', 'heat tint #ff9e5e');
  ok(p.intensity === 0.6, 'heat default intensity 0.6');
  ok(P(0, 38, true).mode === 'heat', 'tempC exactly 38 → heat');
  ok(P(0, 37.9, true).mode === 'clear', 'tempC 37.9 → clear, not heat');
  ok(P(61, 45, true).mode === 'rain', 'precip code wins over heat at 45C');
}

// --- clear day / clear night ---
{
  const d = P(0, 22, true);
  ok(d.mode === 'clear' && d.night === false, 'code 0 day → clear day');
  ok(d.tint === '#f5b572', 'clear day tint is gold #f5b572');
  ok(d.label === 'clear day', 'clear day label');
  const n = P(1, 22, false);
  ok(n.mode === 'clear' && n.night === true, 'code 1 night → clear night');
  ok(n.tint === '#c5b3ff', 'clear night tint is violet #c5b3ff');
  ok(n.label === 'clear night', 'clear night label');
  ok(n.intensity === 0.6, 'clear default intensity 0.6');
}

// --- night flag follows !isDay in every mode ---
ok(P(71, -3, false).night === true, 'snow at night → night true');
ok(P(95, 20, false).night === true, 'storm at night → night true');
ok(P(45, 10, false).night === true, 'fog at night → night true');
ok(P(0, 40, false).night === true, 'heat at night → night true');

// --- non-mapped codes fall through to clear (e.g. 2, 3 = cloudy) ---
ok(P(2, 20, true).mode === 'clear', 'code 2 (partly cloudy) → clear');
ok(P(3, 20, true).mode === 'clear', 'code 3 (overcast) → clear');

// --- fallbackPreset: day 6–17, night otherwise ---
{
  ok(fallbackPreset(12).mode === 'clear', 'fallback noon → clear');
  ok(fallbackPreset(12).night === false, 'fallback noon → day');
  ok(fallbackPreset(12).tint === '#f5b572', 'fallback day tint gold');
  ok(fallbackPreset(6).night === false, 'fallback 6:00 → day boundary');
  ok(fallbackPreset(17).night === false, 'fallback 17:00 → still day');
  ok(fallbackPreset(18).night === true, 'fallback 18:00 → night boundary');
  ok(fallbackPreset(5).night === true, 'fallback 5:00 → night');
  ok(fallbackPreset(0).night === true, 'fallback midnight → night');
  ok(fallbackPreset(23).tint === '#c5b3ff', 'fallback night tint violet');
  ok(fallbackPreset(23).label === 'clear night', 'fallback night label');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
