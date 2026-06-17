// Hermes — the companion that grows with you. The relationship layer of Sarathi:
// a proactive briefing, a visible "mind" growth bar (the mirror of the Twin's
// body bar), the memories Hermes holds about you, and a chat that logs or answers.
// Privacy gate lives server-side — Hermes only ever sees scores and labels.
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { stagger, rise } from '../components/ui.jsx';
import { IconArrow, IconSparkle, IconX } from '../components/Icons.jsx';

const KIND_LABEL = { goal: 'Goal', preference: 'Preference', fact: 'Fact', win: 'Win', struggle: 'Struggle' };

export default function Coach() {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [hermes, setHermes] = useState(null);
  const [brief, setBrief] = useState(null);
  const [part, setPart] = useState('morning');
  const [obs, setObs] = useState([]);
  const [mems, setMems] = useState([]);
  const [memOpen, setMemOpen] = useState(false);
  const [newMem, setNewMem] = useState('');
  const endRef = useRef(null);

  const name = hermes?.name || 'Hermes';

  async function loadHermes() {
    try { setHermes(await api('/v1/hermes')); } catch (_) {}
  }
  async function loadMems() {
    try { setMems((await api('/v1/hermes/memory')).memories || []); } catch (_) {}
  }
  async function loadObs() {
    try { setObs((await api('/v1/hermes/observations')).observations || []); } catch (_) {}
  }
  async function loadBriefing(p) {
    try {
      const b = await api(`/v1/hermes/briefing?part=${p}`);
      setBrief(b);
      if (b.hermes) setHermes(b.hermes);
    } catch (_) { setBrief(null); }
  }
  useEffect(() => {
    // Default to the right briefing for the user's local time.
    const h = new Date().getHours();
    const p = h < 12 ? 'morning' : h < 18 ? 'midday' : 'evening';
    setPart(p);
    loadHermes(); loadMems(); loadObs(); loadBriefing(p);
  }, []);

  function switchPart(p) { setPart(p); loadBriefing(p); }

  async function addMemory() {
    const text = newMem.trim();
    if (!text) return;
    setNewMem('');
    try {
      const r = await api('/v1/hermes/memory', { method: 'POST', body: { kind: 'goal', text } });
      setMems(r.memories || []);
      if (r.hermes) setHermes(r.hermes);
    } catch (_) {}
  }
  async function forget(id) {
    try { setMems((await api(`/v1/hermes/memory/${id}`, { method: 'DELETE' })).memories || []); loadHermes(); } catch (_) {}
  }

  function add(role, who, body) {
    setMsgs((m) => [...m, { role, who, body }]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60);
  }

  async function handle(text) {
    try {
      if (text.includes('history') || text.includes('recent log')) {
        const meals = await api('/v1/logs/meals?limit=10');
        const wk = await api('/v1/logs/workouts?limit=5');
        let out = 'Recent meals:\n';
        out += (meals.meals || []).slice(0, 5).map((m) => `${m.ts?.slice(0, 10)} · ${m.food_id.replace(/_/g, ' ')} · ${Math.round(m.kcal)} kcal`).join('\n') || 'None';
        out += '\n\nRecent workouts:\n';
        out += (wk.workouts || []).slice(0, 3).map((w) => `${w.ts?.slice(0, 10)} · ${w.day_name} (${w.program}) · ${w.decision}`).join('\n') || 'None';
        add('bot', name, out);
      } else if (text.match(/search\s+(.+)/)) {
        const q = text.match(/search\s+(.+)/)[1];
        const r = await api(`/v1/foods/search?q=${encodeURIComponent(q)}&limit=8`);
        add('bot', name, r.results.length === 0
          ? `No foods found for "${q}". Try: chicken, paneer, roti, rice, dal, egg.`
          : r.results.map((f) => `${f.name} — ${f.kcal} kcal · P${f.p} C${f.c} F${f.f}`).join('\n'));
      } else if (text.includes('meal plan') || text.includes('plan')) {
        const r = await api('/v1/diet/plan', { method: 'POST', body: { template: 'indian_nonveg_4meal', n_days: 1 } });
        const meals = r.days[0].map((m) => `${m.meal}: ${m.items.map((i) => i.food_id.replace(/_/g, ' ')).join(', ')}`).join('\n');
        add('bot', name, `Today's meal plan (Indian Non-Veg):\n\n${meals}`);
      } else if (text.includes('programs') || text.includes('program')) {
        const r = await api('/v1/programs');
        add('bot', name, `Available programs:\n${r.programs.map((p) => `• ${p}`).join('\n')}`);
      } else {
        // The natural-language agent: it logs a set/weight/meal from plain English,
        // or answers — and quietly grows Hermes's memory of you.
        const r = await api('/v1/coach/act', { method: 'POST', body: { text } });
        add('bot', name, r.reply);
        loadHermes(); loadMems(); loadObs();  // an exchange may have taught Hermes something
      }
    } catch (e) {
      add('bot', name, `Error: ${e.message}`);
    }
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    add('user', 'You', text);
    setInput('');
    setTimeout(() => handle(text.toLowerCase()), 300);
  }

  const lvl = hermes?.level ?? 0;
  const stage = hermes?.stage;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      {/* Hermes identity + the "mind" growth bar (mirror of the Twin's body bar) */}
      <motion.div variants={rise} className="card" style={{ margin: '22px 0 16px',
        background: 'linear-gradient(160deg, rgba(46,230,168,0.10), rgba(76,201,240,0.06))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center',
            background: 'rgba(46,230,168,0.16)', color: 'var(--mint)', flexShrink: 0 }}>
            <IconSparkle width={24} height={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="display" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>{name}</h2>
            <p className="meta" style={{ marginTop: 2 }}>
              {stage ? `${stage.title} · your coach's mind` : 'your companion'}
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--mint)' }}>{lvl}</div>
            <div className="micro" style={{ margin: 0 }}>LEVEL</div>
          </div>
        </div>
        <div style={{ marginTop: 12, height: 7, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${lvl}%` }} transition={{ duration: 0.8 }}
            style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, var(--mint), var(--cyan))' }} />
        </div>
        {hermes && (
          <p className="meta" style={{ marginTop: 8, fontSize: 11 }}>
            {hermes.days_known}d together · {hermes.interactions} talks · remembers {hermes.memories}
            {stage?.next_at != null && ` · next stage at ${stage.next_at}`}
          </p>
        )}
      </motion.div>

      {/* Proactive briefing — Hermes travels with you */}
      <motion.div variants={rise} className="card">
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {['morning', 'midday', 'evening'].map((p) => (
            <button key={p} className={`btn ${part === p ? 'primary' : 'ghost'}`}
              style={{ padding: '5px 12px', fontSize: 12, textTransform: 'capitalize' }}
              onClick={() => switchPart(p)}>{p}</button>
          ))}
        </div>
        {brief ? (
          <>
            <p style={{ fontSize: 15, lineHeight: 1.6 }}>{brief.text}</p>
            {brief.briefing?.plan && (
              <p className="meta" style={{ marginTop: 8 }}>📋 {brief.briefing.plan}</p>
            )}
          </>
        ) : <p className="meta">Putting your briefing together…</p>}
      </motion.div>

      {/* What Hermes noticed — goal progress, patterns, recall (the wedge) */}
      {obs.length > 0 && (
        <motion.div variants={rise} className="card">
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>{name} noticed</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {obs.map((o, i) => {
              const tone = o.kind === 'warning' ? 'var(--amber)'
                : o.kind === 'win' ? 'var(--green)'
                : o.kind === 'goal' ? 'var(--cyan)' : 'var(--mint)';
              return (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: tone, marginTop: 7, flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>{o.text}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* What Hermes remembers about you — yours to see and forget */}
      <motion.div variants={rise} className="card">
        <button onClick={() => setMemOpen(!memOpen)} style={{ all: 'unset', cursor: 'pointer', width: '100%',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15 }}>{name} remembers <span className="meta">({mems.length})</span></h3>
          <span className="meta">{memOpen ? '▾' : '▸'}</span>
        </button>
        {memOpen && (
          <div style={{ marginTop: 10 }}>
            {mems.length === 0 && <p className="meta">Nothing yet. Tell {name} a goal and it'll hold onto it.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {mems.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)',
                  borderRadius: 10, padding: '8px 10px' }}>
                  <span className="micro" style={{ margin: 0, color: 'var(--cyan)', minWidth: 64 }}>{KIND_LABEL[m.kind] || m.kind}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{m.text}</span>
                  <button className="btn ghost" style={{ padding: 4 }} onClick={() => forget(m.id)} aria-label="Forget">
                    <IconX width={14} height={14} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input value={newMem} onChange={(e) => setNewMem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMemory()}
                placeholder="Tell Hermes a goal to remember…"
                style={{ flex: 1, padding: '10px 12px', borderRadius: 12, fontSize: 13 }} />
              <button className="btn primary" onClick={addMemory}>Add</button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Chat */}
      <motion.div variants={rise} style={{ marginTop: 6 }}>
        {msgs.length === 0 && (
          <div className="empty" style={{ padding: '24px 20px', lineHeight: 1.9 }}>
            Talk to {name} — <i>"I benched 100 for 5"</i> · <i>"I weigh 77 today"</i><br />
            <i>"my goal is to lose 5kg"</i> · <i>"what should I eat tonight?"</i>
          </div>
        )}
        {msgs.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`bubble${m.role === 'user' ? ' user' : ''}`}>
            <div className="who">{m.who}</div>
            <p>{m.body}</p>
          </motion.div>
        ))}
        <div ref={endRef} />
      </motion.div>

      <motion.div variants={rise} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={`Talk to ${name}…`} style={{ flex: 1, padding: '13px 16px', borderRadius: 14 }} />
        <motion.button whileTap={{ scale: 0.93 }} className="btn primary" onClick={send} aria-label="Send">
          <IconArrow width={18} height={18} />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
