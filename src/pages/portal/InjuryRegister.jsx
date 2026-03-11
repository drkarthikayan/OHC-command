import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy, onSnapshot, getDocs
} from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate, initials } from '../../utils/formatters';

// ── constants ─────────────────────────────────────────────────────────────────
const INJURY_TYPES = [
  'Laceration','Fracture','Burn','Contusion','Sprain',
  'Eye Injury','Chemical Exposure','Electrical Shock','Fall','Machinery Contact',
];
const WORK_RELATEDNESS = ['Work-Related','Commuting','Non-Occupational'];
const SEVERITY = [
  'Minor (First Aid)',
  'Moderate (Medical Treatment)',
  'Severe (Hospitalization)',
  'Fatal',
];
const OUTCOMES = [
  'Treated & Released',
  'Referred to Hospital',
  'Hospitalized',
  'Lost Work Days',
];
const OSHA_CATS = [
  'First Aid Only',
  'Medical Treatment',
  'Restricted Work',
  'Lost Time',
  'Hospitalization',
  'Fatality',
];
const BODY_PARTS = [
  'Head','Eye','Ear','Neck','Shoulder','Arm','Elbow','Wrist','Hand','Finger',
  'Chest','Back','Abdomen','Hip','Leg','Knee','Ankle','Foot','Toe','Multiple',
];
const STATUS_OPTS = ['Open','Under Treatment','Closed','Referred'];

const EMPTY = {
  employeeId: '', employeeName: '', department: '',
  injuryDate: new Date().toISOString().slice(0, 10),
  injuryType: 'Laceration',
  workRelatedness: 'Work-Related',
  bodyPart: '',
  severity: 'Minor (First Aid)',
  oshaCategory: 'First Aid Only',
  howItHappened: '',
  outcome: 'Treated & Released',
  hospitalReferred: '',
  lostWorkDays: '',
  status: 'Open',
  remarks: '',
};

// ── severity badge ────────────────────────────────────────────────────────────
function SevBadge({ severity }) {
  const map = {
    'Minor (First Aid)':           'bg-accent/10 text-accent',
    'Moderate (Medical Treatment)':'bg-amber-400/10 text-amber-400',
    'Severe (Hospitalization)':    'bg-orange-500/10 text-orange-400',
    'Fatal':                       'bg-red-600/10 text-red-500',
  };
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${map[severity] || 'bg-surface2 text-muted'}`}>{severity || '—'}</span>;
}

function StatusBadge({ status }) {
  const map = {
    'Open':            'bg-amber-400/10 text-amber-400',
    'Under Treatment': 'bg-blue-400/10 text-blue-400',
    'Closed':          'bg-accent/10 text-accent',
    'Referred':        'bg-purple-400/10 text-purple-400',
  };
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${map[status] || 'bg-surface2 text-muted'}`}>{status || '—'}</span>;
}

// ── OSHA rate calculator ──────────────────────────────────────────────────────
function calcRates(records, totalEmployees) {
  const hoursPerYear = totalEmployees * 2000; // 200k-hr basis
  const recordable   = records.filter(r => r.oshaCategory !== 'First Aid Only').length;
  const lostTime     = records.filter(r => r.oshaCategory === 'Lost Time' || r.oshaCategory === 'Fatality').length;
  const lostDays     = records.reduce((s, r) => s + (parseInt(r.lostWorkDays) || 0), 0);

  const trir = hoursPerYear > 0 ? ((recordable * 200000) / hoursPerYear).toFixed(2) : '0.00';
  const ltir = hoursPerYear > 0 ? ((lostTime  * 200000) / hoursPerYear).toFixed(2) : '0.00';
  const sr   = hoursPerYear > 0 ? ((lostDays  * 200000) / hoursPerYear).toFixed(2) : '0.00';

  // dominant ILO class
  const typeCounts = {};
  records.forEach(r => { typeCounts[r.injuryType] = (typeCounts[r.injuryType] || 0) + 1; });
  const iloClass = Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a])[0] || '—';

  return { trir, ltir, sr, lostDays, lostTime, recordable, iloClass };
}

