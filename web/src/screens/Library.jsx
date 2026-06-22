// Exercise Form Library — the coach-grade reference that makes Sarathi a real
// strength app. Browse by muscle group / search → tap an exercise for full form:
// target + synergist muscles, range of motion, step-by-step execution, coaching
// cues, and common mistakes. Data from /v1/exercises (deterministic core).
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api.js';
import { stagger, rise } from '../components/ui.jsx';
import { IconBarbell, IconBack, IconSearch, IconBody, IconShield, IconX } from '../components/Icons.jsx';

const GROUP_LABEL = { chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms', legs: 'Legs', core: 'Core' };

export default function Library({ onTab }) {
  const [list, setList] = useState(null);
  const [groups, setGroups] = useState([]);
  const [group, setGroup] = useState(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);   // selected exercise detail
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function load(g, query) {
    try {
      const qs = query ? `?q=${encodeURIComponent(query)}` : g ? `?group=${g}` : '';
      const r = await api('/v1/exercises' + qs);
      setList(r.exercises || []);
      if (r.groups) setGroups(r.groups);
    } catch (_) { setList([]); }
  }
  useEffect(() => { load(null, ''); }, []);

  function pickGroup(g) { setGroup(g); setQ(''); load(g, ''); }
  function onSearch(v) { setQ(v); setGroup(null); load(null, v); }

  async function open(id) {
    setLoadingDetail(true);
    try { setSel(await api(`/v1/exercises/${id}`)); } catch (_) {}
    setLoadingDetail(false);
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <motion.div variants={rise} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '26px 0 14px' }}>
        <button className="btn ghost" style={{ padding: '6px 10px' }} onClick={() => onTab('log')} aria-label="Back">
          <IconBack width={18} height={18} />
        </button>
        <div>
          <h2 className="display" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>Form Library</h2>
          <p className="meta">Correct form, range of motion & cues — every lift</p>
        </div>
      </motion.div>

      {/* search */}
      <motion.div variants={rise} style={{ position: 'relative', marginBottom: 12 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute)' }}>
          <IconSearch width={16} height={16} />
        </span>
        <input value={q} onChange={(e) => onSearch(e.target.value)} placeholder="Search exercise or muscle…"
          style={{ width: '100%', padding: '11px 12px 11px 36px', borderRadius: 12 }} />
      </motion.div>

      {/* group filter */}
      <motion.div variants={rise} style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 6, scrollbarWidth: 'none' }}>
        <button className={`btn ${!group && !q ? 'primary' : 'ghost'}`} style={{ flexShrink: 0, padding: '6px 14px', fontSize: 13 }}
          onClick={() => { setGroup(null); setQ(''); load(null, ''); }}>All</button>
        {groups.map((g) => (
          <button key={g} className={`btn ${group === g ? 'primary' : 'ghost'}`} style={{ flexShrink: 0, padding: '6px 14px', fontSize: 13 }}
            onClick={() => pickGroup(g)}>{GROUP_LABEL[g] || g}</button>
        ))}
      </motion.div>

      {/* list */}
      {list === null && <div className="skel" style={{ height: 200, borderRadius: 16 }} />}
      {list && list.length === 0 && <p className="meta" style={{ padding: 20 }}>No exercises found.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(list || []).map((e) => (
          <motion.button key={e.id} variants={rise} onClick={() => open(e.id)} className="card"
            style={{ textAlign: 'left', cursor: 'pointer', padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--mint)', flexShrink: 0 }}><IconBarbell width={18} height={18} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{e.name}</div>
              <div className="meta" style={{ fontSize: 12 }}>
                {GROUP_LABEL[e.group] || e.group} · {(e.primary || []).join(', ')}
              </div>
            </div>
            <span style={{ fontSize: 10, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
              {e.mechanic}
            </span>
          </motion.button>
        ))}
      </div>

      {/* detail sheet */}
      <AnimatePresence>
        {sel && <Detail e={sel} onClose={() => setSel(null)} />}
      </AnimatePresence>
      {loadingDetail && !sel && (
        <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', zIndex: 200 }}>
          <span className="meta">Loading…</span>
        </div>
      )}
    </motion.div>
  );
}

function Detail({ e, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(4,6,11,0.78)', backdropFilter: 'blur(6px)',
        zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(ev) => ev.stopPropagation()}
        className="card" style={{ width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto',
          borderRadius: '20px 20px 0 0', padding: 20, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <h3 className="display" style={{ fontSize: 20, fontWeight: 700 }}>{e.name}</h3>
          <button className="btn ghost" style={{ padding: 6 }} onClick={onClose} aria-label="Close"><IconX width={16} height={16} /></button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {[GROUP_LABEL[e.group] || e.group, e.mechanic, e.force, e.equipment, e.level].map((t) => (
            <span key={t} style={{ fontSize: 11, color: 'var(--cyan)', background: 'var(--surface-2)',
              borderRadius: 99, padding: '3px 10px', textTransform: 'capitalize' }}>{t}</span>
          ))}
        </div>

        <Field icon={<IconBody width={15} height={15} />} title="Muscles worked">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            <b style={{ color: 'var(--mint)' }}>Target:</b> {e.primary.join(', ')}
            {e.secondary?.length ? <><br /><b style={{ color: 'var(--dim)' }}>Synergists:</b> {e.secondary.join(', ')}</> : null}
          </p>
        </Field>

        <Field title="Range of motion">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>{e.rom}</p>
        </Field>

        <Field title="How to perform">
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
            {e.execution.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </Field>

        <Field title="Coaching cues" accent="var(--green)">
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13, lineHeight: 1.7 }}>
            {e.cues.map((c, i) => <li key={i} style={{ display: 'flex', gap: 8 }}><span style={{ color: 'var(--green)' }}>✓</span>{c}</li>)}
          </ul>
        </Field>

        <Field icon={<IconShield width={15} height={15} />} title="Common mistakes" accent="var(--amber)">
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13, lineHeight: 1.7 }}>
            {e.mistakes.map((m, i) => <li key={i} style={{ display: 'flex', gap: 8 }}><span style={{ color: 'var(--amber)' }}>!</span>{m}</li>)}
          </ul>
        </Field>

        <p className="meta" style={{ marginTop: 6 }}>Tempo: {e.tempo}</p>
      </motion.div>
    </motion.div>
  );
}

function Field({ title, children, icon, accent }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {icon && <span style={{ color: accent || 'var(--mint)' }}>{icon}</span>}
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: accent || 'var(--mute)' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}
