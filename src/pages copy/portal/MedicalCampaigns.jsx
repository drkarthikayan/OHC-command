import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate } from '../../utils/formatters';

const TYPES = [
  'General Health Checkup','Eye Test Camp','Blood Pressure Camp','Diabetes Screening',
  'Dental Camp','Vaccination Drive','Mental Health Workshop','Ergonomics Workshop',
  'Seasonal Illness Prevention','Custom',
];
const STATUSES  = ['Planned','Active','Completed'];
const DEPTS     = ['All Departments','Production','Safety','Engineering','HR','Maintenance','QA/QC','Logistics','Admin','IT','Finance'];
const TYPE_ICONS = {
  'General Health Checkup':'🏥','Eye Test Camp':'👁️','Blood Pressure Camp':'❤️',
  'Diabetes Screening':'🩸','Dental Camp':'🦷','Vaccination Drive':'💉',
  'Mental Health Workshop':'🧘','Ergonomics Workshop':'🪑',
  'Seasonal Illness Prevention':'🌡️','Custom':'📋',
};

const EMPTY = {
  name: '', type: 'General Health Checkup', status: 'Planned',
  fromDate: '', toDate: '', targetDepartment: 'All Departments',
  targetEmployees: '', description: '',
};

function StatusBadge({ status }) {
  const map = { 'Planned':'bg-blue-400/10 text-blue-400', 'Active':'bg-accent/10 text-accent', 'Completed':'bg-surface2 text-muted' };
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${map[status]||'bg-surface2 text-muted'}`}>{status}</span>;
}

function daysLeft(toDate) {
  if (!toDate) return null;
  const diff = Math.round((new Date(toDate) - new Date()) / 86400000);
  return diff;
}

export default function MedicalCampaigns() {
  const { tenant, staffUser } = useAuthStore();
  const tid  = tenant?.id;
  const role = staffUser?.role || 'staff';
  const canEdit = ['doctor','nurse','admin'].includes(role);

  const [records,     setRecords]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [form,        setForm]        = useState(EMPTY);
  const [viewRecord,  setViewRecord]  = useState(null);
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [filterStatus,setFilterStatus]= useState('');
  const [search,      setSearch]      = useState('');

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(() => {
    if (!tid) return;
    const unsub = onSnapshot(
      query(collection(db,'merchants',tid,'campaigns'), orderBy('createdAt','desc')),
      snap => { setRecords(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, [tid]);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (rec) => { setEditing(rec); setForm({...EMPTY,...rec}); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Campaign name is required.'); return; }
    setSaving(true);
    try {
      const payload = {...form, updatedAt: serverTimestamp()};
      if (editing) {
        await updateDoc(doc(db,'merchants',tid,'campaigns',editing.id), payload);
        toast.success('Campaign updated.');
      } else {
        await addDoc(collection(db,'merchants',tid,'campaigns'), {...payload, createdAt: serverTimestamp()});
        toast.success(`"${form.name}" campaign created.`);
      }
      setShowForm(false);
    } catch(e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db,'merchants',tid,'campaigns',deleteTarget.id));
      toast.success('Campaign deleted.');
    } catch(e) { toast.error(e.message); } finally { setDeleteTarget(null); }
  };

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.name?.toLowerCase().includes(q) || r.type?.toLowerCase().includes(q))
      && (!filterStatus || r.status === filterStatus);
  });

  const active    = records.filter(r => r.status === 'Active').length;
  const planned   = records.filter(r => r.status === 'Planned').length;
  const completed = records.filter(r => r.status === 'Completed').length;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-text">Medical Campaigns</h1>
          <p className="text-muted text-sm mt-0.5">Schedule and manage health screening programmes</p>
        </div>
        {canEdit && <button onClick={openAdd} className="btn-primary">+ Create Campaign</button>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label:'Active',    value:active,    icon:'🟢', color:'text-accent' },
          { label:'Planned',   value:planned,   icon:'📅', color:'text-blue-400' },
          { label:'Completed', value:completed, icon:'✅', color:'text-muted' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className={`font-serif text-3xl ${s.color} mb-0.5`}>{loading ? '—' : s.value}</div>
            <div className="text-xs text-muted uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Active campaigns highlight */}
      {records.filter(r => r.status === 'Active').length > 0 && (
        <div className="mb-5 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-muted mb-2">🟢 Active Now</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {records.filter(r => r.status === 'Active').map(rec => {
              const dl = daysLeft(rec.toDate);
              return (
                <div key={rec.id} className="card p-4 border-accent/20 cursor-pointer hover:bg-surface2/50 transition-colors"
                  onClick={() => setViewRecord(rec)}>
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{TYPE_ICONS[rec.type] || '🏥'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-serif text-base text-text truncate">{rec.name}</div>
                      <div className="text-xs text-muted mt-0.5">{rec.type} · {rec.targetDepartment}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <StatusBadge status={rec.status} />
                        {rec.fromDate && <span className="text-xs text-muted">{fmtDate(rec.fromDate)}{rec.toDate && ` → ${fmtDate(rec.toDate)}`}</span>}
                        {dl !== null && dl >= 0 && <span className="text-xs text-amber-400">{dl === 0 ? 'Ends today' : `${dl}d left`}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input className="field-input w-60" placeholder="Search campaign name or type…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="field-input w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        {(search || filterStatus) && <button onClick={() => { setSearch(''); setFilterStatus(''); }} className="btn-ghost text-sm">Clear</button>}
      </div>

      {/* All campaigns */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_90px_90px_80px_80px_70px] gap-2 px-4 py-2.5 bg-surface2 border-b border-border">
          {['Campaign','Type','From','To','Dept','Status',''].map(h => (
            <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>
          ))}
        </div>
        {loading
          ? <div className="py-12 text-center text-muted text-sm">Loading…</div>
          : filtered.length === 0
            ? <div className="py-14 text-center"><div className="text-4xl mb-3">🏥</div><div className="text-muted text-sm">{records.length === 0 ? 'No campaigns yet.' : 'No results match.'}</div></div>
            : filtered.map(rec => (
              <div key={rec.id} className="grid grid-cols-[2fr_1fr_90px_90px_80px_80px_70px] gap-2 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors items-center">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg shrink-0">{TYPE_ICONS[rec.type] || '🏥'}</span>
                  <button onClick={() => setViewRecord(rec)} className="text-sm font-medium text-text hover:text-accent truncate text-left">
                    {rec.name}
                  </button>
                </div>
                <div className="text-xs text-muted truncate">{rec.type}</div>
                <div className="text-xs text-muted">{rec.fromDate ? fmtDate(rec.fromDate) : '—'}</div>
                <div className="text-xs text-muted">{rec.toDate ? fmtDate(rec.toDate) : '—'}</div>
                <div className="text-xs text-muted truncate">{rec.targetDepartment || '—'}</div>
                <StatusBadge status={rec.status} />
                <div className="flex gap-1">
                  {canEdit && <button onClick={() => openEdit(rec)} className="text-muted hover:text-accent text-sm p-1">✏️</button>}
                  {canEdit && <button onClick={() => setDeleteTarget(rec)} className="text-muted hover:text-red-400 text-sm p-1">🗑️</button>}
                </div>
              </div>
            ))
        }
      </div>

      {/* ADD/EDIT MODAL */}
      {showForm && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-box w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">{editing ? 'Edit Campaign' : 'Create Campaign'}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-text text-xl leading-none">×</button>
            </div>
            <div className="modal-body space-y-4">
              <div><label className="field-label">Campaign Name *</label><input className="field-input" placeholder="e.g. Annual Health Checkup 2025" value={form.name} onChange={e => set('name', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Type</label>
                  <select className="field-input" value={form.type} onChange={e => set('type', e.target.value)}>
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select></div>
                <div><label className="field-label">Status</label>
                  <select className="field-input" value={form.status} onChange={e => set('status', e.target.value)}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select></div>
                <div><label className="field-label">From Date</label><input type="date" className="field-input" value={form.fromDate} onChange={e => set('fromDate', e.target.value)} /></div>
                <div><label className="field-label">To Date</label><input type="date" className="field-input" value={form.toDate} onChange={e => set('toDate', e.target.value)} /></div>
                <div><label className="field-label">Target Department</label>
                  <select className="field-input" value={form.targetDepartment} onChange={e => set('targetDepartment', e.target.value)}>
                    {DEPTS.map(d => <option key={d}>{d}</option>)}
                  </select></div>
                <div><label className="field-label">Target Employees</label><input type="number" className="field-input" placeholder="0 = all" value={form.targetEmployees} onChange={e => set('targetEmployees', e.target.value)} /></div>
                <div className="col-span-2"><label className="field-label">Description</label><textarea className="field-input h-20 resize-none w-full" placeholder="Objectives, instructions, venue…" value={form.description} onChange={e => set('description', e.target.value)} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Campaign'}</button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {viewRecord && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setViewRecord(null)}>
          <div className="modal-box w-full max-w-md">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">Campaign Details</h2>
              <button onClick={() => setViewRecord(null)} className="text-muted hover:text-text text-xl leading-none">×</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="flex items-start gap-3 pb-3 border-b border-border">
                <div className="text-3xl">{TYPE_ICONS[viewRecord.type] || '🏥'}</div>
                <div>
                  <div className="font-serif text-lg text-text">{viewRecord.name}</div>
                  <div className="text-sm text-muted">{viewRecord.type}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={viewRecord.status} />
                    {viewRecord.targetDepartment && <span className="text-xs text-muted">{viewRecord.targetDepartment}</span>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['From', viewRecord.fromDate ? fmtDate(viewRecord.fromDate) : '—'],
                  ['To',   viewRecord.toDate   ? fmtDate(viewRecord.toDate)   : '—'],
                  ['Target Employees', viewRecord.targetEmployees || 'All'],
                ].map(([l,v]) => (
                  <div key={l} className="flex justify-between border-b border-border/30 pb-1">
                    <span className="text-muted">{l}</span><span className="text-text font-medium">{v}</span>
                  </div>
                ))}
              </div>
              {viewRecord.description && (
                <p className="text-sm text-muted bg-surface2 rounded-lg p-3">{viewRecord.description}</p>
              )}
              {(() => { const dl = daysLeft(viewRecord.toDate); return dl !== null && dl >= 0 && dl <= 7 ? (
                <div className="text-xs bg-amber-400/10 text-amber-400 px-3 py-2 rounded-lg border border-amber-400/20">
                  ⏰ {dl === 0 ? 'Ends today' : `${dl} day${dl > 1 ? 's' : ''} remaining`}
                </div>
              ) : null; })()}
            </div>
            <div className="modal-footer">
              {canEdit && <button onClick={() => { setViewRecord(null); openEdit(viewRecord); }} className="btn-ghost">Edit</button>}
              <button onClick={() => setViewRecord(null)} className="btn-primary">Close</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-box w-full max-w-sm">
            <div className="modal-header"><h2 className="font-serif text-lg text-text">Delete Campaign</h2></div>
            <div className="modal-body"><p className="text-sm text-muted">Delete <span className="text-text font-medium">"{deleteTarget.name}"</span>? This cannot be undone.</p></div>
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
