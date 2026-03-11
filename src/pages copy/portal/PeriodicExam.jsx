import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy, onSnapshot, getDocs, where, limit
} from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate, initials } from '../../utils/formatters';
import { calcIHI, colorIHI, gradeIHI } from '../../utils/ihi';

// ── constants ─────────────────────────────────────────────
const FITNESS    = ['Fit', 'Fit with Restriction', 'Unfit'];
const PFT_OPTS   = ['Normal','Mild Obstruction','Moderate Obstruction','Severe Obstruction','Restriction','Not Done'];
const AUDIO_OPTS = ['Normal','Mild Loss','Moderate Loss','Severe Loss','Not Done'];
const ECG_OPTS   = ['Normal','Abnormal','Not Done'];
const XRAY_OPTS  = ['Normal','Abnormal','Not Done'];

const URINE_PROTEIN = ['Nil','Trace','+','++','+++'];
const URINE_SUGAR   = ['Nil','Trace','+','++','+++'];
const URINE_BIL     = ['Nil','+','++','+++'];
const URINE_COLOUR  = ['Pale Yellow','Yellow','Dark Yellow','Amber','Colourless'];
const URINE_APPEAR  = ['Clear','Turbid','Slightly Turbid'];

const CURR_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => CURR_YEAR - i);

const EMPTY = {
  employeeId: '', employeeName: '', department: '', gender: '', age: '',
  examYear: String(CURR_YEAR),
  examDate: new Date().toISOString().slice(0, 10),
  // Vitals
  weight: '', height: '', bp: '', pulse: '',
  // CBC
  haemoglobin: '', pcv: '', wbc: '', rbc: '', mcv: '', mch: '', mchc: '',
  platelets: '', neutrophils: '', lymphocytes: '', eosinophils: '', monocytes: '',
  // Biochemistry
  sugarRandom: '', urea: '', bun: '', creatinine: '', uricAcid: '',
  // Lipids
  totalCholesterol: '', triglyceride: '', hdl: '', ldl: '', vldl: '',
  // LFT
  bilirubinTotal: '', bilirubinDirect: '', bilirubinIndirect: '',
  sgot: '', sgpt: '', alkPhosphatase: '', totalProtein: '',
  albumin: '', globulin: '',
  // Urine
  urineColour: 'Pale Yellow', urineAppearance: 'Clear', urinePH: '',
  urineSpGravity: '', urineProtein: 'Nil', urineSugar: 'Nil',
  urineBilirubin: 'Nil', pusCells: '', epithelialCells: '', urineRBC: '',
  // Special
  vision: '', pft: 'Normal', audiometry: 'Normal', ecg: 'Normal', xRayChest: 'Normal',
  occupationalExposure: '',
  // History
  personalHistory: '', familyHistory: '',
  // Result
  fitnessResult: 'Fit', remarks: '',
};

// ── helpers ───────────────────────────────────────────────
function bmi(w, h) {
  const wf = parseFloat(w), hf = parseFloat(h);
  if (!wf || !hf) return null;
  return (wf / ((hf / 100) ** 2)).toFixed(1);
}
function agRatio(alb, glob) {
  const a = parseFloat(alb), g = parseFloat(glob);
  if (!a || !g) return null;
  return (a / g).toFixed(2);
}
function ldlHdlRatio(ldl, hdl) {
  const l = parseFloat(ldl), h = parseFloat(hdl);
  if (!l || !h) return null;
  return (l / h).toFixed(2);
}
function cholHdlRatio(chol, hdl) {
  const c = parseFloat(chol), h = parseFloat(hdl);
  if (!c || !h) return null;
  return (c / h).toFixed(2);
}

// ── flag helpers (normal range indicators) ───────────────
function flag(val, low, high) {
  const v = parseFloat(val);
  if (!v) return '';
  if (v < low)  return '🔽 Low';
  if (v > high) return '🔼 High';
  return '✓';
}
function flagColor(val, low, high) {
  const v = parseFloat(val);
  if (!v) return 'text-muted';
  if (v < low || v > high) return 'text-amber-400';
  return 'text-accent';
}

// ── section header ────────────────────────────────────────
function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2 pt-4 pb-2 border-b border-border mb-3">
      <span>{icon}</span>
      <h3 className="text-sm font-semibold text-text uppercase tracking-wider">{title}</h3>
    </div>
  );
}

