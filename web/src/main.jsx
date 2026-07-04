import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import SarathiHero from './screens/SarathiHero.jsx';
import SarathiCinematic from './screens/SarathiCinematic.jsx';
import SarathiStory from './screens/SarathiStory.jsx';
import SarathiPitch from './screens/SarathiPitch.jsx';
import { WeatherBackdropDemo } from './screens/WeatherBackdrop.jsx';
import './theme.css';

// Hash routes for special surfaces (#pitch = investor deck, #weather = backdrop check).
// DEMO forces one at root for local preview only — MUST be null in production: the
// normal App owns the root (the scroll-film ships as the pre-auth Landing inside App).
const DEMO = null;
const hash = typeof window !== 'undefined' ? window.location.hash : '';
const pick = hash === '#pitch' ? 'pitch'
  : hash === '#weather' ? 'weather'
  : DEMO || (hash === '#sarathi-story' ? 'story' : hash === '#sarathi-cinematic' ? 'cinematic' : hash === '#sarathi-hero' ? 'carousel' : null);
const goApp = () => { window.location.hash = ''; window.location.reload(); };

// The legacy PWA may have registered a service worker that caches the old
// shell. Unregister it so this app always serves fresh.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((rs) => rs.forEach((r) => r.unregister()))
    .catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {pick === 'pitch' ? <SarathiPitch />
      : pick === 'weather' ? <div style={{ position: 'fixed', inset: 0, background: '#06080d' }}><WeatherBackdropDemo /></div>
      : pick === 'story' ? <SarathiStory onStart={goApp} />
      : pick === 'cinematic' ? <SarathiCinematic onStart={goApp} />
      : pick === 'carousel' ? <SarathiHero onStart={goApp} />
      : <App />}
  </React.StrictMode>
);
