import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

/* ── SOP protocols for common industrial emergencies ── */
const PROTOCOLS = {
  cardiac: {
    label: 'Cardiac Emergency',
    icon: '❤️',
    color: 'bg-red-50 border-red-200 text-red-700',
    dot: 'bg-red-500',
    steps: [
      'Check responsiveness — tap shoulders, shout "Are you okay?"',
      'Call for help — activate emergency response, dial 108',
      'Check breathing & pulse (10 seconds)',
      'Begin CPR if no pulse — 30 compressions : 2 breaths',
      'Use AED if available — attach pads, follow prompts',
      'Do not stop CPR until emergency team arrives',
      'Position in recovery position if breathing resumes',
      'Record time of event and actions taken',
    ],
  },
  chemical: {
    label: 'Chemical Exposure',
    icon: '⚗️',
    color: 'bg-orange-50 border-orange-200 text-orange-700',
    dot: 'bg-orange-500',
    steps: [
      'Remove from exposure area immediately — ensure your own safety first',
      'Remove contaminated clothing and jewellery',
      'Flush skin/eyes with large amounts of water for 15–20 minutes',
      'Do NOT induce vomiting if ingested',
      'Check MSDS sheet for specific chemical first aid',
      'Call Poison Control (1800-116-117) or nearest hospital',
      'Preserve sample of chemical for medical team',
      'Transport to hospital with MSDS documentation',
    ],
  },
  burns: {
    label: 'Burns / Fire Injury',
    icon: '🔥',
    color: 'bg-amber-50 border-amber-200 text-amber-700',
    dot: 'bg-amber-500',
    steps: [
      'Cool the burn with running cool water for 10–20 minutes',
      'Do NOT use ice, butter, or toothpaste',
      'Remove loose clothing — do NOT remove if stuck to skin',
      'Cover with clean non-fluffy material or cling film',
      'Assess burn severity: degree & body surface area',
      'Elevate burned limb if possible',
      'Do NOT break blisters',
      'Transfer to hospital for burns >10% BSA or face/hands/joints',
    ],
  },
  fracture: {
    label: 'Fracture / Musculoskeletal',
    icon: '🦴',
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    dot: 'bg-blue-500',
    steps: [
      'Do not move patient if spinal injury suspected',
      'Immobilize the injured area — splint in position found',
      'Check circulation, sensation & movement below injury',
      'Control any bleeding with direct pressure',
      'Elevate injured limb to reduce swelling',
      'Apply ice pack wrapped in cloth (20 min on, 20 min off)',
      'Do NOT attempt to straighten fracture',
      'Transport to hospital with splint in place',
    ],
  },
  unconscious: {
    label: 'Unconscious / Collapse',
    icon: '🧠',
    color: 'bg-purple-50 border-purple-200 text-purple-700',
    dot: 'bg-purple-500',
    steps: [
      'Check scene safety before approaching',
      'Tap shoulders, shout — assess level of consciousness',
      'Open airway — head tilt, chin lift',
      'Check breathing — look, listen, feel (10 seconds)',
      'Call 108 / emergency services immediately',
      'Place in recovery position if breathing normally',
      'Begin CPR if no breathing or pulse',
      'Do NOT give food or water',
      'Monitor continuously until help arrives',
    ],
  },
  eye: {
    label: 'Eye Injury',
    icon: '👁️',
    color: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    dot: 'bg-cyan-500',
    steps: [
      'Do NOT rub the eye',
      'For foreign body: flush with clean water or eyewash station',
      'For chemical splash: irrigate with water for 20 minutes minimum',
      'Do NOT remove embedded objects',
      'Cover eye loosely with clean pad — do NOT apply pressure',
      'Keep patient calm and still',
      'Seek ophthalmology review urgently',
      'Document chemical involved if applicable',
    ],
  },
  electric: {
    label: 'Electrical Injury',
    icon: '⚡',
    color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    dot: 'bg-yellow-600',
    steps: [
      'Do NOT touch patient while still in contact with current',
      'Switch off power at mains / use insulated object to separate',
      'Call 108 immediately — all electrical injuries need hospital',
      'Check for responsiveness, breathing, pulse',
      'Begin CPR if necessary',
      'Treat entry and exit burns with clean dressings',
      'Lay flat — do not give fluids',
      'Monitor for cardiac arrhythmia',
    ],
  },
  heatstroke: {
    label: 'Heat Stroke / Exhaustion',
    icon: '🌡️',
    color: 'bg-rose-50 border-rose-200 text-rose-700',
    dot: 'bg-rose-500',
    steps: [
      'Move to cool shaded area immediately',
      'Remove excess clothing',
      'Cool rapidly — wet cloths, fan, cool water mist',
      'Apply ice packs to neck, armpits and groin',
      'If conscious: give cool water to drink sip by sip',
      'Do NOT give fluids if unconscious',
      'Call 108 if temperature above 40°C or unconscious',
      'Monitor temperature every 5 minutes',
    ],
  },
};

