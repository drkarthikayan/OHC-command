import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate, initials } from '../../utils/formatters';

const VACCINES = ['Hepatitis B','Influenza (Flu)','Tetanus (TT/Td)','Typhoid','COVID-19','Rabies','Pneumococcal','MMR','Varicella','Custom'];
const DOSES = ['Dose 1','Dose 2','Dose 3','Booster','Single Dose','Annual'];
const ROUTES = ['IM','SC','ID','Oral'];

const EMPTY = { employeeId:'', employeeName:'', department:'', vaccine:'Hepatitis B', dose:'Dose 1', date:new Date().toISOString().slice(0,10), batchNo:'', route:'IM', givenBy:'', nextDueDate:'', remarks:'' };

function isDueSoon(d) { if(!d) return false; const diff=new Date(d)-new Date(); return diff>0&&diff<30*86400000; }
function isOverdue(d) { if(!d) return false; return new Date(d)<new Date(); }

export default function VaccinationRegister() {
  const { tenant, staffUser } = useAuthStore();
  const tid = tenant?.id;
  const canEdit = ['doctor','nurse','admin'].includes(staffUser?.role);
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [empSearch, setEmpSearch] = useState('');
  const [empDropdown, setEmpDropdown] = useState(false);
  const [search, setSearch] = useState('');
  const [filterVaccine, setFilterVaccine] = useState('');

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    if(!tid) return;
    return onSnapshot(query(collection(db,'merchants',tid,'vaccinations'), orderBy('createdAt','desc')),
      s=>{setRecords(s.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false);}, ()=>setLoading(false));
  },[tid]);

  useEffect(()=>{
    if(!tid) return;
    getDocs(collection(db,'merchants',tid,'employees')).then(s=>setEmployees(s.docs.map(d=>({id:d.id,...d.data()})))).catch(()=>{});
  },[tid]);

  const filteredEmps = employees.filter(e=>{const q=empSearch.toLowerCase(); return !q||e.name?.toLowerCase().includes(q)||e.empId?.toLowerCase().includes(q);}).slice(0,8);
  const selectEmp=(emp)=>{ set('employeeId',emp.empId||emp.id); set('employeeName',emp.name); set('department',emp.department||''); setEmpSearch(emp.name); setEmpDropdown(false); };

  const handleSave = async () => {
    if(!form.employeeId){toast.error('Select an employee.');return;}
    setSaving(true);
    try {
      const p={...form,updatedAt:serverTimestamp()};
      if(editing){await updateDoc(doc(db,'merchants',tid,'vaccinations',editing.id),p); toast.success('Record updated.');}
      else{await addDoc(collection(db,'merchants',tid,'vaccinations'),{...p,createdAt:serverTimestamp()}); toast.success('Vaccination recorded.');}
      setShowForm(false);
    }catch(e){toast.error(e.message);}finally{setSaving(false);}
  };

  const handleDelete = async()=>{
    try{await deleteDoc(doc(db,'merchants',tid,'vaccinations',deleteTarget.id)); toast.success('Deleted.');}
    catch(e){toast.error(e.message);}finally{setDeleteTarget(null);}
  };

  const filtered = records.filter(r=>(!search||r.employeeName?.toLowerCase().includes(search.toLowerCase()))&&(!filterVaccine||r.vaccine===filterVaccine));
  const dueSoon = records.filter(r=>isDueSoon(r.nextDueDate)).length;
  const overdue = records.filter(r=>isOverdue(r.nextDueDate)).length;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-3xl font-semibold text-gray-900">Vaccination Register</h1><p className="text-gray-500 text-sm mt-0.5">Employee immunisation records and dose tracking</p></div>
        {canEdit&&<button onClick={()=>{setEditing(null);setForm(EMPTY);setEmpSearch('');setShowForm(true);}} className="btn-primary">+ Record Vaccine</button>}
      </div>

      {(overdue>0||dueSoon>0)&&(
        <div className="flex flex-wrap gap-2 mb-4">
          {overdue>0&&<div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-red-50 border border-red-200 text-red-600">⚠️ {overdue} overdue dose{overdue>1?'s':''}</div>}
          {dueSoon>0&&<div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-50 border border-amber-200 text-amber-600">🔔 {dueSoon} due within 30 days</div>}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[{l:'Total Doses',v:records.length,c:'text-gray-900'},{l:'Overdue',v:overdue,c:'text-red-600'},{l:'Due Soon',v:dueSoon,c:'text-amber-600'},{l:'Vaccines',v:[...new Set(records.map(r=>r.vaccine))].length,c:'text-blue-600'}].map(s=>(
          <div key={s.l} className="stat-card"><div className={`font-serif text-3xl ${s.c} mb-0.5`}>{loading?'—':s.v}</div><div className="text-xs text-gray-400 uppercase tracking-wider">{s.l}</div></div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input className="field-input w-56" placeholder="Search employee…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="field-input w-48" value={filterVaccine} onChange={e=>setFilterVaccine(e.target.value)}>
          <option value="">All Vaccines</option>{VACCINES.map(v=><option key={v}>{v}</option>)}
        </select>
        {(search||filterVaccine)&&<button onClick={()=>{setSearch('');setFilterVaccine('');}} className="btn-ghost text-sm">Clear</button>}
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_80px_80px_80px_90px_60px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          {['Employee','Vaccine','Dose','Date','Batch','Next Due',''].map(h=><div key={h} className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{h}</div>)}
        </div>
        {loading?<div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
          :filtered.length===0?<div className="py-14 text-center"><div className="text-4xl mb-3">💉</div><div className="text-gray-400 text-sm">{records.length===0?'No vaccination records yet.':'No records match.'}</div></div>
          :filtered.map(rec=>(
            <div key={rec.id} className="grid grid-cols-[2fr_1fr_80px_80px_80px_90px_60px] gap-2 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 items-center">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-500 shrink-0">{initials(rec.employeeName)}</div>
                <div className="min-w-0"><div className="text-sm font-medium text-gray-900 truncate">{rec.employeeName}</div><div className="text-xs text-gray-400">{rec.department}</div></div>
              </div>
              <div className="text-xs text-gray-700 truncate">{rec.vaccine}</div>
              <div className="text-xs text-gray-500">{rec.dose}</div>
              <div className="text-xs text-gray-500">{rec.date?fmtDate(rec.date):'—'}</div>
              <div className="text-xs text-gray-400">{rec.batchNo||'—'}</div>
              <div className={`text-xs font-medium ${isOverdue(rec.nextDueDate)?'text-red-500':isDueSoon(rec.nextDueDate)?'text-amber-500':'text-gray-400'}`}>{rec.nextDueDate?fmtDate(rec.nextDueDate):'—'}{isOverdue(rec.nextDueDate)&&' ⚠️'}</div>
              <div className="flex gap-1">
                {canEdit&&<button onClick={()=>{setEditing(rec);setForm({...EMPTY,...rec});setEmpSearch(rec.employeeName||'');setShowForm(true);}} className="text-gray-300 hover:text-sage text-sm p-1">✏️</button>}
                {canEdit&&<button onClick={()=>setDeleteTarget(rec)} className="text-gray-300 hover:text-red-400 text-sm p-1">🗑️</button>}
              </div>
            </div>
          ))}
      </div>

      {showForm&&(
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div className="modal-box w-full max-w-xl max-h-[92vh] overflow-y-auto">
            <div className="modal-header"><h2 className="font-serif text-xl text-gray-900">{editing?'Edit Record':'Record Vaccination'}</h2><button onClick={()=>setShowForm(false)} className="text-gray-400 text-xl">×</button></div>
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
                {form.employeeId&&<div className="mt-1 text-xs text-gray-400"><span className="text-sage">✓</span> {form.employeeName}</div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Vaccine *</label><select className="field-input" value={form.vaccine} onChange={e=>set('vaccine',e.target.value)}>{VACCINES.map(v=><option key={v}>{v}</option>)}</select></div>
                <div><label className="field-label">Dose</label><select className="field-input" value={form.dose} onChange={e=>set('dose',e.target.value)}>{DOSES.map(d=><option key={d}>{d}</option>)}</select></div>
                <div><label className="field-label">Date Given</label><input type="date" className="field-input" value={form.date} onChange={e=>set('date',e.target.value)}/></div>
                <div><label className="field-label">Batch No.</label><input className="field-input" placeholder="Batch number" value={form.batchNo} onChange={e=>set('batchNo',e.target.value)}/></div>
                <div><label className="field-label">Route</label><select className="field-input" value={form.route} onChange={e=>set('route',e.target.value)}>{ROUTES.map(r=><option key={r}>{r}</option>)}</select></div>
                <div><label className="field-label">Given By</label><input className="field-input" placeholder="Staff name" value={form.givenBy} onChange={e=>set('givenBy',e.target.value)}/></div>
                <div><label className="field-label">Next Due Date</label><input type="date" className="field-input" value={form.nextDueDate} onChange={e=>set('nextDueDate',e.target.value)}/></div>
                <div className="col-span-2"><label className="field-label">Remarks</label><textarea className="field-input h-12 resize-none w-full" value={form.remarks} onChange={e=>set('remarks',e.target.value)}/></div>
              </div>
            </div>
            <div className="modal-footer"><button onClick={()=>setShowForm(false)} className="btn-ghost">Cancel</button><button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving?'Saving…':editing?'Save Changes':'Record'}</button></div>
          </div>
        </div>
      )}
      {deleteTarget&&(<div className="modal-backdrop" style={{zIndex:9999}}><div className="modal-box w-full max-w-sm"><div className="modal-header"><h2 className="font-serif text-lg text-gray-900">Delete Record</h2></div><div className="modal-body"><p className="text-sm text-gray-500">Delete vaccination record for <span className="font-medium text-gray-900">{deleteTarget.employeeName}</span>?</p></div><div className="modal-footer"><button onClick={()=>setDeleteTarget(null)} className="btn-ghost">Cancel</button><button onClick={handleDelete} className="btn-danger">Delete</button></div></div></div>)}
    </div>
  );
}
