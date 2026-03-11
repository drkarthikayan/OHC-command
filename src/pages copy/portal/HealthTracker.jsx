import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy, onSnapshot, getDocs
} from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate, initials } from '../../utils/formatters';

const CONDITIONS = [
  'Diabetes','Hypertension','Asthma','Heart Disease','Thyroid',
  'Kidney Disease','Epilepsy','Psychiatric','Obesity','Anaemia','Liver Disease','Custom',
];
const SEVERITY_OPTS = ['Controlled','Uncontrolled','Critical'];

const EMPTY = {
  employeeId: '', employeeName: '', department: '',
  condition: 'Diabetes',
  customCondition: '',
  severity: 'Controlled',
  since: '',
  currentMedication: '',
  lastReview: new Date().toISOString().slice(0,10),
  nextReview: '',
  notes: '',
};

function SevBadge({ severity }) {
  const map = {
    'Controlled':   'bg-accent/10 text-accent',
    'Uncontrolled': 'bg-amber-400/10 text-amber-400',
    'Critical':     'bg-red-500/10 text-red-400',
  };
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${map[severity]||'bg-surface2 text-muted'}`}>{severity}</span>;
}

function isOverdue(nextReview) {
  if (!nextReview) return false;
  return new Date(nextReview) < new Date();
}

function isDueSoon(nextReview) {
  if (!nextReview) return false;
  const diff = (new Date(nextReview) - new Date()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 30;
}

export default function HealthTracker() {
  const { tenant, staffUser } = useAuthStore();
  const tid  = tenant?.id;
  const role = staffUser?.role || 'staff';
  const canEdit = ['doctor','nurse','admin'].includes(role);

  const [records,     setRecords]     = useState([]);
  const [employees,   setEmployees]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [form,        setForm]        = useState(EMPTY);
  const [viewRecord,  setViewRecord]  = useState(null);
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [filterCond,  setFilterCond]  = useState('');
  const [filterSev,   setFilterSev]   = useState('');
  const [search,      setSearch]      = useState('');
  const [empSearch,   setEmpSearch]   = useState('');
  const [empDropdown, setEmpDropdown] = useState(false);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(() => {
    if (!tid) return;
    const unsub = onSnapshot(
      query(collection(db,'merchants',tid,'healthConditions'), orderBy('createdAt','desc')),
      snap => { setRecords(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, [tid]);

  useEffect(() => {
    if (!tid) return;
    getDocs(collection(db,'merchants',tid,'employees'))
      .then(snap=>setEmployees(snap.docs.map(d=>({id:d.id,...d.data()}))))
      .catch(()=>{});
  }, [tid]);

  const filteredEmps = employees.filter(e => {
    const q = empSearch.toLowerCase();
    return !q || e.name?.toLowerCase().includes(q) || e.empId?.toLowerCase().includes(q);
  }).slice(0,8);

  const selectEmployee = (emp) => {
    set('employeeId', emp.empId||emp.id);
    set('employeeName', emp.name);
    set('department', emp.department||'');
    setEmpSearch(emp.name);
    setEmpDropdown(false);
  };

  const openAdd = () => { setEditing(null); setForm(EMPTY); setEmpSearch(''); setShowForm(true); };
  const openEdit = (rec) => { setEditing(rec); setForm({...EMPTY,...rec}); setEmpSearch(rec.employeeName||''); setShowForm(true); };

  const handleSave = async () => {
    if (!form.employeeId) { toast.error('Select an employee.'); return; }
    if (!form.condition)  { toast.error('Condition is required.'); return; }
    setSaving(true);
    try {
      const payload = {...form, updatedAt: serverTimestamp()};
      if (editing) {
        await updateDoc(doc(db,'merchants',tid,'healthConditions',editing.id), payload);
        toast.success('Condition updated.');
      } else {
        await addDoc(collection(db,'merchants',tid,'healthConditions'), {...payload, createdAt: serverTimestamp()});
        toast.success('Condition added.');
      }
      setShowForm(false);
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db,'merchants',tid,'healthConditions',deleteTarget.id));
      toast.success('Record deleted.');
    } catch(e) { toast.error(e.message); }
    finally { setDeleteTarget(null); }
  };

  const condLabel = (rec) => rec.condition === 'Custom' ? (rec.customCondition || 'Custom') : rec.condition;

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.employeeName?.toLowerCase().includes(q) || condLabel(r).toLowerCase().includes(q))
      && (!filterCond || r.condition === filterCond)
      && (!filterSev  || r.severity  === filterSev);
  });

  const overdue  = records.filter(r => isOverdue(r.nextReview));
  const dueSoon  = records.filter(r => !isOverdue(r.nextReview) && isDueSoon(r.nextReview));

  // condition stats
  const count = (c) => records.filter(r => r.condition === c).length;

  const COND_STATS = [
    { label: 'Diabetes',   icon: '🩸', value: count('Diabetes'),      color: 'text-amber-400' },
    { label: 'Hypertension',icon:'❤️', value: count('Hypertension'),  color: 'text-red-400' },
    { label: 'Asthma/Resp',icon: '🫁', value: count('Asthma'),        color: 'text-blue-400' },
    { label: 'Cardiac',    icon: '🫀', value: count('Heart Disease'),  color: 'text-pink-400' },
  ];

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-text">Health Tracker</h1>
          <p className="text-muted text-sm mt-0.5">Monitor pre-existing conditions & chronic disease management</p>
        </div>
        {canEdit && <button onClick={openAdd} className="btn-primary">+ Add Condition</button>}
      </div>

      {/* Condition stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {COND_STATS.map(s=>(
          <div key={s.label} className="stat-card">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className={`font-serif text-3xl ${s.color} mb-0.5`}>{loading?'—':s.value}</div>
            <div className="text-xs text-muted uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Overdue + Due Soon alerts */}
      {(overdue.length > 0 || dueSoon.length > 0) && !loading && (
        <div className="card overflow-hidden mb-4">
          <div className="card-header"><span>⏰</span><h3 className="text-sm font-semibold text-text">Review Alerts</h3></div>
          <div className="divide-y divide-border/50">
            {overdue.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center text-[10px] font-bold text-red-400 shrink-0">{initials(r.employeeName)}</div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-text">{r.employeeName}</span>
                  <span className="text-xs text-muted ml-2">· {condLabel(r)}</span>
                </div>
                <span className="text-xs text-red-400 font-medium">Overdue — {fmtDate(r.nextReview)}</span>
                {canEdit && <button onClick={()=>openEdit(r)} className="text-muted hover:text-accent text-sm ml-2">✏️</button>}
              </div>
            ))}
            {dueSoon.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-7 h-7 rounded-full bg-amber-400/10 flex items-center justify-center text-[10px] font-bold text-amber-400 shrink-0">{initials(r.employeeName)}</div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-text">{r.employeeName}</span>
                  <span className="text-xs text-muted ml-2">· {condLabel(r)}</span>
                </div>
                <span className="text-xs text-amber-400 font-medium">Due {fmtDate(r.nextReview)}</span>
                {canEdit && <button onClick={()=>openEdit(r)} className="text-muted hover:text-accent text-sm ml-2">✏️</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input className="field-input w-60" placeholder="Search name or condition…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="field-input w-44" value={filterCond} onChange={e=>setFilterCond(e.target.value)}>
          <option value="">All Conditions</option>
          {CONDITIONS.map(c=><option key={c}>{c}</option>)}
        </select>
        <select className="field-input w-40" value={filterSev} onChange={e=>setFilterSev(e.target.value)}>
          <option value="">All Severity</option>
          {SEVERITY_OPTS.map(s=><option key={s}>{s}</option>)}
        </select>
        {(search||filterCond||filterSev) && <button onClick={()=>{setSearch('');setFilterCond('');setFilterSev('');}} className="btn-ghost text-sm">Clear</button>}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_80px_90px_1fr_90px_90px_60px] gap-2 px-4 py-2.5 bg-surface2 border-b border-border">
          {['Employee','Condition','Severity','Since','Medication','Last Review','Next Review',''].map(h=>(
            <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>
          ))}
        </div>
        {loading
          ? <div className="py-12 text-center text-muted text-sm">Loading…</div>
          : filtered.length === 0
            ? <div className="py-14 text-center"><div className="text-4xl mb-3">💚</div><div className="text-muted text-sm">{records.length===0?'No conditions tracked yet.':'No records match your filters.'}</div></div>
            : filtered.map(rec=>(
              <div key={rec.id} className={`grid grid-cols-[2fr_1fr_80px_90px_1fr_90px_90px_60px] gap-2 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors items-center ${isOverdue(rec.nextReview)?'border-l-2 border-l-red-500/40':''}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-green/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">{initials(rec.employeeName)}</div>
                  <div className="min-w-0">
                    <button onClick={()=>setViewRecord(rec)} className="text-sm font-medium text-text hover:text-accent truncate block text-left">{rec.employeeName}</button>
                    <div className="text-xs text-muted">{rec.employeeId}</div>
                  </div>
                </div>
                <div className="text-xs text-muted truncate">{condLabel(rec)}</div>
                <SevBadge severity={rec.severity} />
                <div className="text-xs text-muted">{rec.since ? fmtDate(rec.since) : '—'}</div>
                <div className="text-xs text-muted truncate">{rec.currentMedication||'—'}</div>
                <div className="text-xs text-muted">{rec.lastReview ? fmtDate(rec.lastReview) : '—'}</div>
                <div className={`text-xs font-medium ${isOverdue(rec.nextReview)?'text-red-400':isDueSoon(rec.nextReview)?'text-amber-400':'text-muted'}`}>
                  {rec.nextReview ? fmtDate(rec.nextReview) : '—'}
                  {isOverdue(rec.nextReview) && ' ⚠️'}
                </div>
                <div className="flex gap-1">
                  {canEdit && <button onClick={()=>openEdit(rec)} className="text-muted hover:text-accent text-sm p-1">✏️</button>}
                  {canEdit && <button onClick={()=>setDeleteTarget(rec)} className="text-muted hover:text-red-400 text-sm p-1">🗑️</button>}
                </div>
              </div>
            ))
        }
      </div>

      {/* ADD/EDIT MODAL */}
      {showForm && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div className="modal-box w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">{editing?'Update Condition':'Add Health Condition'}</h2>
              <button onClick={()=>setShowForm(false)} className="text-muted hover:text-text text-xl leading-none">×</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="relative">
                <label className="field-label">Search Employee *</label>
                <input className="field-input" placeholder="Type name or ID…" value={empSearch}
                  onChange={e=>{setEmpSearch(e.target.value);setEmpDropdown(true);}}
                  onFocus={()=>setEmpDropdown(true)} />
                {empDropdown && empSearch && filteredEmps.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-lg shadow-xl overflow-hidden">
                    {filteredEmps.map(emp=>(
                      <button key={emp.id} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-surface2 text-left" onMouseDown={()=>selectEmployee(emp)}>
                        <div className="w-7 h-7 rounded-full bg-green/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">{initials(emp.name)}</div>
                        <div><div className="text-sm text-text">{emp.name}</div><div className="text-xs text-muted">{emp.empId} · {emp.department}</div></div>
                      </button>
                    ))}
                  </div>
                )}
                {form.employeeId && <div className="mt-1 text-xs text-accent">✓ {form.employeeName} · {form.department}</div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Condition *</label>
                  <select className="field-input" value={form.condition} onChange={e=>set('condition',e.target.value)}>
                    {CONDITIONS.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                {form.condition === 'Custom' && (
                  <div><label className="field-label">Specify Condition</label><input className="field-input" value={form.customCondition} onChange={e=>set('customCondition',e.target.value)} /></div>
                )}
                <div>
                  <label className="field-label">Severity</label>
                  <select className="field-input" value={form.severity} onChange={e=>set('severity',e.target.value)}>
                    {SEVERITY_OPTS.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="field-label">Since</label><input type="date" className="field-input" value={form.since} onChange={e=>set('since',e.target.value)} /></div>
                <div className="col-span-2"><label className="field-label">Current Medication</label><input className="field-input" placeholder="List medications…" value={form.currentMedication} onChange={e=>set('currentMedication',e.target.value)} /></div>
                <div><label className="field-label">Last Review</label><input type="date" className="field-input" value={form.lastReview} onChange={e=>set('lastReview',e.target.value)} /></div>
                <div><label className="field-label">Next Review</label><input type="date" className="field-input" value={form.nextReview} onChange={e=>set('nextReview',e.target.value)} /></div>
                <div className="col-span-2"><label className="field-label">Notes</label><textarea className="field-input h-16 resize-none" value={form.notes} onChange={e=>set('notes',e.target.value)} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={()=>setShowForm(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving?'Saving…':editing?'Save Changes':'Add Condition'}</button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {viewRecord && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setViewRecord(null)}>
          <div className="modal-box w-full max-w-md">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">Health Condition</h2>
              <button onClick={()=>setViewRecord(null)} className="text-muted hover:text-text text-xl leading-none">×</button>
            </div>
            <div className="modal-body space-y-3">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className="w-12 h-12 rounded-full bg-green/20 flex items-center justify-center text-lg font-bold text-accent">{initials(viewRecord.employeeName)}</div>
                <div>
                  <div className="font-serif text-lg text-text">{viewRecord.employeeName}</div>
                  <div className="text-sm text-muted">{viewRecord.employeeId} · {viewRecord.department}</div>
                  <div className="flex items-center gap-2 mt-1"><SevBadge severity={viewRecord.severity} /></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Condition',   condLabel(viewRecord)],
                  ['Since',       viewRecord.since ? fmtDate(viewRecord.since) : '—'],
                  ['Medication',  viewRecord.currentMedication],
                  ['Last Review', viewRecord.lastReview ? fmtDate(viewRecord.lastReview) : '—'],
                  ['Next Review', viewRecord.nextReview ? fmtDate(viewRecord.nextReview) : '—'],
                ].filter(([,v])=>v).map(([l,v])=>(
                  <div key={l} className="flex justify-between border-b border-border/30 pb-1">
                    <span className="text-muted">{l}</span><span className="text-text font-medium">{v}</span>
                  </div>
                ))}
              </div>
              {viewRecord.notes && <div className="bg-surface2 rounded-lg p-3 text-sm text-muted">{viewRecord.notes}</div>}
            </div>
            <div className="modal-footer">
              {canEdit && <button onClick={()=>{setViewRecord(null);openEdit(viewRecord);}} className="btn-ghost">Edit</button>}
              <button onClick={()=>setViewRecord(null)} className="btn-primary">Close</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" style={{zIndex:9999}}>
          <div className="modal-box w-full max-w-sm">
            <div className="modal-header"><h2 className="font-serif text-lg text-text">Delete Record</h2></div>
            <div className="modal-body"><p className="text-sm text-muted">Delete condition record for <span className="text-text font-medium">{deleteTarget.employeeName}</span>?</p></div>
            <div className="modal-footer">
              <button onClick={()=>setDeleteTarget(null)} className="btn-ghost">Cancel</button>
              <button onClick={handleDelete} className="btn-primary" style={{background:'#dc2626',borderColor:'#dc2626'}}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
