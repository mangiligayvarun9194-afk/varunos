// Sarathi — the public pre-auth homepage: the scroll-film (SarathiStory — the Pancha
// Bhuta descent with the pinned card, traveling 3D camera and element collection).
// The film carries its own nav/rail/footer; this wrapper only keeps the legal overlay
// reachable. CTA → onStart() (sign up).
import { useState } from 'react';
import SarathiStory from './SarathiStory.jsx';
import { LegalOverlay } from './Legal.jsx';

export default function Landing({ onStart }) {
  const [legal, setLegal] = useState(null);
  return (
    <div style={{ position: 'relative' }}>
      <SarathiStory onStart={onStart} />
      <div style={{ position: 'fixed', bottom: 10, left: 16, zIndex: 96, display: 'flex', gap: 14 }}>
        {['privacy', 'terms'].map((d) => (
          <button key={d} onClick={() => setLegal(d)}
            style={{ background: 'none', border: 'none', color: '#59648a', fontSize: 10.5, cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'var(--font-eyebrow)', letterSpacing: '0.1em', opacity: 0.85, padding: 0 }}>
            {d}
          </button>
        ))}
      </div>
      {legal && <LegalOverlay doc={legal} onClose={() => setLegal(null)} />}
    </div>
  );
}
