// weatherworld.js — maps real-world weather onto the Twin's world.
// Pure preset logic (unit-tested in web/test/weatherworld.test.mjs) plus two
// thin async wrappers around Open-Meteo + browser geolocation that never throw.
//
// Preset shape: { mode, night, tint, intensity, label }
//   mode ∈ 'snow' | 'rain' | 'heat' | 'fog' | 'clear'

const TINTS = {
  snow: '#a8c5e0',
  rain: '#6f8cff',
  heat: '#ff9e5e',
  fog: '#8e9ab8',
  clearDay: '#f5b572',
  clearNight: '#c5b3ff',
};

// WMO weather interpretation codes → Twin world mode.
// https://open-meteo.com/en/docs (current_weather.weathercode)
export function presetFromWeather({ code, tempC, isDay }) {
  const night = !isDay;
  const c = Number(code);

  // snow: 71–77 (snow fall / grains), 85–86 (snow showers)
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) {
    return { mode: 'snow', night, tint: TINTS.snow, intensity: 0.6, label: 'snowfall' };
  }
  // thunderstorm: 95–99 → rain at full intensity
  if (c >= 95 && c <= 99) {
    return { mode: 'rain', night, tint: TINTS.rain, intensity: 1.0, label: 'heavy storm' };
  }
  // drizzle / rain / freezing rain: 51–67, showers: 80–82
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) {
    return { mode: 'rain', night, tint: TINTS.rain, intensity: 0.6, label: 'steady rain' };
  }
  // fog / depositing rime fog
  if (c === 45 || c === 48) {
    return { mode: 'fog', night, tint: TINTS.fog, intensity: 0.6, label: 'thick fog' };
  }
  // otherwise clear-ish; extreme temperature overrides
  if (Number(tempC) >= 38) {
    return { mode: 'heat', night, tint: TINTS.heat, intensity: 0.6, label: 'scorching heat' };
  }
  return night
    ? { mode: 'clear', night: true, tint: TINTS.clearNight, intensity: 0.6, label: 'clear night' }
    : { mode: 'clear', night: false, tint: TINTS.clearDay, intensity: 0.6, label: 'clear day' };
}

// Pure fallback when weather/location are unavailable: clear day 6:00–17:59
// local, clear night otherwise.
export function fallbackPreset(hourLocal) {
  const h = Number(hourLocal);
  const day = h >= 6 && h < 18;
  return presetFromWeather({ code: 0, tempC: 20, isDay: day });
}

// Async: fetch current weather from Open-Meteo (free, keyless) and map it to
// a preset. Any failure (network, bad payload) → fallbackPreset(now).
export async function fetchWeatherPreset({ lat, lon }) {
  try {
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=' +
      encodeURIComponent(lat) +
      '&longitude=' +
      encodeURIComponent(lon) +
      '&current_weather=true';
    const res = await fetch(url);
    if (!res.ok) throw new Error('weather http ' + res.status);
    const data = await res.json();
    const cw = data && data.current_weather;
    if (!cw || cw.weathercode == null) throw new Error('weather payload missing');
    return presetFromWeather({
      code: cw.weathercode,
      tempC: cw.temperature,
      isDay: !!cw.is_day,
    });
  } catch {
    return fallbackPreset(new Date().getHours());
  }
}

// Async: browser geolocation (5s timeout) → fetchWeatherPreset. Denied,
// unavailable, or timed-out geolocation → fallbackPreset. Never throws.
export function getLocationPreset() {
  return new Promise((resolve) => {
    const fallback = () => resolve(fallbackPreset(new Date().getHours()));
    if (typeof navigator === 'undefined' || !navigator.geolocation) return fallback();
    let settled = false;
    const done = (fn) => {
      if (settled) return;
      settled = true;
      fn();
    };
    const timer = setTimeout(() => done(fallback), 5000);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          done(() =>
            fetchWeatherPreset({ lat: pos.coords.latitude, lon: pos.coords.longitude })
              .then(resolve, fallback),
          );
        },
        () => {
          clearTimeout(timer);
          done(fallback);
        },
        { timeout: 5000, maximumAge: 10 * 60 * 1000 },
      );
    } catch {
      clearTimeout(timer);
      done(fallback);
    }
  });
}
