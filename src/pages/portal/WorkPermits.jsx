import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate } from '../../utils/formatters';

const PERMIT_TYPES = ['Hot Work','Cold Work','Confined Space Entry','Working at Height','Electrical Work','Excavation','Chemical Handling','Radiation Work','Custom'];
const RISK_LEVELS = ['Low','Medium','High','Critical'];
const STATUSES = ['Pending Approval','Approved','Active','Completed','Cancelled','Expired'];
const RISK_COLORS = { Low:'bg-green-50 text-green-700 border-green-200', Medium:'bg-yellow-50 text-yellow-700 border-yellow-200', High:'bg-orange-50 text-orange-700 border-orange-200', Critical:'bg-red-50 text-red-700 border-red-200' };
const STATUS_COLORS = { 'Pending Approval':'bg-yellow-50 text-yellow-700 border-yellow-200', Approved:'bg-blue-50 text-blue-700 border-blue-200', Active:'bg-green-50 text-green-700 border-green-200', Completed:'bg-gray-50 text-gray-600 border-gray-200', Cancelled:'bg-red-50 text-red-600 border-red-200', Expired:'bg-red-50 text-red-400 border-red-100' };
const EMPTY = { permitNo:'', permitType:'Hot Work', workDescription:'', location:'', contractor:'', startDate:new Date().toISOString().slice(0,10), endDate:'', riskLevel:'Medium', approvedBy:'', precautions:'', ppe:'', emergencyProcedure:'', status:'Pending Approval' };

function isExpired(d) { return d && new Date(d) < new Date(); }

