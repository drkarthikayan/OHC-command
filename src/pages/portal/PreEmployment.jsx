import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy, onSnapshot, getDocs
} from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate, initials } from '../../utils/formatters';
import { calcIHI, colorIHI, gradeIHI } from '../../utils/ihi';

// ── constants ─────────────────────────────────────────────────────────────────
const FITNESS = ['Fit', 'Fit with Restriction', 'Unfit'];
const HEARING  = ['Normal', 'Mild Loss', 'Moderate Loss', 'Severe Loss'];
const LUNG     = ['Normal', 'Mild Obstruction', 'Moderate Obstruction', 'Severe Obstruction'];
const ECG_OPT  = ['Normal', 'Abnormal', 'Not Done'];
const URINE_OPT= ['Normal', 'Abnormal'];

const EMPTY = {
  employeeId: '', employeeName: '', department: '', gender: '',
  examDate: new Date().toISOString().slice(0, 10),
  fitnessResult: 'Fit',
  // Vitals
  bp: '', pulse: '', weight: '', height: '',
  // Labs
  visionR: '', visionL: '', haemoglobin: '', bloodSugar: '',
  hearing: 'Normal', lungFunction: 'Normal',
  ecg: 'Normal', urine: 'Normal',
  // Remarks
  remarks: '',
};

// ── IHI badge ─────────────────────────────────────────────────────────────────
function IHIBadge({ exam, employee }) {
  const { score } = calcIHI(employee || {}, exam, {});
  if (!score) return null;
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: colorIHI(score) + '20', color: colorIHI(score) }}>
      IHI {score}
    </span>
  );
}

