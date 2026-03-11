import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate } from '../../utils/formatters';

const AREAS = ['Production Floor','Warehouse','Canteen','Workshop','Electrical Room','Boiler Room','Chemical Store','Office Block','Parking','Outdoor Area','Custom'];
const FINDINGS = ['Safe','Minor Hazard','Major Hazard','Critical'];
const STATUSES = ['Open','In Progress','Resolved','Closed'];

const EMPTY = { date: new Date().toISOString().slice(0,10), area:'Production Floor', conductedBy:'', participants:'', findings:'Safe', observations:'', recommendations:'', followUpDate:'', status:'Open' };

function FindingBadge({ f }) {
  const m = { Safe:'bg-green-50 text-green-700 border-green-200', 'Minor Hazard':'bg-yellow-50 text-yellow-700 border-yellow-200', 'Major Hazard':'bg-orange-50 text-orange-700 border-orange-200', 'Critical':'bg-red-50 text-red-700 border-red-200' };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${m[f]||'bg-gray-50 text-gray-600 border-gray-200'}`}>{f}</span>;
}
function StatusBadge({ s }) {
  const m = { Open:'bg-blue-50 text-blue-700 border-blue-200', 'In Progress':'bg-amber-50 text-amber-700 border-amber-200', Resolved:'bg-green-50 text-green-700 border-green-200', Closed:'bg-gray-50 text-gray-500 border-gray-200' };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${m[s]||'bg-gray-50 text-gray-600 border-gray-200'}`}>{s}</span>;
}