// ── main component ────────────────────────────────────────────────────────────
export default function InjuryRegister() {
  const { tenant, staffUser } = useAuthStore();
  const tid  = tenant?.id;
  const role = staffUser?.role || 'staff';
  const canEdit = ['doctor','nurse','admin'].includes(role);

  const [records,    setRecords]    = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [form,       setForm]       = useState(EMPTY);
  const [viewRecord, setViewRecord] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // filters
  const [search,      setSearch]      = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterOsha,  setFilterOsha]  = useState('');

  // employee picker
  const [empSearch,   setEmpSearch]   = useState('');
  const [empDropdown, setEmpDropdown] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // load injury records
  useEffect(() => {
    if (!tid) return;
    const unsub = onSnapshot(
      query(collection(db, 'merchants', tid, 'injuries'), orderBy('createdAt', 'desc')),
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
    setEmpSearch(emp.name);
    setEmpDropdown(false);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY);
    setEmpSearch('');
    setShowForm(true);
  };

  const openEdit = (rec) => {
    setEditing(rec);
    setForm({ ...EMPTY, ...rec });
    setEmpSearch(rec.employeeName || '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.employeeId)  { toast.error('Select an employee.'); return; }
    if (!form.injuryDate)  { toast.error('Injury date is required.'); return; }
    if (!form.howItHappened.trim()) { toast.error('Describe how it happened.'); return; }
    setSaving(true);
    try {
      const payload = { ...form, updatedAt: serverTimestamp() };
      if (editing) {
        await updateDoc(doc(db, 'merchants', tid, 'injuries', editing.id), payload);
        toast.success('Injury record updated.');
      } else {
        await addDoc(collection(db, 'merchants', tid, 'injuries'),
          { ...payload, createdAt: serverTimestamp() });
        toast.success('Injury recorded.');
      }
      setShowForm(false);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'merchants', tid, 'injuries', deleteTarget.id));
      toast.success('Record deleted.');
    } catch (e) { toast.error(e.message); }
    finally { setDeleteTarget(null); }
  };

  // filter records
  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    const matchQ = !q || r.employeeName?.toLowerCase().includes(q) || r.employeeId?.toLowerCase().includes(q) || r.injuryType?.toLowerCase().includes(q);
    const matchM = !filterMonth || r.injuryDate?.startsWith(filterMonth);
    const matchO = !filterOsha  || r.oshaCategory === filterOsha;
    return matchQ && matchM && matchO;
  });

  // stats
  const thisMonth = records.filter(r => r.injuryDate?.startsWith(new Date().toISOString().slice(0, 7))).length;
  const rates     = calcRates(records, employees.length);

  // month options from records
  const months = [...new Set(records.map(r => r.injuryDate?.slice(0, 7)).filter(Boolean))].sort().reverse();

  return (
    <div className="p-6 max-w-6xl">

      {/* ── header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-text">Injury Register</h1>
          <p className="text-muted text-sm mt-0.5">ILO C161 Art.5(d) · OSHA 300 Log — Full injury documentation & tracking</p>
        </div>
        {canEdit && <button onClick={openAdd} className="btn-primary">+ Record Injury</button>}
      </div>

      {/* ── summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'Total Injuries', value: records.length,    icon: '🩹', color: 'text-accent' },
          { label: 'Lost Time',      value: rates.lostTime,    icon: '⏱️', color: 'text-amber-400' },
          { label: 'Lost Days',      value: rates.lostDays,    icon: '📅', color: 'text-orange-400' },
          { label: 'This Month',     value: thisMonth,          icon: '📆', color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className={`font-serif text-3xl ${s.color} mb-0.5`}>{loading ? '—' : s.value}</div>
            <div className="text-xs text-muted uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── OSHA rates ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'OSHA TRIR',     value: rates.trir,     desc: 'Total Recordable Incident Rate' },
          { label: 'OSHA LTIR',     value: rates.ltir,     desc: 'Lost Time Incident Rate' },
          { label: 'Severity Rate', value: rates.sr,       desc: 'Lost Days per 200K Hours' },
          { label: 'ILO Class',     value: rates.iloClass, desc: 'Dominant Injury Category' },
        ].map(s => (
          <div key={s.label} className="card p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-0.5">{s.label}</div>
            <div className="font-serif text-xl text-text truncate">{loading ? '—' : s.value}</div>
            <div className="text-[10px] text-muted mt-0.5">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* ── filters ── */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input className="field-input w-60" placeholder="Search name, ID, injury type…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="field-input w-40" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          <option value="">All Months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="field-input w-52" value={filterOsha} onChange={e => setFilterOsha(e.target.value)}>
          <option value="">All OSHA Categories</option>
          {OSHA_CATS.map(c => <option key={c}>{c}</option>)}
        </select>
        {(search || filterMonth || filterOsha) && (
          <button onClick={() => { setSearch(''); setFilterMonth(''); setFilterOsha(''); }}
            className="btn-ghost text-sm">Clear</button>
        )}
      </div>

      {/* ── records table ── */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_90px_1fr_60px_80px_70px] gap-2 px-4 py-2.5 bg-surface2 border-b border-border">
          {['Employee','ILO Type','Date','OSHA Category','Lost Days','Severity',''].map(h => (
            <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>
          ))}
        </div>
        {loading
          ? <div className="py-12 text-center text-muted text-sm">Loading records…</div>
          : filtered.length === 0
            ? <div className="py-14 text-center">
                <div className="text-4xl mb-3">🩹</div>
                <div className="text-muted text-sm">{records.length === 0 ? 'No injuries recorded yet.' : 'No records match your filters.'}</div>
              </div>
            : filtered.map(rec => (
              <div key={rec.id}
                className="grid grid-cols-[2fr_1fr_90px_1fr_60px_80px_70px] gap-2 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors items-center">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-xs font-bold text-red-400 shrink-0">
                    {initials(rec.employeeName)}
                  </div>
                  <div className="min-w-0">
                    <button onClick={() => setViewRecord(rec)}
                      className="text-sm font-medium text-text hover:text-accent truncate block text-left">
                      {rec.employeeName}
                    </button>
                    <div className="text-xs text-muted">{rec.employeeId} · {rec.department}</div>
                  </div>
                </div>
                <div className="text-xs text-muted truncate">{rec.injuryType}</div>
                <div className="text-xs text-muted">{rec.injuryDate ? fmtDate(rec.injuryDate) : '—'}</div>
                <div className="text-xs text-muted truncate">{rec.oshaCategory}</div>
                <div className="text-sm text-center font-medium text-text">{rec.lostWorkDays || '0'}</div>
                <SevBadge severity={rec.severity} />
                <div className="flex gap-1">
                  {canEdit && <button onClick={() => openEdit(rec)} className="text-muted hover:text-accent text-sm p-1">✏️</button>}
                  {canEdit && <button onClick={() => setDeleteTarget(rec)} className="text-muted hover:text-red-400 text-sm p-1">🗑️</button>}
                </div>
              </div>
            ))
        }
      </div>

      {/* ════════════ ADD / EDIT MODAL ════════════ */}
      {showForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-box w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">{editing ? 'Edit Injury Record' : 'Record Occupational Injury'}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-text text-xl leading-none">×</button>
            </div>
            <div className="modal-body space-y-5">

              {/* Employee picker */}
              <div>
                <div className="section-label mb-3">👤 Injured Employee</div>
                <div className="relative">
                  <label className="field-label">Search Employee *</label>
                  <input className="field-input" placeholder="Type name or ID…"
                    value={empSearch}
                    onChange={e => { setEmpSearch(e.target.value); setEmpDropdown(true); }}
                    onFocus={() => setEmpDropdown(true)}
                  />
                  {empDropdown && empSearch && filteredEmps.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-lg shadow-xl overflow-hidden">
                      {filteredEmps.map(emp => (
                        <button key={emp.id}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-surface2 text-left transition-colors"
                          onMouseDown={() => selectEmployee(emp)}>
                          <div className="w-7 h-7 rounded-full bg-green/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                            {initials(emp.name)}
                          </div>
                          <div>
                            <div className="text-sm text-text">{emp.name}</div>
                            <div className="text-xs text-muted">{emp.empId} · {emp.department}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {form.employeeId && (
                  <div className="mt-2 text-xs text-muted flex items-center gap-1.5">
                    <span className="text-accent">✓</span>
                    <span>{form.employeeName}</span>
                    <span>·</span><span>{form.employeeId}</span>
                    {form.department && <><span>·</span><span>{form.department}</span></>}
                  </div>
                )}
              </div>

              {/* Injury details */}
              <div>
                <div className="section-label mb-3">🩹 Injury Details</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Injury Date *</label>
                    <input type="date" className="field-input" value={form.injuryDate} onChange={e => set('injuryDate', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Injury Type (ILO)</label>
                    <select className="field-input" value={form.injuryType} onChange={e => set('injuryType', e.target.value)}>
                      {INJURY_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Work-Relatedness</label>
                    <select className="field-input" value={form.workRelatedness} onChange={e => set('workRelatedness', e.target.value)}>
                      {WORK_RELATEDNESS.map(w => <option key={w}>{w}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Body Part Affected</label>
                    <select className="field-input" value={form.bodyPart} onChange={e => set('bodyPart', e.target.value)}>
                      <option value="">Select…</option>
                      {BODY_PARTS.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Severity</label>
                    <select className="field-input" value={form.severity} onChange={e => set('severity', e.target.value)}>
                      {SEVERITY.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">OSHA Category</label>
                    <select className="field-input" value={form.oshaCategory} onChange={e => set('oshaCategory', e.target.value)}>
                      {OSHA_CATS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* How it happened */}
              <div>
                <label className="field-label">How It Happened *</label>
                <textarea className="field-input w-full h-20 resize-none"
                  placeholder="Describe the sequence of events leading to the injury…"
                  value={form.howItHappened} onChange={e => set('howItHappened', e.target.value)} />
              </div>

              {/* Outcome */}
              <div>
                <div className="section-label mb-3">🏥 Outcome & Follow-up</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Outcome</label>
                    <select className="field-input" value={form.outcome} onChange={e => set('outcome', e.target.value)}>
                      {OUTCOMES.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Lost Work Days</label>
                    <input type="number" min="0" className="field-input" placeholder="0"
                      value={form.lostWorkDays} onChange={e => set('lostWorkDays', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Hospital Referred</label>
                    <input className="field-input" placeholder="Hospital name (if referred)"
                      value={form.hospitalReferred} onChange={e => set('hospitalReferred', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Status</label>
                    <select className="field-input" value={form.status} onChange={e => set('status', e.target.value)}>
                      {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="field-label">Remarks / Additional Notes</label>
                    <textarea className="field-input w-full h-16 resize-none" placeholder="Any additional notes…"
                      value={form.remarks} onChange={e => set('remarks', e.target.value)} />
                  </div>
                </div>
              </div>

            </div>
            <div className="modal-footer">
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Record Injury'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ VIEW MODAL ════════════ */}
      {viewRecord && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setViewRecord(null)}>
          <div className="modal-box w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">Injury Record</h2>
              <button onClick={() => setViewRecord(null)} className="text-muted hover:text-text text-xl leading-none">×</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-lg font-bold text-red-400">
                  {initials(viewRecord.employeeName)}
                </div>
                <div>
                  <div className="font-serif text-lg text-text">{viewRecord.employeeName}</div>
                  <div className="text-sm text-muted">{viewRecord.employeeId} · {viewRecord.department}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <SevBadge severity={viewRecord.severity} />
                    <StatusBadge status={viewRecord.status} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Date',           fmtDate(viewRecord.injuryDate)],
                  ['Injury Type',    viewRecord.injuryType],
                  ['Work-Relatedness', viewRecord.workRelatedness],
                  ['Body Part',      viewRecord.bodyPart],
                  ['OSHA Category',  viewRecord.oshaCategory],
                  ['Lost Work Days', viewRecord.lostWorkDays || '0'],
                  ['Outcome',        viewRecord.outcome],
                  ['Hospital',       viewRecord.hospitalReferred || '—'],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between border-b border-border/30 pb-1">
                    <span className="text-muted">{l}</span>
                    <span className="text-text font-medium text-right">{v}</span>
                  </div>
                ))}
              </div>
              {viewRecord.howItHappened && (
                <div>
                  <div className="section-label mb-1">How It Happened</div>
                  <p className="text-sm text-muted bg-surface2 rounded-lg p-3">{viewRecord.howItHappened}</p>
                </div>
              )}
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
            <div className="modal-body">
              <p className="text-sm text-muted">Delete injury record for <span className="text-text font-medium">{deleteTarget.employeeName}</span>? This cannot be undone.</p>
            </div>
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
