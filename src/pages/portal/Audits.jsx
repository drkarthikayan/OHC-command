import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate } from '../../utils/formatters';

const AUDIT_TYPES = ['Internal Safety Audit','External Safety Audit','OHC Compliance Audit','Fire Safety Audit','Environmental Audit','Custom'];
const RATINGS = ['Excellent','Good','Satisfactory','Needs Improvement','Non-Compliant'];
const STATUSES = ['Scheduled','In Progress','Completed','Pending Action'];

const RATING_COLORS = { Excellent:'bg-green-50 text-green-700 border-green-200', Good:'bg-blue-50 text-blue-700 border-blue-200', Satisfactory:'bg-yellow-50 text-yellow-700 border-yellow-200', 'Needs Improvement':'bg-orange-50 text-orange-700 border-orange-200', 'Non-Compliant':'bg-red-50 text-red-700 border-red-200' };
const STATUS_COLORS = { Scheduled:'bg-blue-50 text-blue-700 border-blue-200', 'In Progress':'bg-amber-50 text-amber-700 border-amber-200', Completed:'bg-green-50 text-green-700 border-green-200', 'Pending Action':'bg-red-50 text-red-700 border-red-200' };

const EMPTY = { date: new Date().toISOString().slice(0,10), auditType:'Internal Safety Audit', auditorName:'', scope:'', rating:'Good', score:'', ncCount:'', observations:'', correctiveActions:'', status:'Scheduled', nextAuditDate:'' };

