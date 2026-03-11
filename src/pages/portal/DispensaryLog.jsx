import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate, initials } from '../../utils/formatters';

const VISIT_TYPES = ['OPD Visit','Injury','Pre-Employment','Periodic Exam','Vaccination','Dressing/Wound Care','Referral','Custom'];
const COMPLAINT_TYPES = ['Headache','Fever','Bodyache','Eye Irritation','Skin Rash','Nausea/Vomiting','Back Pain','Cut/Wound','Burns','Breathlessness','Chest Pain','Abdominal Pain','Other'];
const DISPOSITIONS = ['Treated & Discharged','Referred to Hospital','Rest Advised','Sent to Work','Follow-Up Needed'];

const EMPTY = { date:new Date().toISOString().slice(0,10), time:new Date().toTimeString().slice(0,5), employeeId:'', employeeName:'', department:'', visitType:'OPD Visit', complaint:'Headache', presentingComplaints:'', vitals:{ bp:'', pulse:'', temp:'', spo2:'' }, diagnosis:'', treatment:'', medicinesGiven:'', disposition:'Treated & Discharged', attendedBy:'', remarks:'' };

export default function DispensaryLog() {
  const { tenant, staffUser } = useAuthStore();
  const tid = tenant?.id;
  const canEdit = ['doctor','nurse','admin'].includes(staffUser?.role);
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [empSearch, setEmpSearch] = useState('');
  const [empDropdown, setEmpDropdown] = useState(false);
  const [search, setSearch] = useState('');
  const [filterVisit, setFilterVisit] = useState('');
  const [today, setToday] = useState(false);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const setVital = (k,v) => setForm(f=>({...f,vitals:{...f.vitals,[k]:v}}));

  useEffect(()=>{
    if(!tid) return;
    return onSnapshot(query(collection(db,'merchants',tid,'dispensaryLog'), orderBy('createdAt','desc')),
      s=>{setRecords(s.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false);},()=>setLoading(false));
  },[tid]);

  useEffect(()=>{
    if(!tid) return;
    getDocs(collection(db,'merchants',tid,'employees')).then(s=>setEmployees(s.docs.map(d=>({id:d.id,...d.data()})))).catch(()=>{});
  },[tid]);

  const filteredEmps = employees.filter(e=>{const q=empSearch.toLowerCase();return !q||e.name?.toLowerCase().includes(q)||e.empId?.toLowerCase().includes(q);}).slice(0,8);
  const selectEmp=(emp)=>{set('employeeId',emp.empId||emp.id);set('employeeName',emp.name);set('department',emp.department||'');setEmpSearch(emp.name);setEmpDropdown(false);};

  const handleSave = async()=>{
    if(!form.employeeId){toast.error('Select an employee.');return;}
    setSaving(true);
    try {
      const p={...form,updatedAt:serverTimestamp()};
      if(editing){await updateDoc(doc(db,'merchants',tid,'dispensaryLog',editing.id),p);toast.success('Log updated.');}
      else{await addDoc(collection(db,'merchants',tid,'dispensaryLog'),{...p,createdAt:serverTimestamp()});toast.success('Visit logged.');}
      setShowForm(false);
    }catch(e){toast.error(e.message);}finally{setSaving(false);}
  };

  const handleDelete = async()=>{
    try{await deleteDoc(doc(db,'merchants',tid,'dispensaryLog',deleteTarget.id));toast.success('Deleted.');}
    catch(e){toast.error(e.message);}finally{setDeleteTarget(null);}
  };

  const todayStr = new Date().toISOString().slice(0,10);
  const filtered = records.filter(r=>{
    const matchSearch = !search||(r.employeeName?.toLowerCase().includes(search.toLowerCase())||r.complaint?.toLowerCase().includes(search.toLowerCase()));
    const matchVisit = !filterVisit||r.visitType===filterVisit;
    const matchToday = !today||r.date===todayStr;
    return matchSearch&&matchVisit&&matchToday;
  });

  const DISP_COLORS = { 'Treated & Discharged':'bg-green-50 text-green-700 border-green-200', 'Referred to Hospital':'bg-red-50 text-red-700 border-red-200', 'Rest Advised':'bg-yellow-50 text-yellow-700 border-yellow-200', 'Sent to Work':'bg-blue-50 text-blue-700 border-blue-200', 'Follow-Up Needed':'bg-orange-50 text-orange-700 border-orange-200' };

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-3xl font-semibold text-gray-900">Dispensary Log</h1><p className="text-gray-500 text-sm mt-0.5">Daily OHC visit register and treatment records</p></div>
        {canEdit&&<button onClick={()=>{setEditing(null);setForm(EMPTY);setEmpSearch('');setShowForm(true);}} className="btn-primary">+ Log Visit</button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[{l:'Total Visits',v:records.length,c:'text-gray-900'},{l:'Today',v:records.filter(r=>r.date===todayStr).length,c:'text-blue-600'},{l:'Referred',v:records.filter(r=>r.disposition==='Referred to Hospital').length,c:'text-red-600'},{l:'This Month',v:records.filter(r=>r.date?.slice(0,7)===todayStr.slice(0,7)).length,c:'text-green-600'}].map(s=>(
          <div key={s.l} className="stat-card"><div className={`font-serif text-3xl ${s.c} mb-0.5`}>{loading?'—':s.v}</div><div className="text-xs text-gray-400 uppercase tracking-wider">{s.l}</div></div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input className="field-input w-52" placeholder="Search employee or complaint…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="field-input w-44" value={filterVisit} onChange={e=>setFilterVisit(e.target.value)}>
          <option value="">All Visit Types</option>{VISIT_TYPES.map(v=><option key={v}>{v}</option>)}
        </select>
        <button onClick={()=>setToday(t=>!t)} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${today?'bg-sage text-white border-sage':'bg-white text-gray-500 border-gray-200 hover:border-sage'}`}>Today Only</button>
        {(search||filterVisit)&&<button onClick={()=>{setSearch('');setFilterVisit('');}} className="btn-ghost text-sm">Clear</button>}
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[80px_50px_2fr_1fr_1fr_1fr_100px_60px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          {['Date','Time','Employee','Visit Type','Complaint','Attended By','Disposition',''].map(h=><div key={h} className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{h}</div>)}
        </div>
        {loading?<div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
          :filtered.length===0?<div className="py-14 text-center"><div className="text-4xl mb-3">📋</div><div className="text-gray-400 text-sm">{records.length===0?'No visits logged yet.':'No records match.'}</div></div>
          :filtered.map(rec=>(
            <div key={rec.id} className="grid grid-cols-[80px_50px_2fr_1fr_1fr_1fr_100px_60px] gap-2 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 items-center cursor-pointer" onClick={()=>setViewing(rec)}>
              <div className="text-xs text-gray-500">{fmtDate(rec.date)}</div>
              <div className="text-xs text-gray-400">{rec.time||'—'}</div>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-sage/10 flex items-center justify-center text-xs font-bold text-sage shrink-0">{initials(rec.employeeName)}</div>
                <div className="min-w-0"><div className="text-sm font-medium text-gray-900 truncate">{rec.employeeName}</div><div className="text-xs text-gray-400 truncate">{rec.department}</div></div>
              </div>
              <div className="text-xs text-gray-500 truncate">{rec.visitType}</div>
              <div className="text-xs text-gray-600 truncate">{rec.complaint}</div>
              <div className="text-xs text-gray-400 truncate">{rec.attendedBy||'—'}</div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${DISP_COLORS[rec.disposition]||'bg-gray-50 text-gray-500 border-gray-200'}`}>{rec.disposition}</span>
              <div className="flex gap-1" onClick={e=>e.stopPropagation()}>
                {canEdit&&<button onClick={()=>{setEditing(rec);setForm({...EMPTY,...rec,vitals:{...EMPTY.vitals,...rec.vitals}});setEmpSearch(rec.employeeName||'');setShowForm(true);}} className="text-gray-300 hover:text-sage text-sm p-1">✏️</button>}
                {canEdit&&<button onClick={()=>setDeleteTarget(rec)} className="text-gray-300 hover:text-red-400 text-sm p-1">🗑️</button>}
              </div>
            </div>
          ))}
      </div>

      {/* View modal */}
      {viewing&&(
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setViewing(null)}>
          <div className="modal-box w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="modal-header">
              <div><h2 className="font-serif text-xl text-gray-900">Visit Details</h2><p className="text-xs text-gray-400">{fmtDate(viewing.date)} {viewing.time&&`· ${viewing.time}`}</p></div>
              <button onClick={()=>setViewing(null)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center text-base font-bold text-sage">{initials(viewing.employeeName)}</div>
                <div><div className="font-semibold text-gray-900">{viewing.employeeName}</div><div className="text-xs text-gray-400">{viewing.department}</div></div>
                <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border ${DISP_COLORS[viewing.disposition]||''}`}>{viewing.disposition}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400 text-xs uppercase tracking-wide">Visit Type</span><div className="font-medium text-gray-900 mt-0.5">{viewing.visitType}</div></div>
                <div><span className="text-gray-400 text-xs uppercase tracking-wide">Complaint</span><div className="font-medium text-gray-900 mt-0.5">{viewing.complaint}</div></div>
                {viewing.presentingComplaints&&<div className="col-span-2"><span className="text-gray-400 text-xs uppercase tracking-wide">Presenting Complaints</span><div className="font-medium text-gray-900 mt-0.5">{viewing.presentingComplaints}</div></div>}
                {(viewing.vitals?.bp||viewing.vitals?.pulse||viewing.vitals?.temp||viewing.vitals?.spo2)&&(
                  <div className="col-span-2 bg-blue-50 rounded-xl p-3">
                    <div className="text-xs font-bold uppercase tracking-wide text-blue-400 mb-2">Vitals</div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {[['BP',viewing.vitals?.bp,'mmHg'],['Pulse',viewing.vitals?.pulse,'bpm'],['Temp',viewing.vitals?.temp,'°C'],['SpO₂',viewing.vitals?.spo2,'%']].map(([l,v,u])=>v&&(
                        <div key={l} className="text-center"><div className="text-blue-300 mb-0.5">{l}</div><div className="font-bold text-blue-900">{v}<span className="text-[10px] text-blue-400"> {u}</span></div></div>
                      ))}
                    </div>
                  </div>
                )}
                {viewing.diagnosis&&<div className="col-span-2"><span className="text-gray-400 text-xs uppercase tracking-wide">Diagnosis</span><div className="font-medium text-gray-900 mt-0.5">{viewing.diagnosis}</div></div>}
                {viewing.treatment&&<div className="col-span-2"><span className="text-gray-400 text-xs uppercase tracking-wide">Treatment</span><div className="font-medium text-gray-900 mt-0.5">{viewing.treatment}</div></div>}
                {viewing.medicinesGiven&&<div className="col-span-2"><span className="text-gray-400 text-xs uppercase tracking-wide">Medicines Given</span><div className="font-medium text-gray-900 mt-0.5">{viewing.medicinesGiven}</div></div>}
                {viewing.attendedBy&&<div><span className="text-gray-400 text-xs uppercase tracking-wide">Attended By</span><div className="font-medium text-gray-900 mt-0.5">{viewing.attendedBy}</div></div>}
              </div>
            </div>
            <div className="modal-footer"><button onClick={()=>setViewing(null)} className="btn-ghost">Close</button></div>
          </div>
        </div>
      )}

      {showForm&&(
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div className="modal-box w-full max-w-xl max-h-[92vh] overflow-y-auto">
            <div className="modal-header"><h2 className="font-serif text-xl text-gray-900">{editing?'Edit Visit':'Log Visit'}</h2><button onClick={()=>setShowForm(false)} className="text-gray-400 text-xl">×</button></div>
            <div className="modal-body space-y-4">
              <div className="relative">
                <label className="field-label">Search Employee *</label>
                <input className="field-input" placeholder="Type name or ID…" value={empSearch} onChange={e=>{setEmpSearch(e.target.value);setEmpDropdown(true);}} onFocus={()=>setEmpDropdown(true)}/>
                {empDropdown&&empSearch&&filteredEmps.length>0&&(
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {filteredEmps.map(emp=>(
                      <button key={emp.id} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 text-left" onMouseDown={()=>selectEmp(emp)}>
                        <div className="w-7 h-7 rounded-full bg-sage/10 flex items-center justify-center text-xs font-bold text-sage shrink-0">{initials(emp.name)}</div>
                        <div><div className="text-sm text-gray-900">{emp.name}</div><div className="text-xs text-gray-400">{emp.empId} · {emp.department}</div></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Date</label><input type="date" className="field-input" value={form.date} onChange={e=>set('date',e.target.value)}/></div>
                <div><label className="field-label">Time</label><input type="time" className="field-input" value={form.time} onChange={e=>set('time',e.target.value)}/></div>
                <div><label className="field-label">Visit Type</label><select className="field-input" value={form.visitType} onChange={e=>set('visitType',e.target.value)}>{VISIT_TYPES.map(v=><option key={v}>{v}</option>)}</select></div>
                <div><label className="field-label">Complaint</label><select className="field-input" value={form.complaint} onChange={e=>set('complaint',e.target.value)}>{COMPLAINT_TYPES.map(c=><option key={c}>{c}</option>)}</select></div>
                <div className="col-span-2"><label className="field-label">Presenting Complaints</label><textarea className="field-input h-12 resize-none w-full" value={form.presentingComplaints} onChange={e=>set('presentingComplaints',e.target.value)}/></div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-blue-400 mb-2">Vitals</div>
                <div className="grid grid-cols-4 gap-2">
                  {[['bp','BP (mmHg)','120/80'],['pulse','Pulse (bpm)','72'],['temp','Temp (°C)','37.0'],['spo2','SpO₂ (%)','98']].map(([k,l,p])=>(
                    <div key={k}><label className="text-[10px] text-blue-400 uppercase tracking-wide">{l}</label><input className="field-input text-sm mt-0.5" placeholder={p} value={form.vitals?.[k]||''} onChange={e=>setVital(k,e.target.value)}/></div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="field-label">Diagnosis</label><input className="field-input" value={form.diagnosis} onChange={e=>set('diagnosis',e.target.value)}/></div>
                <div className="col-span-2"><label className="field-label">Treatment Given</label><textarea className="field-input h-12 resize-none w-full" value={form.treatment} onChange={e=>set('treatment',e.target.value)}/></div>
                <div className="col-span-2"><label className="field-label">Medicines Given</label><textarea className="field-input h-12 resize-none w-full" placeholder="Drug name, dose, frequency…" value={form.medicinesGiven} onChange={e=>set('medicinesGiven',e.target.value)}/></div>
                <div><label className="field-label">Attended By</label><input className="field-input" value={form.attendedBy} onChange={e=>set('attendedBy',e.target.value)}/></div>
                <div><label className="field-label">Disposition</label><select className="field-input" value={form.disposition} onChange={e=>set('disposition',e.target.value)}>{DISPOSITIONS.map(d=><option key={d}>{d}</option>)}</select></div>
              </div>
            </div>
            <div className="modal-footer"><button onClick={()=>setShowForm(false)} className="btn-ghost">Cancel</button><button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving?'Saving…':editing?'Save Changes':'Log Visit'}</button></div>
          </div>
        </div>
      )}
      {deleteTarget&&(<div className="modal-backdrop" style={{zIndex:9999}}><div className="modal-box w-full max-w-sm"><div className="modal-header"><h2 className="font-serif text-lg text-gray-900">Delete Visit</h2></div><div className="modal-body"><p className="text-sm text-gray-500">Delete this dispensary log entry?</p></div><div className="modal-footer"><button onClick={()=>setDeleteTarget(null)} className="btn-ghost">Cancel</button><button onClick={handleDelete} className="btn-danger">Delete</button></div></div></div>)}
    </div>
  );
}
