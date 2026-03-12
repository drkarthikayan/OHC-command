import { exportOpdRegister, ExportPdfButton } from './PdfExport';
import toast from 'react-hot-toast';
import { useState, useEffect, useRef } from 'react';
import { db } from '../../config/firebase';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, getDocs, writeBatch
} from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate, initials } from '../../utils/formatters';

const COMPLAINTS = ['Fever','Headache','Back Pain','Body Ache','Cold & Cough','Stomach Pain','Injury','Eye Issue','BP Check','General Checkup','Other'];
const VITALS_EMPTY = { bp:'', pulse:'', temp:'', spo2:'', weight:'', height:'' };
const FREQUENCY_OPTIONS = ['Once daily','Twice daily','Three times daily','Four times daily','SOS (as needed)','Before food','After food','At bedtime'];
const DURATION_OPTIONS = ['1 day','2 days','3 days','5 days','7 days','10 days','14 days','1 month'];

const EMPTY_VISIT = {
  employeeId:'', employeeName:'', department:'',
  visitDate: new Date().toISOString().slice(0,10),
  complaint:'', complaints:[],
  vitals:{ ...VITALS_EMPTY },
  diagnosis:'', advice:'', followUp:'', doctorName:'', status:'Open',
  prescription:[],
};

// ─── Prescription line item ───────────────────────────────────────────────────
const EMPTY_RX = { pharmacyId:'', medicineName:'', quantity:'1', frequency:'Twice daily', duration:'3 days', instructions:'' };