export default function Audits() {
  const { tenant, staffUser } = useAuthStore();
  const tid = tenant?.id;
  const canEdit = ['doctor','nurse','admin'].includes(staffUser?.role);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(() => {
    if (!tid) return;
    return onSnapshot(query(collection(db,'merchants',tid,'audits'), orderBy('createdAt','desc')),
      s=>{setRecords(s.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false);}, ()=>setLoading(false));
  }, [tid]);

  const handleSave = async () => {
    if (!form.auditorName) { toast.error('Enter auditor name.'); return; }
    setSaving(true);
    try {
      const p = {...form, updatedAt:serverTimestamp()};
      if (editing) { await updateDoc(doc(db,'merchants',tid,'audits',editing.id), p); toast.success('Audit updated.'); }
      else { await addDoc(collection(db,'merchants',tid,'audits'), {...p, createdAt:serverTimestamp()}); toast.success('Audit recorded.'); }
      setShowForm(false);
    } catch(e){toast.error(e.message);} finally{setSaving(false);}
  };

  const handleDelete = async () => {
    try { await deleteDoc(doc(db,'merchants',tid,'audits',deleteTarget.id)); toast.success('Deleted.'); }
    catch(e){toast.error(e.message);} finally{setDeleteTarget(null);}
  };

  const filtered = records.filter(r=>!search||(r.auditType?.toLowerCase().includes(search.toLowerCase())||r.auditorName?.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-3xl font-semibold text-gray-900">Audits</h1><p className="text-gray-500 text-sm mt-0.5">Safety and compliance audit records</p></div>
        {canEdit&&<button onClick={()=>{setEditing(null);setForm(EMPTY);setShowForm(true);}} className="btn-primary">+ New Audit</button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[{l:'Total',v:records.length,c:'text-gray-900'},{l:'Completed',v:records.filter(r=>r.status==='Completed').length,c:'text-green-600'},{l:'Pending Action',v:records.filter(r=>r.status==='Pending Action').length,c:'text-red-600'},{l:'Scheduled',v:records.filter(r=>r.status==='Scheduled').length,c:'text-blue-600'}].map(s=>(
          <div key={s.l} className="stat-card"><div className={`font-serif text-3xl ${s.c} mb-0.5`}>{loading?'—':s.v}</div><div className="text-xs text-gray-400 uppercase tracking-wider">{s.l}</div></div>
        ))}
      </div>

      <div className="flex gap-3 mb-4"><input className="field-input w-64" placeholder="Search audit type or auditor…" value={search} onChange={e=>setSearch(e.target.value)}/></div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[90px_1fr_1fr_80px_60px_80px_80px_60px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          {['Date','Type','Auditor','Rating','NCs','Status','Next Audit',''].map(h=><div key={h} className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{h}</div>)}
        </div>
        {loading?<div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
          :filtered.length===0?<div className="py-14 text-center"><div className="text-4xl mb-3">✅</div><div className="text-gray-400 text-sm">{records.length===0?'No audits recorded yet.':'No records match.'}</div></div>
          :filtered.map(rec=>(
            <div key={rec.id} className="grid grid-cols-[90px_1fr_1fr_80px_60px_80px_80px_60px] gap-2 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 items-center">
              <div className="text-xs text-gray-500">{fmtDate(rec.date)}</div>
              <div className="text-sm font-medium text-gray-900 truncate">{rec.auditType}</div>
              <div className="text-xs text-gray-500 truncate">{rec.auditorName}</div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${RATING_COLORS[rec.rating]||''}`}>{rec.rating||'—'}</span>
              <div className="text-sm font-medium text-center">{rec.ncCount||'0'}</div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[rec.status]||''}`}>{rec.status}</span>
              <div className="text-xs text-gray-400">{rec.nextAuditDate?fmtDate(rec.nextAuditDate):'—'}</div>
              <div className="flex gap-1">
                {canEdit&&<button onClick={()=>{setEditing(rec);setForm({...EMPTY,...rec});setShowForm(true);}} className="text-gray-300 hover:text-sage text-sm p-1">✏️</button>}
                {canEdit&&<button onClick={()=>setDeleteTarget(rec)} className="text-gray-300 hover:text-red-400 text-sm p-1">🗑️</button>}
              </div>
            </div>
          ))}
      </div>

      {showForm&&(
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div className="modal-box w-full max-w-xl max-h-[92vh] overflow-y-auto">
            <div className="modal-header"><h2 className="font-serif text-xl text-gray-900">{editing?'Edit Audit':'Record Audit'}</h2><button onClick={()=>setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-xl">×</button></div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Date</label><input type="date" className="field-input" value={form.date} onChange={e=>set('date',e.target.value)}/></div>
                <div><label className="field-label">Audit Type</label><select className="field-input" value={form.auditType} onChange={e=>set('auditType',e.target.value)}>{AUDIT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label className="field-label">Auditor Name *</label><input className="field-input" placeholder="Name" value={form.auditorName} onChange={e=>set('auditorName',e.target.value)}/></div>
                <div><label className="field-label">Scope</label><input className="field-input" placeholder="Areas covered" value={form.scope} onChange={e=>set('scope',e.target.value)}/></div>
                <div><label className="field-label">Overall Rating</label><select className="field-input" value={form.rating} onChange={e=>set('rating',e.target.value)}>{RATINGS.map(r=><option key={r}>{r}</option>)}</select></div>
                <div><label className="field-label">Score (%)</label><input type="number" max="100" className="field-input" placeholder="85" value={form.score} onChange={e=>set('score',e.target.value)}/></div>
                <div><label className="field-label">Non-Conformances</label><input type="number" className="field-input" placeholder="0" value={form.ncCount} onChange={e=>set('ncCount',e.target.value)}/></div>
                <div><label className="field-label">Status</label><select className="field-input" value={form.status} onChange={e=>set('status',e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
                <div className="col-span-2"><label className="field-label">Observations</label><textarea className="field-input h-16 resize-none w-full" value={form.observations} onChange={e=>set('observations',e.target.value)}/></div>
                <div className="col-span-2"><label className="field-label">Corrective Actions</label><textarea className="field-input h-16 resize-none w-full" value={form.correctiveActions} onChange={e=>set('correctiveActions',e.target.value)}/></div>
                <div><label className="field-label">Next Audit Date</label><input type="date" className="field-input" value={form.nextAuditDate} onChange={e=>set('nextAuditDate',e.target.value)}/></div>
              </div>
            </div>
            <div className="modal-footer"><button onClick={()=>setShowForm(false)} className="btn-ghost">Cancel</button><button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving?'Saving…':editing?'Save Changes':'Record Audit'}</button></div>
          </div>
        </div>
      )}
      {deleteTarget&&(<div className="modal-backdrop" style={{zIndex:9999}}><div className="modal-box w-full max-w-sm"><div className="modal-header"><h2 className="font-serif text-lg text-gray-900">Delete Audit</h2></div><div className="modal-body"><p className="text-sm text-gray-500">Delete this audit record?</p></div><div className="modal-footer"><button onClick={()=>setDeleteTarget(null)} className="btn-ghost">Cancel</button><button onClick={handleDelete} className="btn-danger">Delete</button></div></div></div>)}
    </div>
  );
}
