import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate } from '../../utils/formatters';

const TOPICS = ['Ergonomics & Posture','First Aid Basics','Fire Safety','Hand Hygiene','Nutrition & Diet','Mental Health & Stress','Diabetes Awareness','Hypertension Control','Substance Abuse Prevention','Heat Stress Prevention','Noise-Induced Hearing Loss','PPE Usage','Custom'];
const FORMATS = ['Classroom Session','Hands-on Workshop','Demonstration','Video Screening','Poster Campaign','Toolbox Talk','Online Module'];
const STATUSES = ['Scheduled','Completed','Cancelled'];

const EMPTY = { date:new Date().toISOString().slice(0,10), topic:'Ergonomics & Posture', format:'Classroom Session', conductedBy:'', venue:'', attendees:'', duration:'', objectives:'', keyMessages:'', feedback:'', status:'Scheduled' };

export default function HealthEducation() {
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
  const [filterStatus, setFilterStatus] = useState('');

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    if(!tid) return;
    return onSnapshot(query(collection(db,'merchants',tid,'healthEducation'), orderBy('createdAt','desc')),
      s=>{setRecords(s.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false);},()=>setLoading(false));
  },[tid]);

  const handleSave = async()=>{
    if(!form.conductedBy){toast.error('Enter who conducted the session.');return;}
    setSaving(true);
    try {
      const p={...form,updatedAt:serverTimestamp()};
      if(editing){await updateDoc(doc(db,'merchants',tid,'healthEducation',editing.id),p);toast.success('Session updated.');}
      else{await addDoc(collection(db,'merchants',tid,'healthEducation'),{...p,createdAt:serverTimestamp()});toast.success('Session recorded.');}
      setShowForm(false);
    }catch(e){toast.error(e.message);}finally{setSaving(false);}
  };

  const handleDelete = async()=>{
    try{await deleteDoc(doc(db,'merchants',tid,'healthEducation',deleteTarget.id));toast.success('Deleted.');}
    catch(e){toast.error(e.message);}finally{setDeleteTarget(null);}
  };

  const filtered = records.filter(r=>(!search||r.topic?.toLowerCase().includes(search.toLowerCase())||r.conductedBy?.toLowerCase().includes(search.toLowerCase()))&&(!filterStatus||r.status===filterStatus));
  const totalAttendees = records.filter(r=>r.status==='Completed').reduce((s,r)=>s+(parseInt(r.attendees)||0),0);

  const STATUS_COLORS = { Scheduled:'bg-blue-50 text-blue-700 border-blue-200', Completed:'bg-green-50 text-green-700 border-green-200', Cancelled:'bg-red-50 text-red-600 border-red-200' };

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-3xl font-semibold text-gray-900">Health Education</h1><p className="text-gray-500 text-sm mt-0.5">Awareness sessions, workshops, and training records</p></div>
        {canEdit&&<button onClick={()=>{setEditing(null);setForm(EMPTY);setShowForm(true);}} className="btn-primary">+ New Session</button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[{l:'Total Sessions',v:records.length,c:'text-gray-900'},{l:'Completed',v:records.filter(r=>r.status==='Completed').length,c:'text-green-600'},{l:'Scheduled',v:records.filter(r=>r.status==='Scheduled').length,c:'text-blue-600'},{l:'Total Trained',v:totalAttendees,c:'text-purple-600'}].map(s=>(
          <div key={s.l} className="stat-card"><div className={`font-serif text-3xl ${s.c} mb-0.5`}>{loading?'—':s.v}</div><div className="text-xs text-gray-400 uppercase tracking-wider">{s.l}</div></div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input className="field-input w-56" placeholder="Search topic or staff…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="field-input w-40" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>{STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
        {(search||filterStatus)&&<button onClick={()=>{setSearch('');setFilterStatus('');}} className="btn-ghost text-sm">Clear</button>}
      </div>

      {/* Calendar-style cards for Scheduled */}
      {records.filter(r=>r.status==='Scheduled').length>0&&!filterStatus&&!search&&(
        <div className="mb-4">
          <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Upcoming Sessions</div>
          <div className="flex flex-wrap gap-3">
            {records.filter(r=>r.status==='Scheduled').slice(0,4).map(rec=>(
              <div key={rec.id} className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 min-w-[180px]">
                <div className="text-xs text-blue-400 mb-0.5">{fmtDate(rec.date)}</div>
                <div className="text-sm font-semibold text-blue-900">{rec.topic}</div>
                <div className="text-xs text-blue-400">{rec.format}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[90px_2fr_1fr_80px_60px_70px_80px_60px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          {['Date','Topic','Format','Conducted By','Duration','Attendees','Status',''].map(h=><div key={h} className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{h}</div>)}
        </div>
        {loading?<div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
          :filtered.length===0?<div className="py-14 text-center"><div className="text-4xl mb-3">🎓</div><div className="text-gray-400 text-sm">{records.length===0?'No sessions recorded yet.':'No records match.'}</div></div>
          :filtered.map(rec=>(
            <div key={rec.id} className="grid grid-cols-[90px_2fr_1fr_80px_60px_70px_80px_60px] gap-2 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 items-center">
              <div className="text-xs text-gray-500">{fmtDate(rec.date)}</div>
              <div className="text-sm font-medium text-gray-900 truncate">{rec.topic}</div>
              <div className="text-xs text-gray-400 truncate">{rec.format}</div>
              <div className="text-xs text-gray-500 truncate">{rec.conductedBy}</div>
              <div className="text-xs text-gray-400">{rec.duration?rec.duration+' min':'—'}</div>
              <div className="text-sm font-medium text-center text-gray-700">{rec.attendees||'—'}</div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[rec.status]||''}`}>{rec.status}</span>
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
            <div className="modal-header"><h2 className="font-serif text-xl text-gray-900">{editing?'Edit Session':'Record Session'}</h2><button onClick={()=>setShowForm(false)} className="text-gray-400 text-xl">×</button></div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Date</label><input type="date" className="field-input" value={form.date} onChange={e=>set('date',e.target.value)}/></div>
                <div><label className="field-label">Topic *</label><select className="field-input" value={form.topic} onChange={e=>set('topic',e.target.value)}>{TOPICS.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label className="field-label">Format</label><select className="field-input" value={form.format} onChange={e=>set('format',e.target.value)}>{FORMATS.map(f=><option key={f}>{f}</option>)}</select></div>
                <div><label className="field-label">Conducted By *</label><input className="field-input" placeholder="Facilitator name" value={form.conductedBy} onChange={e=>set('conductedBy',e.target.value)}/></div>
                <div><label className="field-label">Venue</label><input className="field-input" placeholder="Location" value={form.venue} onChange={e=>set('venue',e.target.value)}/></div>
                <div><label className="field-label">Duration (mins)</label><input type="number" className="field-input" placeholder="60" value={form.duration} onChange={e=>set('duration',e.target.value)}/></div>
                <div><label className="field-label">No. of Attendees</label><input type="number" className="field-input" placeholder="0" value={form.attendees} onChange={e=>set('attendees',e.target.value)}/></div>
                <div><label className="field-label">Status</label><select className="field-input" value={form.status} onChange={e=>set('status',e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
                <div className="col-span-2"><label className="field-label">Objectives</label><textarea className="field-input h-14 resize-none w-full" value={form.objectives} onChange={e=>set('objectives',e.target.value)}/></div>
                <div className="col-span-2"><label className="field-label">Key Messages</label><textarea className="field-input h-14 resize-none w-full" value={form.keyMessages} onChange={e=>set('keyMessages',e.target.value)}/></div>
                <div className="col-span-2"><label className="field-label">Feedback / Outcome</label><textarea className="field-input h-14 resize-none w-full" value={form.feedback} onChange={e=>set('feedback',e.target.value)}/></div>
              </div>
            </div>
            <div className="modal-footer"><button onClick={()=>setShowForm(false)} className="btn-ghost">Cancel</button><button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving?'Saving…':editing?'Save Changes':'Record Session'}</button></div>
          </div>
        </div>
      )}
      {deleteTarget&&(<div className="modal-backdrop" style={{zIndex:9999}}><div className="modal-box w-full max-w-sm"><div className="modal-header"><h2 className="font-serif text-lg text-gray-900">Delete Session</h2></div><div className="modal-body"><p className="text-sm text-gray-500">Delete this session?</p></div><div className="modal-footer"><button onClick={()=>setDeleteTarget(null)} className="btn-ghost">Cancel</button><button onClick={handleDelete} className="btn-danger">Delete</button></div></div></div>)}
    </div>
  );
}