function PrescriptionBuilder({ pharmacyItems, prescription, setPrescription }) {
  const [medSearch, setMedSearch] = useState('');
  const [activeIdx, setActiveIdx] = useState(null);
  const searchRef = useRef();

  const addLine = () => setPrescription(p => [...p, { ...EMPTY_RX, _id: Date.now() }]);
  const removeLine = (idx) => setPrescription(p => p.filter((_,i)=>i!==idx));
  const setLine = (idx, k, v) => setPrescription(p => p.map((l,i) => i===idx ? {...l,[k]:v} : l));

  const pickMed = (idx, item) => {
    setLine(idx, 'pharmacyId', item.id);
    setLine(idx, 'medicineName', item.name);
    setActiveIdx(null);
    setMedSearch('');
  };

  const medResults = medSearch
    ? pharmacyItems.filter(i => i.name?.toLowerCase().includes(medSearch.toLowerCase()) && i.quantity > 0).slice(0,6)
    : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="field-label mb-0">Prescription</label>
        <button type="button" onClick={addLine}
          className="text-xs text-accent hover:text-accent/80 border border-accent/30 hover:border-accent/60 px-2.5 py-1 rounded-lg transition-colors">
          + Add Medicine
        </button>
      </div>

      {prescription.length === 0 && (
        <div className="border-2 border-dashed border-border rounded-xl py-5 text-center text-muted text-sm cursor-pointer hover:border-accent/30 transition-colors" onClick={addLine}>
          💊 Click "+ Add Medicine" to prescribe from pharmacy stock
        </div>
      )}

      {prescription.map((line, idx) => (
        <div key={line._id||idx} className="bg-surface2 rounded-xl p-3 space-y-2.5 border border-border relative">
          <button type="button" onClick={()=>removeLine(idx)} className="absolute top-2 right-2 text-muted hover:text-red-400 text-sm w-5 h-5 flex items-center justify-center">×</button>

          {/* Medicine picker */}
          <div className="relative">
            <div className="text-[10px] text-muted mb-1 font-semibold uppercase tracking-wide">Medicine</div>
            {line.medicineName ? (
              <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
                <span className="text-sm text-text font-medium flex-1">{line.medicineName}</span>
                {line.pharmacyId && (() => {
                  const item = pharmacyItems.find(i=>i.id===line.pharmacyId);
                  return item ? (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${item.quantity <= (item.minStock||10) ? 'bg-amber-500/15 text-amber-400' : 'bg-accent/15 text-accent'}`}>
                      Stock: {item.quantity} {item.unit||''}
                    </span>
                  ) : null;
                })()}
                <button type="button" onClick={()=>{setLine(idx,'medicineName','');setLine(idx,'pharmacyId','');}} className="text-muted hover:text-text text-xs">✕</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  className="field-input text-sm"
                  placeholder="Search pharmacy stock…"
                  value={activeIdx===idx ? medSearch : ''}
                  onFocus={()=>setActiveIdx(idx)}
                  onChange={e=>{setMedSearch(e.target.value);setActiveIdx(idx);}}
                />
                {activeIdx===idx && medResults.length>0 && (
                  <div className="absolute z-30 w-full bg-surface border border-border rounded-xl mt-1 shadow-xl overflow-hidden">
                    {medResults.map(item=>(
                      <button type="button" key={item.id} onClick={()=>pickMed(idx,item)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-surface2 text-left transition-colors">
                        <span className="text-sm text-text flex-1">{item.name}</span>
                        <span className="text-xs text-muted">{item.unit}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ml-1 ${item.quantity<=(item.minStock||10)?'bg-amber-500/15 text-amber-400':'bg-accent/15 text-accent'}`}>
                          {item.quantity} left
                        </span>
                      </button>
                    ))}
                    {medSearch && medResults.length===0 && (
                      <div className="px-3 py-3 text-sm text-muted text-center">No items found in stock</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-[10px] text-muted mb-1 font-semibold uppercase tracking-wide">Qty</div>
              <input type="number" className="field-input text-sm py-1.5" min="1" value={line.quantity}
                onChange={e=>setLine(idx,'quantity',e.target.value)} />
            </div>
            <div>
              <div className="text-[10px] text-muted mb-1 font-semibold uppercase tracking-wide">Frequency</div>
              <select className="field-input text-sm py-1.5" value={line.frequency} onChange={e=>setLine(idx,'frequency',e.target.value)}>
                {FREQUENCY_OPTIONS.map(f=><option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] text-muted mb-1 font-semibold uppercase tracking-wide">Duration</div>
              <select className="field-input text-sm py-1.5" value={line.duration} onChange={e=>setLine(idx,'duration',e.target.value)}>
                {DURATION_OPTIONS.map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-muted mb-1 font-semibold uppercase tracking-wide">Special Instructions</div>
            <input className="field-input text-sm py-1.5" placeholder="e.g. Take after food, avoid alcohol…"
              value={line.instructions} onChange={e=>setLine(idx,'instructions',e.target.value)} />
          </div>
        </div>
      ))}

      {prescription.length > 0 && (
        <div className="text-xs text-muted bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          ⚠️ Saving this visit will automatically deduct the prescribed quantities from pharmacy stock.
        </div>
      )}
    </div>
  );
}

// ─── Prescription view (read-only) ───────────────────────────────────────────
function PrescriptionView({ prescription }) {
  if (!prescription?.length) return null;
  return (
    <div>
      <div className="field-label mb-2">Prescription</div>
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[2fr_60px_1fr_1fr] gap-2 px-3 py-2 bg-surface2 border-b border-border">
          {['Medicine','Qty','Frequency','Duration'].map(h=>(
            <div key={h} className="text-[10px] font-bold text-muted uppercase tracking-wide">{h}</div>
          ))}
        </div>
        {prescription.map((rx, i)=>(
          <div key={i} className="grid grid-cols-[2fr_60px_1fr_1fr] gap-2 px-3 py-2.5 border-b border-border/50 last:border-0 items-start">
            <div>
              <div className="text-sm font-medium text-text">{rx.medicineName}</div>
              {rx.instructions && <div className="text-xs text-muted mt-0.5 italic">{rx.instructions}</div>}
            </div>
            <div className="text-sm text-text font-semibold">{rx.quantity}</div>
            <div className="text-sm text-muted">{rx.frequency}</div>
            <div className="text-sm text-muted">{rx.duration}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OpdPage() {
  const { tenant, staffUser } = useAuthStore();
  const [visits, setVisits] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [pharmacyItems, setPharmacyItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState(EMPTY_VISIT);
  const [prescription, setPrescription] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [empSearch, setEmpSearch] = useState('');

  const tid = tenant?.id;
  const role = staffUser?.role || 'staff';
  const canEdit = ['admin','doctor','nurse'].includes(role);

  useEffect(() => {
    if (!tid) return;
    const unsub = onSnapshot(
      query(collection(db,'merchants',tid,'opd'), orderBy('createdAt','desc')),
      snap=>{setVisits(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);},
      ()=>setLoading(false)
    );
    getDocs(collection(db,'merchants',tid,'employees')).then(s=>setEmployees(s.docs.map(d=>({id:d.id,...d.data()}))));
    // Live pharmacy stock so prescription builder shows real-time quantities
    const unsubP = onSnapshot(collection(db,'merchants',tid,'pharmacy'), snap=>
      setPharmacyItems(snap.docs.map(d=>({id:d.id,...d.data()})))
    );
    return ()=>{unsub();unsubP();};
  }, [tid]);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const setVital = (k,v) => setForm(f=>({...f,vitals:{...f.vitals,[k]:v}}));

  const selectEmployee = (emp) => {
    set('employeeId', emp.empId||emp.id);
    set('employeeName', emp.name);
    set('department', emp.department||'');
    setEmpSearch('');
  };

  const toggleComplaint = (c) => {
    setForm(f=>{
      const arr = f.complaints.includes(c) ? f.complaints.filter(x=>x!==c) : [...f.complaints,c];
      return {...f, complaints:arr, complaint:arr.join(', ')};
    });
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_VISIT);
    setPrescription([]);
    setError('');
    setShowModal(true);
  };

  const openEdit = (v) => {
    setEditing(v);
    setForm({...EMPTY_VISIT,...v, vitals:{...VITALS_EMPTY,...(v.vitals||{})}, complaints:v.complaints||[]});
    setPrescription((v.prescription||[]).map((rx,i)=>({...rx,_id:Date.now()+i})));
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.employeeName.trim()) { setError('Please select an employee.'); return; }

    // Validate prescription stock
    for (const rx of prescription) {
      if (!rx.medicineName) { setError('Remove incomplete prescription lines.'); return; }
      if (rx.pharmacyId) {
        const item = pharmacyItems.find(i=>i.id===rx.pharmacyId);
        const qty = parseInt(rx.quantity)||0;
        if (item && qty > item.quantity) {
          setError(`Insufficient stock for ${rx.medicineName} (need ${qty}, have ${item.quantity}).`);
          return;
        }
      }
    }

    setSaving(true); setError('');
    try {
      const cleanRx = prescription.map(({_id,...rest})=>rest);
      const payload = {
        ...form,
        prescription: cleanRx,
        doctorName: form.doctorName || staffUser?.name || '',
        updatedAt: serverTimestamp(),
      };

      const batch = writeBatch(db);

      if (editing) {
        batch.update(doc(db,'merchants',tid,'opd',editing.id), payload);
        // Reverse old prescription deductions, apply new ones
        const oldRx = editing.prescription || [];
        for (const old of oldRx) {
          if (old.pharmacyId) {
            const item = pharmacyItems.find(i=>i.id===old.pharmacyId);
            if (item) batch.update(doc(db,'merchants',tid,'pharmacy',old.pharmacyId),{quantity: item.quantity + (parseInt(old.quantity)||0), updatedAt:serverTimestamp()});
          }
        }
        for (const rx of cleanRx) {
          if (rx.pharmacyId) {
            const item = pharmacyItems.find(i=>i.id===rx.pharmacyId);
            if (item) batch.update(doc(db,'merchants',tid,'pharmacy',rx.pharmacyId),{quantity: item.quantity - (parseInt(rx.quantity)||0), updatedAt:serverTimestamp()});
          }
        }
      } else {
        const newRef = doc(collection(db,'merchants',tid,'opd'));
        batch.set(newRef, {...payload, createdAt:serverTimestamp()});
        // Deduct new prescription from stock
        for (const rx of cleanRx) {
          if (rx.pharmacyId) {
            const item = pharmacyItems.find(i=>i.id===rx.pharmacyId);
            if (item) batch.update(doc(db,'merchants',tid,'pharmacy',rx.pharmacyId),{quantity: item.quantity - (parseInt(rx.quantity)||0), updatedAt:serverTimestamp()});
          }
        }
      }

      await batch.commit();
      toast.success(editing ? 'Visit updated.' : 'Visit saved.' + (cleanRx.length ? ` ${cleanRx.length} medicine(s) dispensed.` : ''));
      setShowModal(false);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (v) => {
    if (!window.confirm(`Delete visit record for ${v.employeeName}?`)) return;
    const batch = writeBatch(db);
    batch.delete(doc(db,'merchants',tid,'opd',v.id));
    // Restore stock for deleted visit's prescription
    for (const rx of (v.prescription||[])) {
      if (rx.pharmacyId) {
        const item = pharmacyItems.find(i=>i.id===rx.pharmacyId);
        if (item) batch.update(doc(db,'merchants',tid,'pharmacy',rx.pharmacyId),{quantity: item.quantity + (parseInt(rx.quantity)||0), updatedAt:serverTimestamp()});
      }
    }
    await batch.commit();
    toast.success('Visit deleted.');
  };

  const filtered = visits.filter(v=>{
    const q=search.toLowerCase();
    return(!q||v.employeeName?.toLowerCase().includes(q)||v.complaint?.toLowerCase().includes(q)||v.diagnosis?.toLowerCase().includes(q))
      &&(!filterStatus||v.status===filterStatus);
  });

  const statusColor = {Open:'text-amber-400 bg-amber-400/10',Closed:'text-accent bg-accent/10','Follow-up':'text-blue-400 bg-blue-400/10'};
  const empResults = empSearch ? employees.filter(e=>e.name?.toLowerCase().includes(empSearch.toLowerCase())||e.empId?.toLowerCase().includes(empSearch.toLowerCase())).slice(0,5) : [];

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-text">OPD / Visits</h1>
          <p className="text-muted text-sm mt-0.5">{filtered.length} visit records</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPdfButton onClick={()=>exportOpdRegister(filtered,tenant?.name)} />
          {canEdit && <button onClick={openAdd} className="btn-primary">+ New Visit</button>}
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input className="field-input w-64" placeholder="Search employee, complaint, diagnosis…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="field-input w-40" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option>Open</option><option>Closed</option><option>Follow-up</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[2fr_2fr_1fr_80px_1fr_80px] gap-2 px-4 py-2.5 bg-surface2 border-b border-border">
          {['Employee','Complaint','Date','Rx','Status',''].map(h=>(
            <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>
          ))}
        </div>
        {loading ? (
          <div className="py-12 text-center text-muted text-sm">Loading visits…</div>
        ) : filtered.length===0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-muted text-sm">{visits.length===0?'No visits recorded yet.':'No results match your filters.'}</div>
          </div>
        ) : filtered.map(v=>(
          <div key={v.id} className="grid grid-cols-[2fr_2fr_1fr_80px_1fr_80px] gap-2 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors items-center">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-green/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">{initials(v.employeeName)}</div>
              <div className="min-w-0">
                <button onClick={()=>setViewing(v)} className="text-sm font-medium text-text hover:text-accent block truncate text-left">{v.employeeName}</button>
                <div className="text-xs text-muted">{v.department||'—'}</div>
              </div>
            </div>
            <div className="text-sm text-muted truncate">{v.complaint||'—'}</div>
            <div className="text-xs text-muted">{v.visitDate?fmtDate(v.visitDate):'—'}</div>
            <div>
              {v.prescription?.length > 0
                ? <span className="text-[10px] bg-accent/15 text-accent px-2 py-0.5 rounded-full font-semibold">💊 {v.prescription.length}</span>
                : <span className="text-[10px] text-muted">—</span>
              }
            </div>
            <div><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[v.status]||'text-muted'}`}>{v.status||'Open'}</span></div>
            <div className="flex gap-1">
              {canEdit&&<button onClick={()=>openEdit(v)} className="text-muted hover:text-accent text-sm p-1">✏️</button>}
              {role==='admin'&&<button onClick={()=>handleDelete(v)} className="text-muted hover:text-red-400 text-sm p-1">🗑️</button>}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal-box w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">{editing?'Edit Visit':'New OPD Visit'}</h2>
              <button onClick={()=>setShowModal(false)} className="text-muted hover:text-text text-xl">×</button>
            </div>
            <div className="modal-body space-y-4">
              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-3 py-2">{error}</div>}

              {/* Employee */}
              <div className="relative">
                <label className="field-label">Employee *</label>
                {form.employeeName ? (
                  <div className="flex items-center gap-2 p-2 bg-surface2 border border-border rounded-lg">
                    <div className="w-7 h-7 rounded-full bg-green/20 flex items-center justify-center text-xs font-bold text-accent">{initials(form.employeeName)}</div>
                    <div className="flex-1 text-sm text-text">{form.employeeName} · {form.department||form.employeeId}</div>
                    <button onClick={()=>{set('employeeName','');set('employeeId','');set('department','');}} className="text-muted hover:text-text text-xs">×</button>
                  </div>
                ) : (
                  <>
                    <input className="field-input" placeholder="Search employee…" value={empSearch} onChange={e=>setEmpSearch(e.target.value)} />
                    {empResults.length>0&&(
                      <div className="absolute z-20 w-full bg-surface border border-border rounded-lg mt-1 shadow-lg overflow-hidden">
                        {empResults.map(e=>(
                          <button key={e.id} onClick={()=>selectEmployee(e)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface2 text-left">
                            <div className="w-6 h-6 rounded-full bg-green/20 flex items-center justify-center text-xs font-bold text-accent">{initials(e.name)}</div>
                            <div className="text-sm text-text">{e.name}</div>
                            <div className="text-xs text-muted ml-auto">{e.empId}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Visit Date</label><input type="date" className="field-input" value={form.visitDate} onChange={e=>set('visitDate',e.target.value)}/></div>
                <div><label className="field-label">Status</label>
                  <select className="field-input" value={form.status} onChange={e=>set('status',e.target.value)}>
                    <option>Open</option><option>Closed</option><option>Follow-up</option>
                  </select>
                </div>
              </div>

              {/* Complaints */}
              <div>
                <label className="field-label">Complaints</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {COMPLAINTS.map(c=>(
                    <button key={c} type="button" onClick={()=>toggleComplaint(c)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.complaints.includes(c)?'bg-accent/15 border-accent text-accent':'border-border text-muted hover:border-accent/50'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vitals */}
              <div>
                <label className="field-label">Vitals</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[['bp','BP (mmHg)'],['pulse','Pulse (bpm)'],['temp','Temp (°F)'],['spo2','SpO₂ (%)'],['weight','Weight (kg)'],['height','Height (cm)']].map(([k,lbl])=>(
                    <div key={k}>
                      <div className="text-[10px] text-muted mb-0.5">{lbl}</div>
                      <input className="field-input text-sm py-1.5" placeholder="—" value={form.vitals[k]} onChange={e=>setVital(k,e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>

              <div><label className="field-label">Diagnosis</label>
                <textarea className="field-input h-16 resize-none" value={form.diagnosis} onChange={e=>set('diagnosis',e.target.value)} placeholder="Clinical diagnosis" /></div>

              {/* Digital Prescription */}
              <PrescriptionBuilder
                pharmacyItems={pharmacyItems}
                prescription={prescription}
                setPrescription={setPrescription}
              />

              <div><label className="field-label">Advice / Instructions</label>
                <textarea className="field-input h-12 resize-none" value={form.advice} onChange={e=>set('advice',e.target.value)} placeholder="Rest, fluids, follow up if needed…" /></div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Follow-up Date</label><input type="date" className="field-input" value={form.followUp} onChange={e=>set('followUp',e.target.value)}/></div>
                <div><label className="field-label">Doctor / Seen By</label><input className="field-input" value={form.doctorName} onChange={e=>set('doctorName',e.target.value)} placeholder={staffUser?.name}/></div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={()=>setShowModal(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving?'Saving…':editing?'Save Changes':'Save Visit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Visit Modal */}
      {viewing && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setViewing(null)}>
          <div className="modal-box w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">Visit Details</h2>
              <button onClick={()=>setViewing(null)} className="text-muted hover:text-text text-xl">×</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border">
                <div className="w-10 h-10 rounded-full bg-green/20 flex items-center justify-center text-sm font-bold text-accent">{initials(viewing.employeeName)}</div>
                <div>
                  <div className="font-medium text-text">{viewing.employeeName}</div>
                  <div className="text-xs text-muted">{viewing.department} · {fmtDate(viewing.visitDate)}</div>
                </div>
                <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[viewing.status]||'text-muted'}`}>{viewing.status}</span>
              </div>

              {viewing.complaint&&<div><div className="field-label">Complaint</div><div className="text-sm text-text">{viewing.complaint}</div></div>}

              {viewing.vitals&&Object.values(viewing.vitals).some(Boolean)&&(
                <div>
                  <div className="field-label mb-2">Vitals</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[['bp','BP'],['pulse','Pulse'],['temp','Temp'],['spo2','SpO₂'],['weight','Weight'],['height','Height']].map(([k,lbl])=>viewing.vitals[k]&&(
                      <div key={k} className="bg-surface2 rounded-lg p-2 text-center">
                        <div className="text-xs text-muted">{lbl}</div>
                        <div className="text-sm font-medium text-text">{viewing.vitals[k]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewing.diagnosis&&<div><div className="field-label">Diagnosis</div><div className="text-sm text-text">{viewing.diagnosis}</div></div>}

              <PrescriptionView prescription={viewing.prescription} />

              {viewing.advice&&<div><div className="field-label">Advice</div><div className="text-sm text-text">{viewing.advice}</div></div>}
              {viewing.followUp&&<div><div className="field-label">Follow-up</div><div className="text-sm text-text">{fmtDate(viewing.followUp)}</div></div>}
              {viewing.doctorName&&<div><div className="field-label">Seen By</div><div className="text-sm text-text">{viewing.doctorName}</div></div>}
            </div>
            <div className="modal-footer">
              {canEdit&&<button onClick={()=>{setViewing(null);openEdit(viewing);}} className="btn-ghost">Edit</button>}
              <button onClick={()=>setViewing(null)} className="btn-primary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
