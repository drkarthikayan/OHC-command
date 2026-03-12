import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

/* ── Status config ── */
const STATUS = {
  pending:    { label: 'Pending',    bg: 'bg-amber-100',   txt: 'text-amber-700',   dot: 'bg-amber-400'   },
  referred:   { label: 'Referred',   bg: 'bg-blue-100',    txt: 'text-blue-700',    dot: 'bg-blue-400'    },
  attended:   { label: 'Attended',   bg: 'bg-purple-100',  txt: 'text-purple-700',  dot: 'bg-purple-400'  },
  completed:  { label: 'Completed',  bg: 'bg-emerald-100', txt: 'text-emerald-700', dot: 'bg-emerald-400' },
  cancelled:  { label: 'Cancelled',  bg: 'bg-red-100',     txt: 'text-red-700',     dot: 'bg-red-400'     },
};

const URGENCY = {
  routine:   { label: 'Routine',   bg: 'bg-slate-100',   txt: 'text-slate-600'   },
  urgent:    { label: 'Urgent',    bg: 'bg-amber-100',   txt: 'text-amber-700'   },
  emergency: { label: 'Emergency', bg: 'bg-red-100',     txt: 'text-red-700'     },
};

const SPECIALTIES = [
  'General Physician','Cardiologist','Orthopedic','Neurologist','Dermatologist',
  'Ophthalmologist','ENT Specialist','Pulmonologist','Gastroenterologist',
  'Psychiatrist','Physiotherapist','Radiologist','Pathologist','Surgeon','Other',
];

const EMPTY_FORM = {
  employeeId:'', employeeName:'', department:'', age:'', gender:'',
  referralDate: new Date().toISOString().split('T')[0],
  specialty:'', hospitalName:'', doctorName:'',
  urgency:'routine', reason:'', clinicalNotes:'', diagnosis:'',
  visitId:'', status:'pending', feedback:'', followUpDate:'',
};

