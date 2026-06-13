// Coach: command router (history / search / plan / programs) with everything
// else going to the Brain via /v1/coach/ask. Privacy gate lives server-side.
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { stagger, rise } from '../components/ui.jsx';
import { IconArrow } from '../components/Icons.jsx';

export default function Coach() {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const endRef = useRef(null);

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
        add('bot', 'VarunOS', out);
      } else if (text.match(/search\s+(.+)/)) {
        const q = text.match(/search\s+(.+)/)[1];
        const r = await api(`/v1/foods/search?q=${encodeURIComponent(q)}&limit=8`);
        add('bot', 'VarunOS', r.results.length === 0
          ? `No foods found for "${q}". Try: chicken, paneer, roti, rice, dal, egg.`
          : r.results.map((f) => `${f.name} — ${f.kcal} kcal · P${f.p} C${f.c} F${f.f}`).join('\n'));
      } else if (text.includes('meal plan') || text.includes('plan')) {
        const r = await api('/v1/diet/plan', { method: 'POST', body: { template: 'indian_nonveg_4meal', n_days: 1 } });
        const meals = r.days[0].map((m) => `${m.meal}: ${m.items.map((i) => i.food_id.replace(/_/g, ' ')).join(', ')}`).join('\n');
        add('bot', 'VarunOS', `Today's meal plan (Indian Non-Veg):\n\n${meals}`);
      } else if (text.includes('programs') || text.includes('program')) {
        const r = await api('/v1/programs');
        add('bot', 'VarunOS', `Available programs:\n${r.programs.map((p) => `• ${p}`).join('\n')}`);
      } else {
        // The natural-language agent: it can log a set/weight/meal from plain
        // English, or answer. No commands — just type how you'd say it.
        const r = await api('/v1/coach/act', { method: 'POST', body: { text } });
        add('bot', 'VarunOS', r.reply);
      }
    } catch (e) {
      add('bot', 'VarunOS', `Error: ${e.message}`);
    }
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    add('user', 'You', text);
    setInput('');
    setTimeout(() => handle(text.toLowerCase()), 300);
  }

  function quick(action) {
    if (action === 'doctor_share') {
      add('user', 'You', 'Generate doctor-share');
      add('bot', 'VarunOS', 'Doctor-share data is available at POST /v1/doctor/share. CLI PDF: PYTHONPATH=. python3 scripts/doctor_share_pdf.py');
      return;
    }
    add('user', 'You', action === 'briefing' ? 'Show briefing' : 'Show workout');
    handle(action);
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={rise} style={{ margin: '26px 0 20px' }}>
        <h2 className="display" style={{ fontSize: 30, fontWeight: 700 }}>Coach</h2>
        <p className="meta">Just talk to it — log or ask, no commands</p>
      </motion.div>

      <motion.div variants={rise}>
        {msgs.length === 0 && (
          <div className="empty" style={{ padding: '34px 20px', lineHeight: 1.9 }}>
            Try: <i>"I benched 100 for 5"</i> · <i>"I weigh 77 today"</i><br />
            <i>"had 3 eggs and dal"</i> · <i>"what should I eat tonight?"</i>
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
          placeholder="Ask your coach…" style={{ flex: 1, padding: '13px 16px', borderRadius: 14 }} />
        <motion.button whileTap={{ scale: 0.93 }} className="btn primary" onClick={send} aria-label="Send">
          <IconArrow width={18} height={18} />
        </motion.button>
      </motion.div>

      <motion.div variants={rise}>
        <div className="micro">Quick actions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn ghost full" onClick={() => quick('briefing')}>Show full briefing</button>
          <button className="btn ghost full" onClick={() => quick('workout')}>Show today's workout</button>
          <button className="btn ghost full" onClick={() => quick('doctor_share')}>Generate doctor-share PDF</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