export default function FieldRounds() {
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
  const [filterFindings, setFilterFindings] = useState('');

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(() => {
    if (!tid) return;
    return onSnapshot(query(collection(db,'merchants',tid,'fieldRounds'), orderBy('createdAt','desc')),
      s => { setRecords(s.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); }, ()=>setLoading(false));
  }, [tid]);

  const handleSave = async () => {
    if (!form.conductedBy) { toast.error('Enter who conducted the round.'); return; }
    setSaving(true);
    try {
      const p = {...form, updatedAt:serverTimestamp()};
      if (editing) { await updateDoc(doc(db,'merchants',tid,'fieldRounds',editing.id), p); toast.success('Round updated.'); }
      else { await addDoc(collection(db,'merchants',tid,'fieldRounds'), {...p, createdAt:serverTimestamp()}); toast.success('Field round recorded.'); }
      setShowForm(false);
    } catch(e){toast.error(e.message);} finally{setSaving(false);}
  };

  const handleDelete = async () => {
    try { await deleteDoc(doc(db,'merchants',tid,'fieldRounds',deleteTarget.id)); toast.success('Deleted.'); }
    catch(e){toast.error(e.message);} finally{setDeleteTarget(null);}
  };

  const filtered = records.filter(r => (!search || r.area?.toLowerCase().includes(search.toLowerCase()) || r.conductedBy?.toLowerCase().includes(search.toLowerCase())) && (!filterFindings || r.findings===filterFindings));
  const openHazards = records.filter(r=>['Major Hazard','Critical'].includes(r.findings) && r.status!=='Resolved' && r.status!=='Closed').length;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-gray-900">Field Rounds</h1>
          <p className="text-gray-500 text-sm mt-0.5">Workplace safety inspections and hazard tracking</p>
        </div>
        {canEdit && <button onClick={()=>{setEditing(null);setForm(EMPTY);setShowForm(true);}} className="btn-primary">+ New Round</button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[{l:'Total Rounds',v:records.length,c:'text-gray-900'},{l:'Safe',v:records.filter(r=>r.findings==='Safe').length,c:'text-green-600'},{l:'Open Hazards',v:openHazards,c:'text-red-600'},{l:'Resolved',v:records.filter(r=>r.status==='Resolved'||r.status==='Closed').length,c:'text-blue-600'}].map(s=>(
          <div key={s.l} className="stat-card"><div className={`font-serif text-3xl ${s.c} mb-0.5`}>{loading?'—':s.v}</div><div className="text-xs text-gray-400 uppercase tracking-wider">{s.l}</div></div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input className="field-input w-56" placeholder="Search area or staff…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="field-input w-44" value={filterFindings} onChange={e=>setFilterFindings(e.target.value)}>
          <option value="">All Findings</option>{FINDINGS.map(f=><option key={f}>{f}</option>)}
        </select>
        {(search||filterFindings)&&<button onClick={()=>{setSearch('');setFilterFindings('');}} className="btn-ghost text-sm">Clear</button>}
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[90px_1fr_100px_80px_80px_90px_60px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          {['Date','Area','Conducted By','Finding','Status','Follow Up',''].map(h=><div key={h} className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{h}</div>)}
        </div>
        {loading ? <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
          : filtered.length===0 ? <div className="py-14 text-center"><div className="text-4xl mb-3">🔍</div><div className="text-gray-400 text-sm">{records.length===0?'No field rounds yet.':'No records match.'}</div></div>
          : filtered.map(rec=>(
            <div key={rec.id} className="grid grid-cols-[90px_1fr_100px_80px_80px_90px_60px] gap-2 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 items-center">
              <div className="text-xs text-gray-500">{fmtDate(rec.date)}</div>
              <div className="text-sm font-medium text-gray-900 truncate">{rec.area}</div>
              <div className="text-xs text-gray-500 truncate">{rec.conductedBy}</div>
              <FindingBadge f={rec.findings}/>
              <StatusBadge s={rec.status}/>
              <div className="text-xs text-gray-400">{rec.followUpDate?fmtDate(rec.followUpDate):'—'}</div>
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
            <div className="modal-header"><h2 className="font-serif text-xl text-gray-900">{editing?'Edit Round':'Record Field Round'}</h2><button onClick={()=>setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-xl">×</button></div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Date</label><input type="date" className="field-input" value={form.date} onChange={e=>set('date',e.target.value)}/></div>
                <div><label className="field-label">Area</label><select className="field-input" value={form.area} onChange={e=>set('area',e.target.value)}>{AREAS.map(a=><option key={a}>{a}</option>)}</select></div>
                <div><label className="field-label">Conducted By *</label><input className="field-input" placeholder="Staff name" value={form.conductedBy} onChange={e=>set('conductedBy',e.target.value)}/></div>
                <div><label className="field-label">Participants</label><input className="field-input" placeholder="Names or count" value={form.participants} onChange={e=>set('participants',e.target.value)}/></div>
                <div><label className="field-label">Overall Finding</label><select className="field-input" value={form.findings} onChange={e=>set('findings',e.target.value)}>{FINDINGS.map(f=><option key={f}>{f}</option>)}</select></div>
                <div><label className="field-label">Status</label><select className="field-input" value={form.status} onChange={e=>set('status',e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
                <div className="col-span-2"><label className="field-label">Observations</label><textarea className="field-input h-16 resize-none w-full" placeholder="What was observed during the round…" value={form.observations} onChange={e=>set('observations',e.target.value)}/></div>
                <div className="col-span-2"><label className="field-label">Recommendations</label><textarea className="field-input h-16 resize-none w-full" placeholder="Actions recommended…" value={form.recommendations} onChange={e=>set('recommendations',e.target.value)}/></div>
                <div><label className="field-label">Follow-Up Date</label><input type="date" className="field-input" value={form.followUpDate} onChange={e=>set('followUpDate',e.target.value)}/></div>
              </div>
            </div>
            <div className="modal-footer"><button onClick={()=>setShowForm(false)} className="btn-ghost">Cancel</button><button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving?'Saving…':editing?'Save Changes':'Record Round'}</button></div>
          </div>
        </div>
      )}
      {deleteTarget&&(<div className="modal-backdrop" style={{zIndex:9999}}><div className="modal-box w-full max-w-sm"><div className="modal-header"><h2 className="font-serif text-lg text-gray-900">Delete Record</h2></div><div className="modal-body"><p className="text-sm text-gray-500">Delete field round for <span className="font-medium text-gray-900">{fmtDate(deleteTarget.date)}</span>?</p></div><div className="modal-footer"><button onClick={()=>setDeleteTarget(null)} className="btn-ghost">Cancel</button><button onClick={handleDelete} className="btn-danger">Delete</button></div></div></div>)}
    </div>
  );
}