const URGENCY_CFG = {
  critical: { label: 'Critical',  bg: 'bg-red-100',    txt: 'text-red-700',    dot: 'bg-red-500'    },
  high:     { label: 'High',      bg: 'bg-orange-100', txt: 'text-orange-700', dot: 'bg-orange-500' },
  moderate: { label: 'Moderate',  bg: 'bg-amber-100',  txt: 'text-amber-700',  dot: 'bg-amber-500'  },
};

const OUTCOME_CFG = {
  treated:    { label: 'Treated & Released', bg: 'bg-emerald-100', txt: 'text-emerald-700' },
  referred:   { label: 'Referred to Hospital', bg: 'bg-blue-100', txt: 'text-blue-700' },
  admitted:   { label: 'Hospitalised', bg: 'bg-purple-100', txt: 'text-purple-700' },
  ongoing:    { label: 'Under Observation', bg: 'bg-amber-100', txt: 'text-amber-700' },
};

const EMPTY_FORM = {
  employeeName: '', employeeId: '', department: '', age: '', gender: '',
  incidentDate: new Date().toISOString().split('T')[0],
  incidentTime: new Date().toTimeString().slice(0,5),
  location: '', emergencyType: 'cardiac', urgency: 'high',
  description: '', firstAidGiven: '', sopStepsCompleted: [],
  ambulanceCalled: false, hospitalName: '', referredTo: '',
  outcome: 'treated', notes: '', logToInjuryRegister: false,
};