export default function Referrals() {
  const { tenant } = useAuthStore();
  const tenantId = tenant?.id;

  const [referrals, setReferrals]     = useState([]);
  const [employees, setEmployees]     = useState([]);
  const [visits, setVisits]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editReferral, setEditReferral] = useState(null);  // for status update drawer
  const [form, setForm]               = useState(EMPTY_FORM);
  const [empSearch, setEmpSearch]     = useState('');
  const [empSugg, setEmpSugg]         = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterUrgency, setFilterUrgency] = useState('all');
  const [search, setSearch]           = useState('');
  const [saving, setSaving]           = useState(false);

  /* ── Load data ── */
  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [empSnap, visitSnap, refSnap] = await Promise.all([
          getDocs(collection(db, `merchants/${tenantId}/employees`)),
          getDocs(query(collection(db, `merchants/${tenantId}/opd_visits`), orderBy('createdAt','desc'))),
          getDocs(query(collection(db, `merchants/${tenantId}/referrals`), orderBy('createdAt','desc'))),
        ]);
        setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setVisits(visitSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setReferrals(refSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch(e) { toast.error('Failed to load referrals'); }
      setLoading(false);
    };
    load();
  }, [tenantId]);

  /* ── Employee search ── */
  useEffect(() => {
    if (!empSearch.trim()) { setEmpSugg([]); return; }
    const q = empSearch.toLowerCase();
    setEmpSugg(employees.filter(e =>
      e.name?.toLowerCase().includes(q) || e.employeeId?.toLowerCase().includes(q)
    ).slice(0, 6));
  }, [empSearch, employees]);

  const pickEmployee = (emp) => {
    setForm(f => ({ ...f,
      employeeId: emp.employeeId || emp.id,
      employeeName: emp.name || '',
      department: emp.department || '',
      age: emp.age || '',
      gender: emp.gender || '',
    }));
    setEmpSearch(emp.name || '');
    setEmpSugg([]);
    // Load their recent visits
  };

  /* ── Save referral ── */
  const handleSave = async () => {
    if (!form.employeeName || !form.specialty || !form.reason) {
      toast.error('Employee, specialty and reason are required');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, tenantId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      const docRef = await addDoc(collection(db, `merchants/${tenantId}/referrals`), payload);
      const newRef = { id: docRef.id, ...payload, createdAt: new Date(), updatedAt: new Date() };
      setReferrals(prev => [newRef, ...prev]);
      toast.success('Referral created successfully');
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEmpSearch('');
    } catch(e) { toast.error('Failed to save referral'); }
    setSaving(false);
  };

  /* ── Update status / feedback ── */
  const handleUpdateStatus = async (ref, newStatus, feedback, followUpDate) => {
    try {
      await updateDoc(doc(db, `merchants/${tenantId}/referrals`, ref.id), {
        status: newStatus, feedback, followUpDate, updatedAt: serverTimestamp(),
      });
      setReferrals(prev => prev.map(r => r.id === ref.id
        ? { ...r, status: newStatus, feedback, followUpDate }
        : r
      ));
      toast.success('Referral updated');
      setEditReferral(null);
    } catch(e) { toast.error('Update failed'); }
  };

  /* ── Filter & search ── */
  const filtered = referrals.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterUrgency !== 'all' && r.urgency !== filterUrgency) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.employeeName?.toLowerCase().includes(q) &&
          !r.specialty?.toLowerCase().includes(q) &&
          !r.hospitalName?.toLowerCase().includes(q) &&
          !r.employeeId?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  /* ── Stats ── */
  const stats = {
    total:     referrals.length,
    pending:   referrals.filter(r => r.status === 'pending').length,
    inProgress:referrals.filter(r => ['referred','attended'].includes(r.status)).length,
    completed: referrals.filter(r => r.status === 'completed').length,
    emergency: referrals.filter(r => r.urgency === 'emergency').length,
  };

  const fmt = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
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
          <h1 className="text-2xl font-display font-bold text-text">Referral Management</h1>
          <p className="text-sm text-muted mt-0.5">{referrals.length} total referrals</p>
        </div>
        <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM); setEmpSearch(''); }}
          className="btn-primary flex items-center gap-2">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
          New Referral
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label:'Total',       val: stats.total,      color:'text-text',          bg:'bg-white'        },
          { label:'Pending',     val: stats.pending,    color:'text-amber-600',     bg:'bg-amber-50'     },
          { label:'In Progress', val: stats.inProgress, color:'text-blue-600',      bg:'bg-blue-50'      },
          { label:'Completed',   val: stats.completed,  color:'text-emerald-600',   bg:'bg-emerald-50'   },
          { label:'Emergency',   val: stats.emergency,  color:'text-red-600',       bg:'bg-red-50'       },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-border`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-muted mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search employee, specialty, hospital…"
          className="input flex-1 min-w-48 text-sm" />
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="input text-sm w-36">
          <option value="all">All Statuses</option>
          {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterUrgency} onChange={e=>setFilterUrgency(e.target.value)} className="input text-sm w-36">
          <option value="all">All Urgency</option>
          {Object.entries(URGENCY).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface2 text-xs text-muted uppercase tracking-wide">
              <th className="text-left px-4 py-3">Employee</th>
              <th className="text-left px-4 py-3">Specialty</th>
              <th className="text-left px-4 py-3">Hospital / Doctor</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Urgency</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center text-muted py-12">
                <div className="text-3xl mb-2">🏥</div>
                <div>No referrals found</div>
              </td></tr>
            )}
            {filtered.map(r => {
              const st = STATUS[r.status] || STATUS.pending;
              const ug = URGENCY[r.urgency] || URGENCY.routine;
              return (
                <tr key={r.id} className="border-b border-border hover:bg-surface2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-sage/20 text-sage flex items-center justify-center text-xs font-bold">
                        {(r.employeeName||'?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-text">{r.employeeName || '—'}</div>
                        <div className="text-xs text-muted">{r.department || r.employeeId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text font-medium">{r.specialty || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="text-text">{r.hospitalName || '—'}</div>
                    {r.doctorName && <div className="text-xs text-muted">Dr. {r.doctorName}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted">{r.referralDate || fmt(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ug.bg} ${ug.txt}`}>
                      {ug.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${st.bg} ${st.txt}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditReferral({...r, _feedback: r.feedback||'', _status: r.status, _followUp: r.followUpDate||''})}
                      className="text-xs text-sage hover:text-sage2 font-medium">
                      Update →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── New Referral Form Drawer ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)}/>
          <div className="relative ml-auto w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-sage text-white">
              <div>
                <h2 className="text-lg font-display font-bold">New Referral</h2>
                <p className="text-xs text-white/70 mt-0.5">Refer employee to external specialist</p>
              </div>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Employee search */}
              <div>
                <label className="label">Employee *</label>
                <div className="relative">
                  <input value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                    placeholder="Search by name or ID…" className="input w-full" />
                  {empSugg.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-border rounded-lg shadow-lg z-10 mt-1">
                      {empSugg.map(e => (
                        <button key={e.id} onClick={() => pickEmployee(e)}
                          className="w-full text-left px-3 py-2.5 hover:bg-surface2 flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-sage/20 text-sage flex items-center justify-center text-xs font-bold">
                            {(e.name||'?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-text">{e.name}</div>
                            <div className="text-xs text-muted">{e.department} · {e.employeeId}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {form.employeeName && (
                  <div className="mt-2 flex gap-3">
                    <span className="text-xs bg-sage/10 text-sage px-2 py-1 rounded-lg">{form.department}</span>
                    {form.age && <span className="text-xs bg-surface2 text-muted px-2 py-1 rounded-lg">Age: {form.age}</span>}
                    {form.gender && <span className="text-xs bg-surface2 text-muted px-2 py-1 rounded-lg">{form.gender}</span>}
                  </div>
                )}
              </div>

              {/* Referral details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Referral Date *</label>
                  <input type="date" value={form.referralDate} onChange={e => setForm(f=>({...f, referralDate:e.target.value}))} className="input w-full"/>
                </div>
                <div>
                  <label className="label">Urgency *</label>
                  <select value={form.urgency} onChange={e => setForm(f=>({...f, urgency:e.target.value}))} className="input w-full">
                    {Object.entries(URGENCY).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Specialty *</label>
                  <select value={form.specialty} onChange={e => setForm(f=>({...f, specialty:e.target.value}))} className="input w-full">
                    <option value="">Select specialty…</option>
                    {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Hospital / Clinic</label>
                  <input value={form.hospitalName} onChange={e => setForm(f=>({...f, hospitalName:e.target.value}))}
                    placeholder="Hospital name" className="input w-full"/>
                </div>
              </div>

              <div>
                <label className="label">Referred Doctor</label>
                <input value={form.doctorName} onChange={e => setForm(f=>({...f, doctorName:e.target.value}))}
                  placeholder="Dr. Name (optional)" className="input w-full"/>
              </div>

              <div>
                <label className="label">Reason for Referral *</label>
                <textarea value={form.reason} onChange={e => setForm(f=>({...f, reason:e.target.value}))}
                  rows={2} placeholder="Primary reason for referral…" className="input w-full resize-none"/>
              </div>

              <div>
                <label className="label">Clinical Notes / Diagnosis</label>
                <textarea value={form.clinicalNotes} onChange={e => setForm(f=>({...f, clinicalNotes:e.target.value}))}
                  rows={3} placeholder="Relevant clinical findings, current diagnosis, medications, etc." className="input w-full resize-none"/>
              </div>

              <div>
                <label className="label">Link to OPD Visit (optional)</label>
                <select value={form.visitId} onChange={e => setForm(f=>({...f, visitId:e.target.value}))} className="input w-full">
                  <option value="">— No linked visit —</option>
                  {visits.filter(v => v.employeeId === form.employeeId).map(v => (
                    <option key={v.id} value={v.id}>
                      {v.complaint || 'Visit'} — {v.date || fmt(v.createdAt)}
                    </option>
                  ))}
                </select>
              </div>

            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-surface2">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Create Referral'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Update Status Drawer ── */}
      {editReferral && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditReferral(null)}/>
          <div className="relative ml-auto w-full max-w-lg bg-white h-full flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-text">Update Referral</h2>
                <p className="text-xs text-muted">{editReferral.employeeName} → {editReferral.specialty}</p>
              </div>
              <button onClick={() => setEditReferral(null)} className="w-8 h-8 rounded-full bg-surface2 hover:bg-border flex items-center justify-center">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Referral summary */}
              <div className="bg-surface2 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted">Employee</span><span className="font-medium text-text">{editReferral.employeeName}</span></div>
                <div className="flex justify-between"><span className="text-muted">Department</span><span className="text-text">{editReferral.department || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted">Specialty</span><span className="text-text">{editReferral.specialty}</span></div>
                <div className="flex justify-between"><span className="text-muted">Hospital</span><span className="text-text">{editReferral.hospitalName || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted">Reason</span><span className="text-text max-w-48 text-right">{editReferral.reason}</span></div>
                {editReferral.urgency === 'emergency' && (
                  <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-xs font-medium">
                    🚨 Emergency Referral
                  </div>
                )}
              </div>

              <div>
                <label className="label">Update Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(STATUS).map(([k, v]) => (
                    <button key={k} onClick={() => setEditReferral(r => ({...r, _status: k}))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                        editReferral._status === k
                          ? `border-sage bg-sage/10 text-sage`
                          : 'border-border bg-white text-muted hover:border-sage/40'
                      }`}>
                      <span className={`w-2 h-2 rounded-full ${v.dot}`}/>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Follow-up Date</label>
                <input type="date" value={editReferral._followUp}
                  onChange={e => setEditReferral(r => ({...r, _followUp: e.target.value}))}
                  className="input w-full"/>
              </div>

              <div>
                <label className="label">Feedback / Notes from Specialist</label>
                <textarea value={editReferral._feedback}
                  onChange={e => setEditReferral(r => ({...r, _feedback: e.target.value}))}
                  rows={4} placeholder="Specialist findings, recommended treatment, follow-up instructions…"
                  className="input w-full resize-none"/>
              </div>

            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-surface2">
              <button onClick={() => setEditReferral(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleUpdateStatus(editReferral, editReferral._status, editReferral._feedback, editReferral._followUp)}
                className="btn-primary">Save Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