// ── lab field with normal range flag ─────────────────────
function LabField({ label, value, onChange, placeholder, low, high, unit, step = '0.1' }) {
  const f = flag(value, low, high);
  const fc = flagColor(value, low, high);
  return (
    <div>
      <label className="field-label">{label}{unit && <span className="text-muted ml-1">({unit})</span>}</label>
      <div className="relative">
        <input type="number" step={step} className="field-input pr-12" placeholder={placeholder}
          value={value} onChange={e => onChange(e.target.value)} />
        {f && <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium ${fc}`}>{f}</span>}
      </div>
    </div>
  );
}

// ── fitness badge ─────────────────────────────────────────
function FitBadge({ result }) {
  const map = { 'Fit': 'bg-accent/10 text-accent', 'Fit with Restriction': 'bg-amber-400/10 text-amber-400', 'Unfit': 'bg-red-500/10 text-red-400' };
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${map[result] || 'bg-surface2 text-muted'}`}>{result || '—'}</span>;
}

// ── year-on-year mini trend ───────────────────────────────
function YoYTrend({ records }) {
  if (records.length < 2) return null;
  const sorted = [...records].sort((a, b) => a.examYear - b.examYear).slice(-5);
  const maxHb = Math.max(...sorted.map(r => parseFloat(r.haemoglobin) || 0), 1);
  return (
    <div className="mt-3">
      <div className="text-xs text-muted mb-2">Haemoglobin trend (g/dL)</div>
      <div className="flex items-end gap-2 h-12">
        {sorted.map((r, i) => {
          const hb = parseFloat(r.haemoglobin) || 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="text-[9px] text-muted">{hb || '—'}</div>
              <div className="w-full rounded-t" style={{ height: `${Math.max(3, (hb / maxHb) * 36)}px`, background: '#40916c' }} />
              <div className="text-[9px] text-muted">{r.examYear}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function PeriodicExam() {
  const { tenant, staffUser } = useAuthStore();
  const tid  = tenant?.id;
  const role = staffUser?.role || 'staff';
  const canEdit = ['doctor', 'nurse', 'admin'].includes(role);

  const [records,     setRecords]     = useState([]);
  const [employees,   setEmployees]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [form,        setForm]        = useState(EMPTY);
  const [viewRecord,  setViewRecord]  = useState(null);
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [activeTab,   setActiveTab]   = useState('vitals');

  // employee picker
  const [empSearch,   setEmpSearch]   = useState('');
  const [empDropdown, setEmpDropdown] = useState(false);

  // filters
  const [search,      setSearch]      = useState('');
  const [filterYear,  setFilterYear]  = useState('');
  const [filterResult,setFilterResult]= useState('');

  // YoY trend for selected employee in view modal
  const [empHistory,  setEmpHistory]  = useState([]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // load records
  useEffect(() => {
    if (!tid) return;
    const unsub = onSnapshot(
      query(collection(db, 'merchants', tid, 'annualChecks'), orderBy('createdAt', 'desc')),
      snap => { setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, [tid]);

  // load employees
  useEffect(() => {
    if (!tid) return;
    getDocs(collection(db, 'merchants', tid, 'employees'))
      .then(snap => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
  }, [tid]);

  const filteredEmps = employees.filter(e => {
    const q = empSearch.toLowerCase();
    return !q || e.name?.toLowerCase().includes(q) || e.empId?.toLowerCase().includes(q);
  }).slice(0, 8);

  const selectEmployee = (emp) => {
    set('employeeId',   emp.empId || emp.id);
    set('employeeName', emp.name);
    set('department',   emp.department || '');
    set('gender',       emp.gender || '');
    setEmpSearch(emp.name);
    setEmpDropdown(false);
  };

  const openAdd = () => {
    setEditing(null); setForm(EMPTY); setEmpSearch(''); setActiveTab('vitals'); setShowForm(true);
  };

  const openEdit = (rec) => {
    setEditing(rec); setForm({ ...EMPTY, ...rec }); setEmpSearch(rec.employeeName || '');
    setActiveTab('vitals'); setShowForm(true);
  };

  const openView = async (rec) => {
    setViewRecord(rec);
    // load all records for this employee (YoY trend)
    try {
      const snap = await getDocs(query(
        collection(db, 'merchants', tid, 'annualChecks'),
        where('employeeId', '==', rec.employeeId),
        orderBy('examYear', 'asc')
      ));
      setEmpHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { setEmpHistory([]); }
  };

  const handleSave = async () => {
    if (!form.employeeId) { toast.error('Select an employee.'); return; }
    if (!form.examDate)   { toast.error('Exam date is required.'); return; }
    setSaving(true);
    try {
      const bmiVal  = bmi(form.weight, form.height);
      const agr     = agRatio(form.albumin, form.globulin);
      const lhRatio = ldlHdlRatio(form.ldl, form.hdl);
      const chRatio = cholHdlRatio(form.totalCholesterol, form.hdl);
      const payload = { ...form, bmi: bmiVal, agRatio: agr, ldlHdlRatio: lhRatio, cholHdlRatio: chRatio, updatedAt: serverTimestamp() };

      if (editing) {
        await updateDoc(doc(db, 'merchants', tid, 'annualChecks', editing.id), payload);
        toast.success('Periodic exam updated.');
      } else {
        await addDoc(collection(db, 'merchants', tid, 'annualChecks'), { ...payload, createdAt: serverTimestamp() });
        toast.success('Periodic exam saved.');
      }
      // sync fitness to employee doc
      const empDoc = employees.find(e => (e.empId || e.id) === form.employeeId);
      if (empDoc) {
        await updateDoc(doc(db, 'merchants', tid, 'employees', empDoc.id),
          { fitnessStatus: form.fitnessResult, lastExamDate: form.examDate, updatedAt: serverTimestamp() });
      }
      setShowForm(false);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'merchants', tid, 'annualChecks', deleteTarget.id));
      toast.success('Record deleted.');
    } catch (e) { toast.error(e.message); }
    finally { setDeleteTarget(null); }
  };

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.employeeName?.toLowerCase().includes(q) || r.employeeId?.toLowerCase().includes(q))
      && (!filterYear   || r.examYear === filterYear)
      && (!filterResult || r.fitnessResult === filterResult);
  });

  // stats
  const fit        = records.filter(r => r.fitnessResult === 'Fit').length;
  const restricted = records.filter(r => r.fitnessResult === 'Fit with Restriction').length;
  const unfit      = records.filter(r => r.fitnessResult === 'Unfit').length;
  const thisYear   = records.filter(r => r.examYear === String(CURR_YEAR)).length;

  const TABS = [
    { id: 'vitals',   label: 'Vitals & CBC' },
    { id: 'biochem',  label: 'Biochemistry' },
    { id: 'lipids',   label: 'Lipid Profile' },
    { id: 'lft',      label: 'LFT' },
    { id: 'urine',    label: 'Urine' },
    { id: 'special',  label: 'Special Inv.' },
    { id: 'history',  label: 'History' },
  ];

  const bmiVal = bmi(form.weight, form.height);

  return (
    <div className="p-6 max-w-6xl">

      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-text">Periodic Medical Examination</h1>
          <p className="text-muted text-sm mt-0.5">ILO C161 Art.5(a) · Annual health surveillance with full lab parameters</p>
        </div>
        {canEdit && <button onClick={openAdd} className="btn-primary">+ New Examination</button>}
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Records',       value: records.length, icon: '📋', color: 'text-accent' },
          { label: `This Year (${CURR_YEAR})`, value: thisYear,  icon: '📅', color: 'text-blue-400' },
          { label: 'Fit',                 value: fit,            icon: '✅', color: 'text-accent' },
          { label: 'Unfit / Restricted',  value: unfit + restricted, icon: '⚠️', color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className={`font-serif text-3xl ${s.color} mb-0.5`}>{loading ? '—' : s.value}</div>
            <div className="text-xs text-muted uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input className="field-input w-60" placeholder="Search name or ID…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="field-input w-36" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          <option value="">All Years</option>
          {YEARS.map(y => <option key={y}>{y}</option>)}
        </select>
        <select className="field-input w-52" value={filterResult} onChange={e => setFilterResult(e.target.value)}>
          <option value="">All Results</option>
          {FITNESS.map(f => <option key={f}>{f}</option>)}
        </select>
      </div>

      {/* records table */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_60px_80px_80px_80px_100px_70px] gap-2 px-4 py-2.5 bg-surface2 border-b border-border">
          {['Employee','Department','Year','Hb','Sugar','BP','Result',''].map(h => (
            <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>
          ))}
        </div>
        {loading
          ? <div className="py-12 text-center text-muted text-sm">Loading records…</div>
          : filtered.length === 0
            ? <div className="py-14 text-center">
                <div className="text-4xl mb-3">🔬</div>
                <div className="text-muted text-sm">{records.length === 0 ? 'No periodic exams recorded yet.' : 'No records match your filters.'}</div>
              </div>
            : filtered.map(rec => (
              <div key={rec.id}
                className="grid grid-cols-[2fr_1fr_60px_80px_80px_80px_100px_70px] gap-2 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors items-center">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
                    {initials(rec.employeeName)}
                  </div>
                  <div className="min-w-0">
                    <button onClick={() => openView(rec)} className="text-sm font-medium text-text hover:text-accent truncate block text-left">
                      {rec.employeeName}
                    </button>
                    <div className="text-xs text-muted">{rec.employeeId}</div>
                  </div>
                </div>
                <div className="text-xs text-muted truncate">{rec.department || '—'}</div>
                <div className="text-sm font-medium text-text">{rec.examYear}</div>
                <div className={`text-xs font-medium ${flagColor(rec.haemoglobin, rec.gender === 'Female' ? 12 : 13, 17)}`}>
                  {rec.haemoglobin ? `${rec.haemoglobin} g` : '—'}
                </div>
                <div className={`text-xs font-medium ${flagColor(rec.sugarRandom, 0, 140)}`}>
                  {rec.sugarRandom ? `${rec.sugarRandom}` : '—'}
                </div>
                <div className="text-xs text-muted">{rec.bp || '—'}</div>
                <FitBadge result={rec.fitnessResult} />
                <div className="flex gap-1">
                  {canEdit && <button onClick={() => openEdit(rec)} className="text-muted hover:text-accent text-sm p-1">✏️</button>}
                  {canEdit && <button onClick={() => setDeleteTarget(rec)} className="text-muted hover:text-red-400 text-sm p-1">🗑️</button>}
                </div>
              </div>
            ))
        }
      </div>

      {/* ═══════ ADD / EDIT MODAL ═══════ */}
      {showForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-box w-full max-w-3xl max-h-[94vh] flex flex-col">
            <div className="modal-header shrink-0">
              <h2 className="font-serif text-xl text-text">{editing ? 'Edit Periodic Examination' : 'Periodic Medical Examination'}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-text text-xl leading-none">×</button>
            </div>

            {/* scrollable body */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-5">

                {/* Employee + year */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 relative">
                    <label className="field-label">Search Employee *</label>
                    <input className="field-input" placeholder="Type name or ID…" value={empSearch}
                      onChange={e => { setEmpSearch(e.target.value); setEmpDropdown(true); }}
                      onFocus={() => setEmpDropdown(true)} />
                    {empDropdown && empSearch && filteredEmps.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-lg shadow-xl overflow-hidden">
                        {filteredEmps.map(emp => (
                          <button key={emp.id} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-surface2 text-left"
                            onMouseDown={() => selectEmployee(emp)}>
                            <div className="w-7 h-7 rounded-full bg-green/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">{initials(emp.name)}</div>
                            <div><div className="text-sm text-text">{emp.name}</div><div className="text-xs text-muted">{emp.empId} · {emp.department}</div></div>
                          </button>
                        ))}
                      </div>
                    )}
                    {form.employeeId && (
                      <div className="mt-1 text-xs text-muted flex items-center gap-1.5">
                        <span className="text-accent">✓</span><span>{form.employeeName}</span>
                        <span>·</span><span>{form.employeeId}</span>
                        {form.department && <><span>·</span><span>{form.department}</span></>}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="field-label">Examination Year *</label>
                    <select className="field-input" value={form.examYear} onChange={e => set('examYear', e.target.value)}>
                      {YEARS.map(y => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Exam Date</label>
                    <input type="date" className="field-input" value={form.examDate} onChange={e => set('examDate', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Age</label>
                    <input type="number" className="field-input" placeholder="35" value={form.age} onChange={e => set('age', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Overall Result *</label>
                    <select className="field-input" value={form.fitnessResult} onChange={e => set('fitnessResult', e.target.value)}>
                      {FITNESS.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                </div>

                {/* TAB BAR */}
                <div className="flex gap-0.5 bg-surface2 rounded-lg p-1 overflow-x-auto">
                  {TABS.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                        activeTab === t.id ? 'bg-green text-white' : 'text-muted hover:text-text'
                      }`}>{t.label}</button>
                  ))}
                </div>

                {/* ── TAB: Vitals & CBC ── */}
                {activeTab === 'vitals' && (
                  <div className="space-y-4">
                    <SectionHeader icon="🩺" title="Vitals" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div><label className="field-label">Blood Pressure</label><input className="field-input" placeholder="120/80" value={form.bp} onChange={e => set('bp', e.target.value)} /></div>
                      <div><label className="field-label">Pulse (bpm)</label><input type="number" className="field-input" placeholder="72" value={form.pulse} onChange={e => set('pulse', e.target.value)} /></div>
                      <div><label className="field-label">Weight (kg)</label><input type="number" className="field-input" placeholder="70" value={form.weight} onChange={e => set('weight', e.target.value)} /></div>
                      <div><label className="field-label">Height (cm)</label><input type="number" className="field-input" placeholder="170" value={form.height} onChange={e => set('height', e.target.value)} /></div>
                    </div>
                    {bmiVal && (
                      <div className="text-xs text-muted bg-surface2 rounded-lg px-3 py-2 inline-block">
                        BMI: <span className="font-semibold text-text">{bmiVal}</span>
                        <span className="ml-2">{parseFloat(bmiVal) < 18.5 ? '· Underweight' : parseFloat(bmiVal) < 25 ? '· Normal ✓' : parseFloat(bmiVal) < 30 ? '· Overweight' : '· Obese'}</span>
                      </div>
                    )}

                    <SectionHeader icon="🔬" title="Haematology (CBC)" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <LabField label="Haemoglobin" unit="g/dL" placeholder="14.0" low={form.gender === 'Female' ? 12 : 13} high={17} value={form.haemoglobin} onChange={v => set('haemoglobin', v)} />
                      <LabField label="PCV" unit="%" placeholder="42" low={37} high={52} value={form.pcv} onChange={v => set('pcv', v)} step="1" />
                      <LabField label="Total WBC" placeholder="7000" low={4000} high={11000} value={form.wbc} onChange={v => set('wbc', v)} step="100" />
                      <LabField label="RBC Count" placeholder="5.0" low={3.8} high={5.8} value={form.rbc} onChange={v => set('rbc', v)} />
                      <LabField label="MCV" unit="fL" placeholder="90" low={80} high={100} value={form.mcv} onChange={v => set('mcv', v)} step="1" />
                      <LabField label="MCH" unit="pg" placeholder="30" low={27} high={33} value={form.mch} onChange={v => set('mch', v)} />
                      <LabField label="MCHC" unit="g/dL" placeholder="33" low={32} high={36} value={form.mchc} onChange={v => set('mchc', v)} />
                      <LabField label="Platelet Count" placeholder="250000" low={150000} high={410000} value={form.platelets} onChange={v => set('platelets', v)} step="1000" />
                      <LabField label="Neutrophils" unit="%" placeholder="60" low={40} high={75} value={form.neutrophils} onChange={v => set('neutrophils', v)} step="1" />
                      <LabField label="Lymphocytes" unit="%" placeholder="30" low={20} high={45} value={form.lymphocytes} onChange={v => set('lymphocytes', v)} step="1" />
                      <LabField label="Eosinophils" unit="%" placeholder="3" low={0} high={6} value={form.eosinophils} onChange={v => set('eosinophils', v)} step="1" />
                      <LabField label="Monocytes" unit="%" placeholder="5" low={2} high={10} value={form.monocytes} onChange={v => set('monocytes', v)} step="1" />
                    </div>
                  </div>
                )}

                {/* ── TAB: Biochemistry ── */}
                {activeTab === 'biochem' && (
                  <div>
                    <SectionHeader icon="🧪" title="Biochemistry" />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <LabField label="Sugar-Random" unit="mg/dL" placeholder="90" low={70} high={140} value={form.sugarRandom} onChange={v => set('sugarRandom', v)} step="1" />
                      <LabField label="Blood Urea" unit="mg/dL" placeholder="25" low={10} high={45} value={form.urea} onChange={v => set('urea', v)} step="1" />
                      <LabField label="BUN" unit="mg/dL" placeholder="12" low={6} high={20} value={form.bun} onChange={v => set('bun', v)} step="1" />
                      <LabField label="Creatinine" unit="mg/dL" placeholder="1.0" low={0.6} high={1.3} value={form.creatinine} onChange={v => set('creatinine', v)} />
                      <LabField label="Uric Acid" unit="mg/dL" placeholder="5.0" low={2.5} high={7.5} value={form.uricAcid} onChange={v => set('uricAcid', v)} />
                    </div>
                  </div>
                )}

                {/* ── TAB: Lipid Profile ── */}
                {activeTab === 'lipids' && (
                  <div>
                    <SectionHeader icon="💉" title="Lipid Profile" />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <LabField label="Total Cholesterol" unit="mg/dL" placeholder="180" low={0} high={200} value={form.totalCholesterol} onChange={v => set('totalCholesterol', v)} step="1" />
                      <LabField label="Triglyceride" unit="mg/dL" placeholder="120" low={0} high={150} value={form.triglyceride} onChange={v => set('triglyceride', v)} step="1" />
                      <LabField label="HDL Cholesterol" unit="mg/dL" placeholder="55" low={40} high={999} value={form.hdl} onChange={v => set('hdl', v)} step="1" />
                      <LabField label="LDL" unit="mg/dL" placeholder="100" low={0} high={130} value={form.ldl} onChange={v => set('ldl', v)} step="1" />
                      <LabField label="VLDL" unit="mg/dL" placeholder="24" low={0} high={30} value={form.vldl} onChange={v => set('vldl', v)} step="1" />
                    </div>
                    {(form.totalCholesterol && form.hdl) && (
                      <div className="mt-3 flex gap-4 text-xs text-muted bg-surface2 rounded-lg px-3 py-2">
                        <span>Chol/HDL Ratio: <strong className="text-text">{cholHdlRatio(form.totalCholesterol, form.hdl)}</strong></span>
                        {form.ldl && <span>LDL/HDL Ratio: <strong className="text-text">{ldlHdlRatio(form.ldl, form.hdl)}</strong></span>}
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB: LFT ── */}
                {activeTab === 'lft' && (
                  <div>
                    <SectionHeader icon="🫀" title="Liver Function Test (LFT)" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <LabField label="Bilirubin Total" unit="mg/dL" placeholder="0.8" low={0} high={1.2} value={form.bilirubinTotal} onChange={v => set('bilirubinTotal', v)} />
                      <LabField label="Bilirubin Direct" unit="mg/dL" placeholder="0.2" low={0} high={0.4} value={form.bilirubinDirect} onChange={v => set('bilirubinDirect', v)} />
                      <LabField label="Bilirubin Indirect" unit="mg/dL" placeholder="0.6" low={0} high={0.8} value={form.bilirubinIndirect} onChange={v => set('bilirubinIndirect', v)} />
                      <LabField label="SGOT (AST)" unit="U/L" placeholder="25" low={0} high={40} value={form.sgot} onChange={v => set('sgot', v)} step="1" />
                      <LabField label="SGPT (ALT)" unit="U/L" placeholder="20" low={0} high={40} value={form.sgpt} onChange={v => set('sgpt', v)} step="1" />
                      <LabField label="Alk. Phosphatase" unit="U/L" placeholder="80" low={44} high={147} value={form.alkPhosphatase} onChange={v => set('alkPhosphatase', v)} step="1" />
                      <LabField label="Total Protein" unit="g/dL" placeholder="7.0" low={6.0} high={8.3} value={form.totalProtein} onChange={v => set('totalProtein', v)} />
                      <LabField label="S. Albumin" unit="g/dL" placeholder="4.0" low={3.5} high={5.0} value={form.albumin} onChange={v => set('albumin', v)} />
                      <LabField label="Globulin" unit="g/dL" placeholder="3.0" low={2.0} high={3.5} value={form.globulin} onChange={v => set('globulin', v)} />
                    </div>
                    {(form.albumin && form.globulin) && (
                      <div className="mt-2 text-xs text-muted bg-surface2 rounded-lg px-3 py-2 inline-block">
                        A/G Ratio: <strong className="text-text">{agRatio(form.albumin, form.globulin)}</strong>
                        <span className="ml-2 text-muted">(Normal: 1.0–2.5)</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB: Urine ── */}
                {activeTab === 'urine' && (
                  <div>
                    <SectionHeader icon="🧫" title="Urine Analysis" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div><label className="field-label">Colour</label>
                        <select className="field-input" value={form.urineColour} onChange={e => set('urineColour', e.target.value)}>
                          {URINE_COLOUR.map(c => <option key={c}>{c}</option>)}
                        </select></div>
                      <div><label className="field-label">Appearance</label>
                        <select className="field-input" value={form.urineAppearance} onChange={e => set('urineAppearance', e.target.value)}>
                          {URINE_APPEAR.map(c => <option key={c}>{c}</option>)}
                        </select></div>
                      <div><label className="field-label">pH</label>
                        <input type="number" step="0.1" className="field-input" placeholder="6.5" value={form.urinePH} onChange={e => set('urinePH', e.target.value)} /></div>
                      <div><label className="field-label">Specific Gravity</label>
                        <input type="number" step="0.001" className="field-input" placeholder="1.015" value={form.urineSpGravity} onChange={e => set('urineSpGravity', e.target.value)} /></div>
                      <div><label className="field-label">Protein</label>
                        <select className="field-input" value={form.urineProtein} onChange={e => set('urineProtein', e.target.value)}>
                          {URINE_PROTEIN.map(p => <option key={p}>{p}</option>)}
                        </select></div>
                      <div><label className="field-label">Sugar</label>
                        <select className="field-input" value={form.urineSugar} onChange={e => set('urineSugar', e.target.value)}>
                          {URINE_SUGAR.map(s => <option key={s}>{s}</option>)}
                        </select></div>
                      <div><label className="field-label">Bilirubin</label>
                        <select className="field-input" value={form.urineBilirubin} onChange={e => set('urineBilirubin', e.target.value)}>
                          {URINE_BIL.map(b => <option key={b}>{b}</option>)}
                        </select></div>
                      <div><label className="field-label">Pus Cells /HPF</label>
                        <input className="field-input" placeholder="0-2" value={form.pusCells} onChange={e => set('pusCells', e.target.value)} /></div>
                      <div><label className="field-label">Epithelial /HPF</label>
                        <input className="field-input" placeholder="0-2" value={form.epithelialCells} onChange={e => set('epithelialCells', e.target.value)} /></div>
                      <div><label className="field-label">RBC /HPF</label>
                        <input className="field-input" placeholder="0-2" value={form.urineRBC} onChange={e => set('urineRBC', e.target.value)} /></div>
                    </div>
                  </div>
                )}

                {/* ── TAB: Special Investigations ── */}
                {activeTab === 'special' && (
                  <div>
                    <SectionHeader icon="📊" title="Special Investigations" />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div><label className="field-label">Vision</label>
                        <input className="field-input" placeholder="6/6 both" value={form.vision} onChange={e => set('vision', e.target.value)} /></div>
                      <div><label className="field-label">PFT (Lung Function)</label>
                        <select className="field-input" value={form.pft} onChange={e => set('pft', e.target.value)}>
                          {PFT_OPTS.map(o => <option key={o}>{o}</option>)}
                        </select></div>
                      <div><label className="field-label">Audiometry</label>
                        <select className="field-input" value={form.audiometry} onChange={e => set('audiometry', e.target.value)}>
                          {AUDIO_OPTS.map(o => <option key={o}>{o}</option>)}
                        </select></div>
                      <div><label className="field-label">ECG</label>
                        <select className="field-input" value={form.ecg} onChange={e => set('ecg', e.target.value)}>
                          {ECG_OPTS.map(o => <option key={o}>{o}</option>)}
                        </select></div>
                      <div><label className="field-label">X-Ray Chest</label>
                        <select className="field-input" value={form.xRayChest} onChange={e => set('xRayChest', e.target.value)}>
                          {XRAY_OPTS.map(o => <option key={o}>{o}</option>)}
                        </select></div>
                      <div className="col-span-2 md:col-span-3">
                        <label className="field-label">Occupational Exposure</label>
                        <input className="field-input" placeholder="Dust, chemicals, noise, vibration…" value={form.occupationalExposure} onChange={e => set('occupationalExposure', e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB: History ── */}
                {activeTab === 'history' && (
                  <div>
                    <SectionHeader icon="📋" title="Personal & Family History" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="field-label">Personal History</label>
                        <textarea className="field-input h-24 resize-none" placeholder="Diabetes, hypertension, allergies, surgeries…" value={form.personalHistory} onChange={e => set('personalHistory', e.target.value)} />
                      </div>
                      <div>
                        <label className="field-label">Family History</label>
                        <textarea className="field-input h-24 resize-none" placeholder="Cardiac disease, diabetes, cancer…" value={form.familyHistory} onChange={e => set('familyHistory', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <label className="field-label">Remarks / Doctor's Notes</label>
                        <textarea className="field-input h-20 resize-none" placeholder="Clinical observations, follow-up instructions…" value={form.remarks} onChange={e => set('remarks', e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            <div className="modal-footer shrink-0">
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Save Examination'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ VIEW MODAL ═══════ */}
      {viewRecord && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setViewRecord(null)}>
          <div className="modal-box w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">Periodic Exam — {viewRecord.examYear}</h2>
              <button onClick={() => setViewRecord(null)} className="text-muted hover:text-text text-xl leading-none">×</button>
            </div>
            <div className="modal-body space-y-4">
              {/* Employee header */}
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-lg font-bold text-blue-400">
                  {initials(viewRecord.employeeName)}
                </div>
                <div>
                  <div className="font-serif text-lg text-text">{viewRecord.employeeName}</div>
                  <div className="text-sm text-muted">{viewRecord.employeeId} · {viewRecord.department}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <FitBadge result={viewRecord.fitnessResult} />
                    {(() => { const { score } = calcIHI(employees.find(e => (e.empId||e.id) === viewRecord.employeeId) || {}, viewRecord, {}); return score > 0 ? <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: colorIHI(score)+'20', color: colorIHI(score) }}>IHI {score}</span> : null; })()}
                  </div>
                </div>
              </div>

              {/* Key values grid */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  ['BP', viewRecord.bp], ['Pulse', viewRecord.pulse ? `${viewRecord.pulse} bpm` : null],
                  ['Weight', viewRecord.weight ? `${viewRecord.weight} kg` : null],
                  ['Height', viewRecord.height ? `${viewRecord.height} cm` : null],
                  ['BMI', viewRecord.bmi], ['Haemoglobin', viewRecord.haemoglobin ? `${viewRecord.haemoglobin} g/dL` : null],
                  ['Blood Sugar', viewRecord.sugarRandom ? `${viewRecord.sugarRandom} mg/dL` : null],
                  ['Total Cholesterol', viewRecord.totalCholesterol ? `${viewRecord.totalCholesterol} mg/dL` : null],
                  ['SGOT', viewRecord.sgot ? `${viewRecord.sgot} U/L` : null],
                  ['SGPT', viewRecord.sgpt ? `${viewRecord.sgpt} U/L` : null],
                  ['Creatinine', viewRecord.creatinine ? `${viewRecord.creatinine} mg/dL` : null],
                  ['Vision', viewRecord.vision],
                ].filter(([,v]) => v).map(([l, v]) => (
                  <div key={l} className="bg-surface2 rounded-lg p-2">
                    <div className="text-muted mb-0.5">{l}</div>
                    <div className="font-semibold text-text">{v}</div>
                  </div>
                ))}
              </div>

              {/* Special investigations summary */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[['PFT', viewRecord.pft], ['Audiometry', viewRecord.audiometry], ['ECG', viewRecord.ecg], ['X-Ray', viewRecord.xRayChest]].map(([l,v]) => v && v !== 'Normal' && v !== 'Not Done' ? (
                  <div key={l} className="flex items-center gap-2 bg-amber-400/10 rounded-lg p-2">
                    <span>⚠️</span><span className="text-amber-400">{l}: {v}</span>
                  </div>
                ) : null)}
              </div>

              {/* YoY trend */}
              <YoYTrend records={empHistory} />

              {viewRecord.remarks && (
                <div>
                  <div className="section-label mb-1">Remarks</div>
                  <p className="text-sm text-muted bg-surface2 rounded-lg p-3">{viewRecord.remarks}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {canEdit && <button onClick={() => { setViewRecord(null); openEdit(viewRecord); }} className="btn-ghost">Edit</button>}
              <button onClick={() => setViewRecord(null)} className="btn-primary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteTarget && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-box w-full max-w-sm">
            <div className="modal-header"><h2 className="font-serif text-lg text-text">Delete Record</h2></div>
            <div className="modal-body"><p className="text-sm text-muted">Delete exam record for <span className="text-text font-medium">{deleteTarget.employeeName} ({deleteTarget.examYear})</span>? This cannot be undone.</p></div>
            <div className="modal-footer">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost">Cancel</button>
              <button onClick={handleDelete} className="btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