export default function EmergencySOP() {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id;

  const [incidents, setIncidents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('incidents'); // incidents | sop
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [empSearch, setEmpSearch] = useState('');
  const [empSugg, setEmpSugg] = useState([]);
  const [saving, setSaving] = useState(false);
  const [viewIncident, setViewIncident] = useState(null);
  const [sopProtocol, setSopProtocol] = useState('cardiac');

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [empSnap, incSnap] = await Promise.all([
          getDocs(collection(db, `merchants/${tenantId}/employees`)),
          getDocs(query(collection(db, `merchants/${tenantId}/emergency_incidents`), orderBy('createdAt', 'desc'))),
        ]);
        setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setIncidents(incSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { toast.error('Failed to load'); }
      setLoading(false);
    };
    load();
  }, [tenantId]);

  useEffect(() => {
    if (!empSearch.trim()) { setEmpSugg([]); return; }
    const q = empSearch.toLowerCase();
    setEmpSugg(employees.filter(e =>
      e.name?.toLowerCase().includes(q) || e.employeeId?.toLowerCase().includes(q)
    ).slice(0, 6));
  }, [empSearch, employees]);

  const pickEmployee = (emp) => {
    setForm(f => ({ ...f, employeeName: emp.name||'', employeeId: emp.employeeId||emp.id, department: emp.department||'', age: emp.age||'', gender: emp.gender||'' }));
    setEmpSearch(emp.name || '');
    setEmpSugg([]);
  };

  const toggleStep = (step) => {
    setForm(f => ({
      ...f,
      sopStepsCompleted: f.sopStepsCompleted.includes(step)
        ? f.sopStepsCompleted.filter(s => s !== step)
        : [...f.sopStepsCompleted, step],
    }));
  };

  const handleSave = async () => {
    if (!form.employeeName || !form.emergencyType || !form.description) {
      toast.error('Employee, type and description required');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, tenantId, createdAt: serverTimestamp() };
      const ref = await addDoc(collection(db, `merchants/${tenantId}/emergency_incidents`), payload);
      // Also log to injury register if flagged
      if (form.logToInjuryRegister) {
        await addDoc(collection(db, `merchants/${tenantId}/injuries`), {
          employeeName: form.employeeName, employeeId: form.employeeId,
          department: form.department, date: form.incidentDate,
          injuryType: 'Emergency — ' + PROTOCOLS[form.emergencyType]?.label,
          description: form.description, firstAidGiven: form.firstAidGiven,
          outcome: form.outcome, createdAt: serverTimestamp(), tenantId,
          sourceId: ref.id, source: 'emergency_sop',
        });
        toast.success('Also logged to Injury Register');
      }
      setIncidents(prev => [{ id: ref.id, ...payload, createdAt: new Date() }, ...prev]);
      toast.success('Emergency incident recorded');
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEmpSearch('');
    } catch (e) { toast.error('Failed to save'); }
    setSaving(false);
  };

  const proto = PROTOCOLS[form.emergencyType] || PROTOCOLS.cardiac;
  const stats = {
    total: incidents.length,
    critical: incidents.filter(i => i.urgency === 'critical').length,
    referred: incidents.filter(i => i.outcome === 'referred' || i.outcome === 'admitted').length,
    thisMonth: incidents.filter(i => {
      const d = i.incidentDate || '';
      const now = new Date();
      return d.startsWith(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
    }).length,
  };

  const fmt = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">Emergency SOP</h1>
          <p className="text-sm text-muted mt-0.5">First aid protocols & incident logging</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setTab('sop'); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'sop' ? 'bg-sage text-white' : 'bg-white border border-border text-text hover:bg-surface2'}`}>
            📋 SOP Protocols
          </button>
          <button onClick={() => { setTab('incidents'); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'incidents' ? 'bg-sage text-white' : 'bg-white border border-border text-text hover:bg-surface2'}`}>
            🚨 Incident Log
          </button>
          <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM); setEmpSearch(''); }}
            className="btn-primary flex items-center gap-2">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
            Log Incident
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Incidents', val: stats.total,     color: 'text-text',        bg: 'bg-white'      },
          { label: 'Critical',        val: stats.critical,  color: 'text-red-600',     bg: 'bg-red-50'     },
          { label: 'Referred/Hosp.', val: stats.referred,  color: 'text-purple-600',  bg: 'bg-purple-50'  },
          { label: 'This Month',      val: stats.thisMonth, color: 'text-sage',        bg: 'bg-sage/5'     },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-border`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-muted mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── SOP PROTOCOLS TAB ── */}
      {tab === 'sop' && (
        <div className="space-y-4">
          {/* Protocol selector */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(PROTOCOLS).map(([key, p]) => (
              <button key={key} onClick={() => setSopProtocol(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  sopProtocol === key ? 'bg-sage text-white border-sage' : 'bg-white border-border text-text hover:bg-surface2'
                }`}>
                <span>{p.icon}</span> {p.label}
              </button>
            ))}
          </div>

          {/* Protocol card */}
          {(() => {
            const p = PROTOCOLS[sopProtocol];
            return (
              <div className={`rounded-2xl border-2 p-6 ${p.color}`}>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-4xl">{p.icon}</span>
                  <div>
                    <h2 className="text-xl font-display font-bold">{p.label}</h2>
                    <p className="text-sm opacity-70">First Aid SOP — {p.steps.length} steps</p>
                  </div>
                  <div className="ml-auto">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/60">
                      FOLLOW IN ORDER
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  {p.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3 bg-white/60 rounded-xl px-4 py-3">
                      <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 bg-white/50 rounded-xl px-4 py-3 text-xs font-medium">
                  🚑 Emergency: <strong>108</strong> &nbsp;|&nbsp; Poison Control: <strong>1800-116-117</strong> &nbsp;|&nbsp; Police: <strong>100</strong>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── INCIDENT LOG TAB ── */}
      {tab === 'incidents' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface2 text-xs text-muted uppercase tracking-wide">
                <th className="text-left px-4 py-3">Employee</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Date / Time</th>
                <th className="text-left px-4 py-3">Urgency</th>
                <th className="text-left px-4 py-3">Outcome</th>
                <th className="text-left px-4 py-3">SOP</th>
                <th className="text-left px-4 py-3">View</th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted py-12">
                  <div className="text-3xl mb-2">🏥</div>
                  <div>No incidents recorded</div>
                </td></tr>
              )}
              {incidents.map(inc => {
                const proto = PROTOCOLS[inc.emergencyType];
                const ug = URGENCY_CFG[inc.urgency] || URGENCY_CFG.high;
                const oc = OUTCOME_CFG[inc.outcome] || OUTCOME_CFG.treated;
                const pct = proto ? Math.round((inc.sopStepsCompleted?.length || 0) / proto.steps.length * 100) : 0;
                return (
                  <tr key={inc.id} className="border-b border-border hover:bg-surface2 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text">{inc.employeeName || '—'}</div>
                      <div className="text-xs text-muted">{inc.department}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <span>{proto?.icon}</span>
                        <span className="text-text">{proto?.label || inc.emergencyType}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <div>{inc.incidentDate}</div>
                      <div className="text-xs">{inc.incidentTime}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ug.bg} ${ug.txt}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ug.dot}`}/>
                        {ug.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${oc.bg} ${oc.txt}`}>
                        {oc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                          <div className="h-full bg-sage rounded-full" style={{ width: `${pct}%` }}/>
                        </div>
                        <span className="text-xs text-muted">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setViewIncident(inc)}
                        className="text-xs text-sage hover:text-sage2 font-medium">View →</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── New Incident Form Drawer ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)}/>
          <div className="relative ml-auto w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-red-600 text-white">
              <div>
                <h2 className="text-lg font-display font-bold">🚨 Log Emergency Incident</h2>
                <p className="text-xs text-white/70 mt-0.5">Record emergency with SOP checklist</p>
              </div>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Employee */}
              <div>
                <label className="label">Employee *</label>
                <div className="relative">
                  <input value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                    placeholder="Search by name or ID…" className="input w-full"/>
                  {empSugg.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-border rounded-lg shadow-lg z-10 mt-1">
                      {empSugg.map(e => (
                        <button key={e.id} onClick={() => pickEmployee(e)}
                          className="w-full text-left px-3 py-2.5 hover:bg-surface2 flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">
                            {(e.name||'?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{e.name}</div>
                            <div className="text-xs text-muted">{e.department} · {e.employeeId}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Date / Time / Location */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Date *</label>
                  <input type="date" value={form.incidentDate} onChange={e => setForm(f=>({...f,incidentDate:e.target.value}))} className="input w-full"/>
                </div>
                <div>
                  <label className="label">Time *</label>
                  <input type="time" value={form.incidentTime} onChange={e => setForm(f=>({...f,incidentTime:e.target.value}))} className="input w-full"/>
                </div>
                <div>
                  <label className="label">Location</label>
                  <input value={form.location} onChange={e => setForm(f=>({...f,location:e.target.value}))} placeholder="Shop floor / Gate 2…" className="input w-full"/>
                </div>
              </div>

              {/* Type & Urgency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Emergency Type *</label>
                  <select value={form.emergencyType} onChange={e => setForm(f=>({...f,emergencyType:e.target.value,sopStepsCompleted:[]}))} className="input w-full">
                    {Object.entries(PROTOCOLS).map(([k,p]) => <option key={k} value={k}>{p.icon} {p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Urgency *</label>
                  <select value={form.urgency} onChange={e => setForm(f=>({...f,urgency:e.target.value}))} className="input w-full">
                    {Object.entries(URGENCY_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="label">Incident Description *</label>
                <textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))}
                  rows={2} placeholder="What happened? Describe the incident…" className="input w-full resize-none"/>
              </div>

              {/* SOP Checklist */}
              <div>
                <label className="label">SOP Steps Completed — {proto.label}</label>
                <div className={`rounded-xl border-2 p-4 space-y-2 ${proto.color}`}>
                  {proto.steps.map((step, i) => (
                    <label key={i} className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox"
                        checked={form.sopStepsCompleted.includes(step)}
                        onChange={() => toggleStep(step)}
                        className="mt-0.5 w-4 h-4 rounded accent-sage flex-shrink-0"/>
                      <span className={`text-sm ${form.sopStepsCompleted.includes(step) ? 'line-through opacity-60' : ''}`}>
                        <span className="font-medium mr-1">{i+1}.</span>{step}
                      </span>
                    </label>
                  ))}
                  <div className="text-xs font-medium mt-2 opacity-70">
                    {form.sopStepsCompleted.length} / {proto.steps.length} steps completed
                  </div>
                </div>
              </div>

              {/* First Aid Given */}
              <div>
                <label className="label">First Aid Given</label>
                <textarea value={form.firstAidGiven} onChange={e => setForm(f=>({...f,firstAidGiven:e.target.value}))}
                  rows={2} placeholder="Describe treatment given at OHC…" className="input w-full resize-none"/>
              </div>

              {/* Escalation */}
              <div className="bg-surface2 rounded-xl p-4 space-y-3">
                <div className="text-sm font-semibold text-text">Escalation</div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.ambulanceCalled} onChange={e => setForm(f=>({...f,ambulanceCalled:e.target.checked}))} className="w-4 h-4 rounded accent-red-500"/>
                  <span className="text-sm text-text">Ambulance called (108)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Hospital Referred To</label>
                    <input value={form.hospitalName} onChange={e => setForm(f=>({...f,hospitalName:e.target.value}))} placeholder="Hospital name" className="input w-full"/>
                  </div>
                  <div>
                    <label className="label">Outcome</label>
                    <select value={form.outcome} onChange={e => setForm(f=>({...f,outcome:e.target.value}))} className="input w-full">
                      {Object.entries(OUTCOME_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Additional notes & Injury Register */}
              <div>
                <label className="label">Additional Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))}
                  rows={2} placeholder="Any additional observations…" className="input w-full resize-none"/>
              </div>
              <label className="flex items-center gap-2 cursor-pointer bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <input type="checkbox" checked={form.logToInjuryRegister} onChange={e => setForm(f=>({...f,logToInjuryRegister:e.target.checked}))} className="w-4 h-4 rounded accent-amber-500"/>
                <span className="text-sm font-medium text-amber-700">Also log to Injury Register (for statutory reporting)</span>
              </label>

            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-surface2">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary bg-red-600 hover:bg-red-700">
                {saving ? 'Saving…' : '🚨 Record Incident'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Incident Drawer ── */}
      {viewIncident && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewIncident(null)}/>
          <div className="relative ml-auto w-full max-w-lg bg-white h-full flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface2">
              <div>
                <h2 className="text-base font-semibold text-text">Incident Report</h2>
                <p className="text-xs text-muted">{viewIncident.incidentDate} · {viewIncident.incidentTime}</p>
              </div>
              <button onClick={() => setViewIncident(null)} className="w-8 h-8 rounded-full bg-border hover:bg-border/80 flex items-center justify-center">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
              {(() => {
                const p = PROTOCOLS[viewIncident.emergencyType];
                const ug = URGENCY_CFG[viewIncident.urgency] || URGENCY_CFG.high;
                const oc = OUTCOME_CFG[viewIncident.outcome] || OUTCOME_CFG.treated;
                const pct = p ? Math.round((viewIncident.sopStepsCompleted?.length||0) / p.steps.length * 100) : 0;
                return (<>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ug.bg} ${ug.txt}`}>{ug.label}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${oc.bg} ${oc.txt}`}>{oc.label}</span>
                    {viewIncident.ambulanceCalled && <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">🚑 Ambulance Called</span>}
                  </div>
                  <div className="bg-surface2 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between"><span className="text-muted">Employee</span><span className="font-medium">{viewIncident.employeeName}</span></div>
                    <div className="flex justify-between"><span className="text-muted">Department</span><span>{viewIncident.department||'—'}</span></div>
                    <div className="flex justify-between"><span className="text-muted">Location</span><span>{viewIncident.location||'—'}</span></div>
                    <div className="flex justify-between"><span className="text-muted">Type</span><span>{p?.icon} {p?.label}</span></div>
                  </div>
                  <div>
                    <div className="label mb-1">Description</div>
                    <div className="bg-surface2 rounded-xl p-3 text-text">{viewIncident.description}</div>
                  </div>
                  {viewIncident.firstAidGiven && <div>
                    <div className="label mb-1">First Aid Given</div>
                    <div className="bg-surface2 rounded-xl p-3 text-text">{viewIncident.firstAidGiven}</div>
                  </div>}
                  <div>
                    <div className="label mb-1">SOP Compliance — {pct}%</div>
                    <div className="w-full h-2 bg-border rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-sage rounded-full" style={{width:`${pct}%`}}/>
                    </div>
                    <div className={`rounded-xl border p-3 space-y-1.5 ${p?.color}`}>
                      {p?.steps.map((step,i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span>{viewIncident.sopStepsCompleted?.includes(step) ? '✅' : '⬜'}</span>
                          <span className={viewIncident.sopStepsCompleted?.includes(step) ? 'line-through opacity-60' : ''}>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {viewIncident.hospitalName && <div>
                    <div className="label mb-1">Referred To</div>
                    <div className="bg-surface2 rounded-xl p-3">{viewIncident.hospitalName}</div>
                  </div>}
                  {viewIncident.notes && <div>
                    <div className="label mb-1">Notes</div>
                    <div className="bg-surface2 rounded-xl p-3">{viewIncident.notes}</div>
                  </div>}
                </>);
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