export default function WorkPermits() {
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
    return onSnapshot(query(collection(db,'merchants',tid,'workPermits'), orderBy('createdAt','desc')),
      s=>{setRecords(s.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false);},()=>setLoading(false));
  },[tid]);

  const handleSave = async()=>{
    if(!form.permitType||!form.workDescription){toast.error('Fill required fields.');return;}
    setSaving(true);
    try {
      const p={...form,updatedAt:serverTimestamp()};
      if(editing){await updateDoc(doc(db,'merchants',tid,'workPermits',editing.id),p);toast.success('Permit updated.');}
      else{
        const count = records.length+1;
        const pNo = form.permitNo || `WP-${new Date().getFullYear()}-${String(count).padStart(3,'0')}`;
        await addDoc(collection(db,'merchants',tid,'workPermits'),{...p,permitNo:pNo,createdAt:serverTimestamp()});
        toast.success('Work permit created.');
      }
      setShowForm(false);
    }catch(e){toast.error(e.message);}finally{setSaving(false);}
  };

  const handleDelete = async()=>{
    try{await deleteDoc(doc(db,'merchants',tid,'workPermits',deleteTarget.id));toast.success('Deleted.');}
    catch(e){toast.error(e.message);}finally{setDeleteTarget(null);}
  };

  const filtered = records.filter(r=>(!search||r.permitType?.toLowerCase().includes(search.toLowerCase())||r.contractor?.toLowerCase().includes(search.toLowerCase())||r.permitNo?.toLowerCase().includes(search.toLowerCase()))&&(!filterStatus||r.status===filterStatus));
  const active = records.filter(r=>r.status==='Active').length;
  const pendingApproval = records.filter(r=>r.status==='Pending Approval').length;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-3xl font-semibold text-gray-900">Work Permits</h1><p className="text-gray-500 text-sm mt-0.5">Hazardous work authorization and tracking</p></div>
        {canEdit&&<button onClick={()=>{setEditing(null);setForm(EMPTY);setShowForm(true);}} className="btn-primary">+ New Permit</button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[{l:'Total',v:records.length,c:'text-gray-900'},{l:'Active',v:active,c:'text-green-600'},{l:'Pending Approval',v:pendingApproval,c:'text-amber-600'},{l:'Completed',v:records.filter(r=>r.status==='Completed').length,c:'text-blue-600'}].map(s=>(
          <div key={s.l} className="stat-card"><div className={`font-serif text-3xl ${s.c} mb-0.5`}>{loading?'—':s.v}</div><div className="text-xs text-gray-400 uppercase tracking-wider">{s.l}</div></div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input className="field-input w-56" placeholder="Search permit, contractor…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="field-input w-44" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>{STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
        {(search||filterStatus)&&<button onClick={()=>{setSearch('');setFilterStatus('');}} className="btn-ghost text-sm">Clear</button>}
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[80px_1fr_1fr_80px_90px_80px_60px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          {['Permit #','Type','Contractor','Risk','Valid Until','Status',''].map(h=><div key={h} className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{h}</div>)}
        </div>
        {loading?<div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
          :filtered.length===0?<div className="py-14 text-center"><div className="text-4xl mb-3">🏗️</div><div className="text-gray-400 text-sm">{records.length===0?'No work permits yet.':'No records match.'}</div></div>
          :filtered.map(rec=>(
            <div key={rec.id} className="grid grid-cols-[80px_1fr_1fr_80px_90px_80px_60px] gap-2 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 items-center">
              <div className="text-xs font-mono text-gray-500">{rec.permitNo}</div>
              <div className="text-sm font-medium text-gray-900 truncate">{rec.permitType}</div>
              <div className="text-xs text-gray-500 truncate">{rec.contractor||'—'}</div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${RISK_COLORS[rec.riskLevel]||''}`}>{rec.riskLevel}</span>
              <div className={`text-xs ${isExpired(rec.endDate)&&rec.status!=='Completed'?'text-red-500 font-medium':'text-gray-400'}`}>{rec.endDate?fmtDate(rec.endDate):'—'}</div>
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
            <div className="modal-header"><h2 className="font-serif text-xl text-gray-900">{editing?'Edit Permit':'New Work Permit'}</h2><button onClick={()=>setShowForm(false)} className="text-gray-400 text-xl">×</button></div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Permit No.</label><input className="field-input" placeholder="Auto-generated" value={form.permitNo} onChange={e=>set('permitNo',e.target.value)}/></div>
                <div><label className="field-label">Permit Type *</label><select className="field-input" value={form.permitType} onChange={e=>set('permitType',e.target.value)}>{PERMIT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                <div className="col-span-2"><label className="field-label">Work Description *</label><textarea className="field-input h-14 resize-none w-full" placeholder="Describe the work to be carried out…" value={form.workDescription} onChange={e=>set('workDescription',e.target.value)}/></div>
                <div><label className="field-label">Location</label><input className="field-input" placeholder="Work location" value={form.location} onChange={e=>set('location',e.target.value)}/></div>
                <div><label className="field-label">Contractor/Worker</label><input className="field-input" placeholder="Name or company" value={form.contractor} onChange={e=>set('contractor',e.target.value)}/></div>
                <div><label className="field-label">Start Date</label><input type="date" className="field-input" value={form.startDate} onChange={e=>set('startDate',e.target.value)}/></div>
                <div><label className="field-label">End Date</label><input type="date" className="field-input" value={form.endDate} onChange={e=>set('endDate',e.target.value)}/></div>
                <div><label className="field-label">Risk Level</label><select className="field-input" value={form.riskLevel} onChange={e=>set('riskLevel',e.target.value)}>{RISK_LEVELS.map(r=><option key={r}>{r}</option>)}</select></div>
                <div><label className="field-label">Approved By</label><input className="field-input" placeholder="Approving officer" value={form.approvedBy} onChange={e=>set('approvedBy',e.target.value)}/></div>
                <div><label className="field-label">Status</label><select className="field-input" value={form.status} onChange={e=>set('status',e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
                <div><label className="field-label">PPE Required</label><input className="field-input" placeholder="Gloves, helmet, etc." value={form.ppe} onChange={e=>set('ppe',e.target.value)}/></div>
                <div className="col-span-2"><label className="field-label">Precautions</label><textarea className="field-input h-14 resize-none w-full" value={form.precautions} onChange={e=>set('precautions',e.target.value)}/></div>
              </div>
            </div>
            <div className="modal-footer"><button onClick={()=>setShowForm(false)} className="btn-ghost">Cancel</button><button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving?'Saving…':editing?'Save Changes':'Create Permit'}</button></div>
          </div>
        </div>
      )}
      {deleteTarget&&(<div className="modal-backdrop" style={{zIndex:9999}}><div className="modal-box w-full max-w-sm"><div className="modal-header"><h2 className="font-serif text-lg text-gray-900">Delete Permit</h2></div><div className="modal-body"><p className="text-sm text-gray-500">Delete permit <span className="font-medium text-gray-900">{deleteTarget.permitNo}</span>?</p></div><div className="modal-footer"><button onClick={()=>setDeleteTarget(null)} className="btn-ghost">Cancel</button><button onClick={handleDelete} className="btn-danger">Delete</button></div></div></div>)}
    </div>
  );
}