// ── fitness badge ─────────────────────────────────────────────────────────────
function FitBadge({ result }) {
  const map = {
    'Fit':                  'bg-accent/10 text-accent',
    'Fit with Restriction': 'bg-amber-400/10 text-amber-400',
    'Unfit':                'bg-red-500/10 text-red-400',
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[result] || 'bg-surface2 text-muted'}`}>{result || '—'}</span>;
}

// ── BMI helper ────────────────────────────────────────────────────────────────
function bmi(w, h) {
  const wf = parseFloat(w), hf = parseFloat(h);
  if (!wf || !hf || hf <= 0) return null;
  return (wf / ((hf / 100) ** 2)).toFixed(1);
}

// ── main component ────────────────────────────────────────────────────────────
export default function PreEmployment() {
  const { tenant, staffUser } = useAuthStore();
  const tid = tenant?.id;
  const role = staffUser?.role || 'staff';
  const canEdit = ['doctor', 'nurse', 'admin'].includes(role);

  const [records, setRecords]       = useState([]);
  const [employees, setEmployees]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(EMPTY);
  const [empSearch, setEmpSearch]   = useState('');
  const [empDropdown, setEmpDropdown] = useState(false);
  const [search, setSearch]         = useState('');
  const [filterResult, setFilterResult] = useState('');
  const [viewRecord, setViewRecord] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // load records
  useEffect(() => {
    if (!tid) return;
    const unsub = onSnapshot(
      query(collection(db, 'merchants', tid, 'preEmployment'), orderBy('createdAt', 'desc')),
      snap => { setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, [tid]);

  // load employees for picker
  useEffect(() => {
    if (!tid) return;
    getDocs(collection(db, 'merchants', tid, 'employees'))
      .then(snap => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
  }, [tid]);

  // employee picker filter
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
    if (!form.employeeId) { toast.error('Select an employee.'); return; }
    if (!form.examDate)   { toast.error('Exam date is required.'); return; }
    setSaving(true);
    try {
      const payload = { ...form, updatedAt: serverTimestamp() };
      if (editing) {
        await updateDoc(doc(db, 'merchants', tid, 'preEmployment', editing.id), payload);
        // also update employee fitness status
        const empDoc = employees.find(e => (e.empId || e.id) === form.employeeId);
        if (empDoc) {
          await updateDoc(doc(db, 'merchants', tid, 'employees', empDoc.id),
            { fitnessStatus: form.fitnessResult, updatedAt: serverTimestamp() });
        }
        toast.success('Record updated.');
      } else {
        await addDoc(collection(db, 'merchants', tid, 'preEmployment'),
          { ...payload, createdAt: serverTimestamp() });
        // update employee fitness status
        const empDoc = employees.find(e => (e.empId || e.id) === form.employeeId);
        if (empDoc) {
          await updateDoc(doc(db, 'merchants', tid, 'employees', empDoc.id),
            { fitnessStatus: form.fitnessResult, updatedAt: serverTimestamp() });
        }
        toast.success('Pre-employment exam saved.');
      }
      setShowForm(false);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'merchants', tid, 'preEmployment', deleteTarget.id));
      toast.success('Record deleted.');
    } catch (e) { toast.error(e.message); }
    finally { setDeleteTarget(null); }
  };

  // filtered records
  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.employeeName?.toLowerCase().includes(q) || r.employeeId?.toLowerCase().includes(q) || r.department?.toLowerCase().includes(q))
      && (!filterResult || r.fitnessResult === filterResult);
  });

  // summary stats
  const fit       = records.filter(r => r.fitnessResult === 'Fit').length;
  const restricted= records.filter(r => r.fitnessResult === 'Fit with Restriction').length;
  const unfit     = records.filter(r => r.fitnessResult === 'Unfit').length;

  const bmiVal = bmi(form.weight, form.height);

  return (
    <div className="p-6 max-w-6xl">

      {/* ── header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-text">Pre-Employment Medical Exam</h1>
          <p className="text-muted text-sm mt-0.5">ILO C161 Art.5(a) · Fitness assessment before commencement</p>
        </div>
        {canEdit && <button onClick={openAdd} className="btn-primary">+ New Examination</button>}
      </div>

      {/* ── summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Exams',       value: records.length, icon: '📋', color: 'text-accent' },
          { label: 'Fit',               value: fit,            icon: '✅', color: 'text-accent' },
          { label: 'Fit w/ Restriction',value: restricted,     icon: '⚠️', color: 'text-amber-400' },
          { label: 'Unfit',             value: unfit,          icon: '❌', color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className={`font-serif text-3xl ${s.color} mb-0.5`}>{loading ? '—' : s.value}</div>
            <div className="text-xs text-muted uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── filters ── */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input className="field-input w-64" placeholder="Search name, ID, department…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="field-input w-52" value={filterResult} onChange={e => setFilterResult(e.target.value)}>
          <option value="">All Results</option>
          {FITNESS.map(f => <option key={f}>{f}</option>)}
        </select>
      </div>

      {/* ── records table ── */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_100px_80px_80px_100px_80px] gap-2 px-4 py-2.5 bg-surface2 border-b border-border">
          {['Employee', 'Department', 'Exam Date', 'BP', 'Hb', 'Result', ''].map(h => (
            <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>
          ))}
        </div>
        {loading
          ? <div className="py-12 text-center text-muted text-sm">Loading records…</div>
          : filtered.length === 0
            ? <div className="py-14 text-center">
                <div className="text-4xl mb-3">📋</div>
                <div className="text-muted text-sm">{records.length === 0 ? 'No examinations recorded yet.' : 'No records match your search.'}</div>
              </div>
            : filtered.map(rec => (
              <div key={rec.id}
                className="grid grid-cols-[2fr_1fr_100px_80px_80px_100px_80px] gap-2 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors items-center">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-green/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                    {initials(rec.employeeName)}
                  </div>
                  <div className="min-w-0">
                    <button onClick={() => setViewRecord(rec)}
                      className="text-sm font-medium text-text hover:text-accent truncate block text-left">
                      {rec.employeeName}
                    </button>
                    <div className="text-xs text-muted">{rec.employeeId}</div>
                  </div>
                </div>
                <div className="text-sm text-muted truncate">{rec.department || '—'}</div>
                <div className="text-sm text-muted">{rec.examDate ? fmtDate(rec.examDate) : '—'}</div>
                <div className="text-sm text-muted">{rec.bp || '—'}</div>
                <div className="text-sm text-muted">{rec.haemoglobin ? `${rec.haemoglobin} g` : '—'}</div>
                <FitBadge result={rec.fitnessResult} />
                <div className="flex gap-1">
                  {canEdit && <button onClick={() => openEdit(rec)} className="text-muted hover:text-accent text-sm p-1">✏️</button>}
                  {canEdit && <button onClick={() => setDeleteTarget(rec)} className="text-muted hover:text-red-400 text-sm p-1">🗑️</button>}
                </div>
              </div>
            ))
        }
      </div>

      {/* ════════════════════════════════════════════
          ADD / EDIT MODAL
      ════════════════════════════════════════════ */}
      {showForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-box w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">{editing ? 'Edit Examination' : 'Pre-Employment Medical Examination'}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-text text-xl leading-none">×</button>
            </div>
            <div className="modal-body space-y-6">

              {/* ── Employee picker ── */}
              <div>
                <div className="section-label mb-3">👤 Patient</div>
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
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <span className="text-accent">✓</span>
                    <span>{form.employeeName}</span>
                    <span>·</span><span>{form.employeeId}</span>
                    {form.department && <><span>·</span><span>{form.department}</span></>}
                    {form.gender && <><span>·</span><span>{form.gender}</span></>}
                  </div>
                )}
              </div>

              {/* ── Exam details ── */}
              <div>
                <div className="section-label mb-3">🗓️ Examination Details</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Exam Date *</label>
                    <input type="date" className="field-input" value={form.examDate} onChange={e => set('examDate', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Fitness Result *</label>
                    <select className="field-input" value={form.fitnessResult} onChange={e => set('fitnessResult', e.target.value)}>
                      {FITNESS.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Vital signs ── */}
              <div>
                <div className="section-label mb-3">💗 Vital Signs</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="field-label">Blood Pressure</label>
                    <input className="field-input" placeholder="120/80" value={form.bp} onChange={e => set('bp', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Pulse (bpm)</label>
                    <input type="number" className="field-input" placeholder="72" value={form.pulse} onChange={e => set('pulse', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Weight (kg)</label>
                    <input type="number" className="field-input" placeholder="70" value={form.weight} onChange={e => set('weight', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Height (cm)</label>
                    <input type="number" className="field-input" placeholder="170" value={form.height} onChange={e => set('height', e.target.value)} />
                  </div>
                </div>
                {bmiVal && (
                  <div className="mt-2 text-xs text-muted">
                    BMI: <span className="font-semibold text-text">{bmiVal}</span>
                    <span className="ml-2">{parseFloat(bmiVal) < 18.5 ? '· Underweight' : parseFloat(bmiVal) < 25 ? '· Normal ✓' : parseFloat(bmiVal) < 30 ? '· Overweight' : '· Obese'}</span>
                  </div>
                )}
              </div>

              {/* ── Laboratory investigations ── */}
              <div>
                <div className="section-label mb-3">🔬 Laboratory Investigations</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="field-label">Vision — Right Eye</label>
                    <input className="field-input" placeholder="6/6" value={form.visionR} onChange={e => set('visionR', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Vision — Left Eye</label>
                    <input className="field-input" placeholder="6/6" value={form.visionL} onChange={e => set('visionL', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Haemoglobin (g/dL)</label>
                    <input type="number" step="0.1" className="field-input" placeholder="14.0" value={form.haemoglobin} onChange={e => set('haemoglobin', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Blood Sugar (mg/dL)</label>
                    <input type="number" className="field-input" placeholder="90" value={form.bloodSugar} onChange={e => set('bloodSugar', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Hearing</label>
                    <select className="field-input" value={form.hearing} onChange={e => set('hearing', e.target.value)}>
                      {HEARING.map(h => <option key={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Lung Function (PFT)</label>
                    <select className="field-input" value={form.lungFunction} onChange={e => set('lungFunction', e.target.value)}>
                      {LUNG.map(l => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">ECG</label>
                    <select className="field-input" value={form.ecg} onChange={e => set('ecg', e.target.value)}>
                      {ECG_OPT.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Urine Analysis</label>
                    <select className="field-input" value={form.urine} onChange={e => set('urine', e.target.value)}>
                      {URINE_OPT.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Remarks ── */}
              <div>
                <div className="section-label mb-3">📝 Clinical Findings</div>
                <textarea className="field-input w-full h-20 resize-none" placeholder="Clinical findings, restrictions, remarks…"
                  value={form.remarks} onChange={e => set('remarks', e.target.value)} />
              </div>

              {/* ── IHI Preview ── */}
              {form.employeeId && (
                <div className="rounded-lg border border-border bg-surface2 p-3 flex items-center gap-3">
                  <span className="text-sm text-muted">Projected IHI Score:</span>
                  {(() => {
                    const emp = employees.find(e => (e.empId || e.id) === form.employeeId) || {};
                    const { score } = calcIHI(emp, form, {});
                    return (
                      <span className="text-sm font-bold px-2 py-0.5 rounded-full"
                        style={{ background: colorIHI(score) + '20', color: colorIHI(score) }}>
                        {score} / 100 — {gradeIHI(score)}
                      </span>
                    );
                  })()}
                  <span className="text-xs text-muted ml-1">(based on current form values)</span>
                </div>
              )}

            </div>
            <div className="modal-footer">
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Save Examination'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          VIEW RECORD MODAL
      ════════════════════════════════════════════ */}
      {viewRecord && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setViewRecord(null)}>
          <div className="modal-box w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">Examination Record</h2>
              <button onClick={() => setViewRecord(null)} className="text-muted hover:text-text text-xl leading-none">×</button>
            </div>
            <div className="modal-body space-y-4">
              {/* Employee info */}
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green/20 to-green2/20 flex items-center justify-center text-lg font-bold text-accent">
                  {initials(viewRecord.employeeName)}
                </div>
                <div>
                  <div className="font-serif text-lg text-text">{viewRecord.employeeName}</div>
                  <div className="text-sm text-muted">{viewRecord.employeeId} · {viewRecord.department || 'N/A'}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <FitBadge result={viewRecord.fitnessResult} />
                    <IHIBadge exam={viewRecord} employee={employees.find(e => (e.empId || e.id) === viewRecord.employeeId)} />
                  </div>
                </div>
              </div>

              {/* Exam date */}
              <div className="text-sm text-muted">Examined on <span className="text-text font-medium">{fmtDate(viewRecord.examDate)}</span></div>

              {/* Vitals */}
              <div>
                <div className="section-label mb-2">Vital Signs</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[['Blood Pressure', viewRecord.bp], ['Pulse', viewRecord.pulse ? `${viewRecord.pulse} bpm` : null],
                    ['Weight', viewRecord.weight ? `${viewRecord.weight} kg` : null], ['Height', viewRecord.height ? `${viewRecord.height} cm` : null],
                    ['BMI', bmi(viewRecord.weight, viewRecord.height)],
                  ].map(([l, v]) => v ? (
                    <div key={l} className="flex justify-between border-b border-border/30 pb-1">
                      <span className="text-muted">{l}</span><span className="text-text font-medium">{v}</span>
                    </div>
                  ) : null)}
                </div>
              </div>

              {/* Lab */}
              <div>
                <div className="section-label mb-2">Laboratory Investigations</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[['Vision R', viewRecord.visionR], ['Vision L', viewRecord.visionL],
                    ['Haemoglobin', viewRecord.haemoglobin ? `${viewRecord.haemoglobin} g/dL` : null],
                    ['Blood Sugar', viewRecord.bloodSugar ? `${viewRecord.bloodSugar} mg/dL` : null],
                    ['Hearing', viewRecord.hearing], ['Lung Function', viewRecord.lungFunction],
                    ['ECG', viewRecord.ecg], ['Urine', viewRecord.urine],
                  ].map(([l, v]) => v ? (
                    <div key={l} className="flex justify-between border-b border-border/30 pb-1">
                      <span className="text-muted">{l}</span><span className="text-text font-medium">{v}</span>
                    </div>
                  ) : null)}
                </div>
              </div>

              {viewRecord.remarks && (
                <div>
                  <div className="section-label mb-1">Clinical Findings</div>
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
              <p className="text-sm text-muted">Delete examination record for <span className="text-text font-medium">{deleteTarget.employeeName}</span>? This cannot be undone.</p>
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
