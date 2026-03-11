import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy, onSnapshot, getDocs
} from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate, initials } from '../../utils/formatters';

const CONDITIONS  = ['Fracture','Surgery','Cardiac Event','Stroke','Severe Injury','Medical Illness','Accident','Burns','Other'];
const STATUS_OPTS = ['Admitted','Stable','Critical','Improving','Rest at Home','Returned to Work','Discharged'];

const EMPTY = {
  employeeId: '', employeeName: '', department: '',
  hospital: '',
  admitDate: new Date().toISOString().slice(0,10),
  dischargeDate: '',
  condition: '',
  status: 'Admitted',
  restAtHome: '',
  returnToWork: '',
  remarks: '',
};

function StatusBadge({ status }) {
  const map = {
    'Admitted':         'bg-red-500/10 text-red-400',
    'Critical':         'bg-red-600/10 text-red-500',
    'Stable':           'bg-blue-400/10 text-blue-400',
    'Improving':        'bg-amber-400/10 text-amber-400',
    'Rest at Home':     'bg-purple-400/10 text-purple-400',
    'Returned to Work': 'bg-accent/10 text-accent',
    'Discharged':       'bg-surface2 text-muted',
  };
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${map[status] || 'bg-surface2 text-muted'}`}>{status}</span>;
}

function daysBetween(d1, d2) {
  if (!d1) return null;
  const from = new Date(d1);
  const to   = d2 ? new Date(d2) : new Date();
  const diff = Math.floor((to - from) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

export default function HospitalTracker() {
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
  const [filterStatus,setFilterStatus]= useState('');
  const [search,      setSearch]      = useState('');
  const [empSearch,   setEmpSearch]   = useState('');
  const [empDropdown, setEmpDropdown] = useState(false);

  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  useEffect(() => {
    if (!tid) return;
    const unsub = onSnapshot(
      query(collection(db,'merchants',tid,'hospitalTracker'), orderBy('createdAt','desc')),
      snap => { setRecords(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, [tid]);

  useEffect(() => {
    if (!tid) return;
    getDocs(collection(db,'merchants',tid,'employees'))
      .then(snap => setEmployees(snap.docs.map(d=>({id:d.id,...d.data()}))))
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
    if (!form.admitDate)  { toast.error('Admission date is required.'); return; }
    if (!form.hospital.trim()) { toast.error('Hospital name is required.'); return; }
    setSaving(true);
    try {
      const payload = {...form, updatedAt: serverTimestamp()};
      if (editing) {
        await updateDoc(doc(db,'merchants',tid,'hospitalTracker',editing.id), payload);
        toast.success('Record updated.');
      } else {
        await addDoc(collection(db,'merchants',tid,'hospitalTracker'), {...payload, createdAt: serverTimestamp()});
        toast.success(`${form.employeeName} admitted.`);
      }
      setShowForm(false);
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db,'merchants',tid,'hospitalTracker',deleteTarget.id));
      toast.success('Record deleted.');
    } catch(e) { toast.error(e.message); }
    finally { setDeleteTarget(null); }
  };

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.employeeName?.toLowerCase().includes(q) || r.hospital?.toLowerCase().includes(q))
      && (!filterStatus || r.status === filterStatus);
  });

  const admitted   = records.filter(r => ['Admitted','Critical','Stable','Improving'].includes(r.status)).length;
  const restHome   = records.filter(r => r.status === 'Rest at Home').length;
  const returned   = records.filter(r => r.status === 'Returned to Work').length;

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-text">Hospital Tracker</h1>
          <p className="text-muted text-sm mt-0.5">Track hospitalised employees — admission, recovery & return to work</p>
        </div>
        {canEdit && <button onClick={openAdd} className="btn-primary">+ Admit Employee</button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Currently Admitted', value: admitted,      icon: '🏥', color: 'text-red-400' },
          { label: 'Rest at Home',       value: restHome,      icon: '🏠', color: 'text-purple-400' },
          { label: 'Returned to Work',   value: returned,      icon: '✅', color: 'text-accent' },
          { label: 'Total Cases',        value: records.length,icon: '📋', color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className={`font-serif text-3xl ${s.color} mb-0.5`}>{loading ? '—' : s.value}</div>
            <div className="text-xs text-muted uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input className="field-input w-60" placeholder="Search name or hospital…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="field-input w-48" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUS_OPTS.map(s=><option key={s}>{s}</option>)}
        </select>
        {(search||filterStatus) && <button onClick={()=>{setSearch('');setFilterStatus('');}} className="btn-ghost text-sm">Clear</button>}
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_90px_90px_60px_1fr_90px_70px] gap-2 px-4 py-2.5 bg-surface2 border-b border-border">
          {['Employee','Hospital','Admit','Discharge','Days','Condition','Status',''].map(h=>(
            <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>
          ))}
        </div>
        {loading
          ? <div className="py-12 text-center text-muted text-sm">Loading…</div>
          : filtered.length === 0
            ? <div className="py-14 text-center"><div className="text-4xl mb-3">🏥</div><div className="text-muted text-sm">{records.length===0?'No hospital cases recorded.':'No records match your filters.'}</div></div>
            : filtered.map(rec => {
              const days = daysBetween(rec.admitDate, rec.dischargeDate);
              return (
                <div key={rec.id} className="grid grid-cols-[2fr_1fr_90px_90px_60px_1fr_90px_70px] gap-2 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors items-center">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-xs font-bold text-red-400 shrink-0">{initials(rec.employeeName)}</div>
                    <div className="min-w-0">
                      <button onClick={()=>setViewRecord(rec)} className="text-sm font-medium text-text hover:text-accent truncate block text-left">{rec.employeeName}</button>
                      <div className="text-xs text-muted">{rec.employeeId}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted truncate">{rec.hospital}</div>
                  <div className="text-xs text-muted">{rec.admitDate ? fmtDate(rec.admitDate) : '—'}</div>
                  <div className="text-xs text-muted">{rec.dischargeDate ? fmtDate(rec.dischargeDate) : '—'}</div>
                  <div className="text-sm font-medium text-text text-center">{days ?? '—'}</div>
                  <div className="text-xs text-muted truncate">{rec.condition||'—'}</div>
                  <StatusBadge status={rec.status} />
                  <div className="flex gap-1">
                    {canEdit && <button onClick={()=>openEdit(rec)} className="text-muted hover:text-accent text-sm p-1">✏️</button>}
                    {canEdit && <button onClick={()=>setDeleteTarget(rec)} className="text-muted hover:text-red-400 text-sm p-1">🗑️</button>}
                  </div>
                </div>
              );
            })
        }
      </div>

      {/* ADD/EDIT MODAL */}
      {showForm && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div className="modal-box w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">{editing?'Update Hospital Record':'Admit Employee'}</h2>
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
                <div className="col-span-2"><label className="field-label">Hospital / Facility *</label><input className="field-input" placeholder="Hospital name" value={form.hospital} onChange={e=>set('hospital',e.target.value)} /></div>
                <div><label className="field-label">Admission Date *</label><input type="date" className="field-input" value={form.admitDate} onChange={e=>set('admitDate',e.target.value)} /></div>
                <div><label className="field-label">Discharge Date</label><input type="date" className="field-input" value={form.dischargeDate} onChange={e=>set('dischargeDate',e.target.value)} /></div>
                <div><label className="field-label">Condition</label>
                  <select className="field-input" value={form.condition} onChange={e=>set('condition',e.target.value)}>
                    <option value="">Select…</option>{CONDITIONS.map(c=><option key={c}>{c}</option>)}
                  </select></div>
                <div><label className="field-label">Status</label>
                  <select className="field-input" value={form.status} onChange={e=>set('status',e.target.value)}>
                    {STATUS_OPTS.map(s=><option key={s}>{s}</option>)}
                  </select></div>
                <div><label className="field-label">Rest at Home Until</label><input type="date" className="field-input" value={form.restAtHome} onChange={e=>set('restAtHome',e.target.value)} /></div>
                <div><label className="field-label">Return to Work Date</label><input type="date" className="field-input" value={form.returnToWork} onChange={e=>set('returnToWork',e.target.value)} /></div>
                <div className="col-span-2"><label className="field-label">Remarks</label><textarea className="field-input h-16 resize-none" value={form.remarks} onChange={e=>set('remarks',e.target.value)} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={()=>setShowForm(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving?'Saving…':editing?'Save Changes':'Admit'}</button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {viewRecord && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setViewRecord(null)}>
          <div className="modal-box w-full max-w-md">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">Hospital Record</h2>
              <button onClick={()=>setViewRecord(null)} className="text-muted hover:text-text text-xl leading-none">×</button>
            </div>
            <div className="modal-body space-y-3">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-lg font-bold text-red-400">{initials(viewRecord.employeeName)}</div>
                <div>
                  <div className="font-serif text-lg text-text">{viewRecord.employeeName}</div>
                  <div className="text-sm text-muted">{viewRecord.employeeId} · {viewRecord.department}</div>
                  <div className="mt-1"><StatusBadge status={viewRecord.status} /></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Hospital',     viewRecord.hospital],
                  ['Condition',    viewRecord.condition],
                  ['Admitted',     fmtDate(viewRecord.admitDate)],
                  ['Discharged',   viewRecord.dischargeDate ? fmtDate(viewRecord.dischargeDate) : 'Still admitted'],
                  ['Days',         daysBetween(viewRecord.admitDate, viewRecord.dischargeDate)],
                  ['Rest at Home', viewRecord.restAtHome ? fmtDate(viewRecord.restAtHome) : '—'],
                  ['Return to Work',viewRecord.returnToWork ? fmtDate(viewRecord.returnToWork) : '—'],
                ].filter(([,v])=>v!=null).map(([l,v])=>(
                  <div key={l} className="flex justify-between border-b border-border/30 pb-1">
                    <span className="text-muted">{l}</span><span className="text-text font-medium">{v}</span>
                  </div>
                ))}
              </div>
              {viewRecord.remarks && <div className="bg-surface2 rounded-lg p-3 text-sm text-muted">{viewRecord.remarks}</div>}
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
            <div className="modal-body"><p className="text-sm text-muted">Delete hospital record for <span className="text-text font-medium">{deleteTarget.employeeName}</span>?</p></div>
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
