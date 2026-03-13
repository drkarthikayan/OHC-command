import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ── Compliance items master list ── */
const MASTER_ITEMS = [
  // Monthly
  { id:'m1',  freq:'monthly',  category:'statutory',  title:'Form 7 — Register of Adult Workers',        law:'Factories Act §62',    dueDay:5,  roles:['admin','doctor'] },
  { id:'m2',  freq:'monthly',  category:'statutory',  title:'Accident/Injury MIS Report',                law:'Factories Act §88',    dueDay:5,  roles:['doctor','admin'] },
  { id:'m3',  freq:'monthly',  category:'health',     title:'Monthly MIS Report to Management',          law:'Internal',             dueDay:7,  roles:['doctor'] },
  { id:'m4',  freq:'monthly',  category:'pharmacy',   title:'Pharmacy Stock Audit & Expiry Check',       law:'Internal',             dueDay:1,  roles:['nurse','pharmacy'] },
  { id:'m5',  freq:'monthly',  category:'health',     title:'OPD Statistics Compilation',                law:'Internal',             dueDay:5,  roles:['doctor','nurse'] },
  { id:'m6',  freq:'monthly',  category:'statutory',  title:'Morbidity Report Submission',               law:'TN Factory Rules',     dueDay:10, roles:['doctor'] },
  // Quarterly
  { id:'q1',  freq:'quarterly',category:'safety',     title:'Fire Safety Equipment Inspection',          law:'Factories Act §38',    dueMonths:[1,4,7,10], dueDay:15, roles:['admin'] },
  { id:'q2',  freq:'quarterly',category:'health',     title:'Water Quality Testing',                     law:'Factories Act §19',    dueMonths:[1,4,7,10], dueDay:20, roles:['doctor','admin'] },
  { id:'q3',  freq:'quarterly',category:'health',     title:'Canteen Hygiene Inspection',                law:'Factories Act §46',    dueMonths:[1,4,7,10], dueDay:25, roles:['doctor','admin'] },
  { id:'q4',  freq:'quarterly',category:'statutory',  title:'Form 27 — Leave Register Review',           law:'Factories Act §62&79', dueMonths:[1,4,7,10], dueDay:10, roles:['admin'] },
  { id:'q5',  freq:'quarterly',category:'safety',     title:'First Aid Box Audit (all departments)',     law:'Factories Act §45',    dueMonths:[1,4,7,10], dueDay:5,  roles:['nurse','doctor'] },
  { id:'q6',  freq:'quarterly',category:'health',     title:'Noise Level Measurement (PME zones)',       law:'Factories Act §14A',   dueMonths:[1,4,7,10], dueDay:20, roles:['doctor'] },
  // Half-Yearly
  { id:'h1',  freq:'halfyearly',category:'statutory', title:'Form 24 TN — Health Register Submission',   law:'TN Factories Rules §73',dueMonths:[1,7],      dueDay:15, roles:['doctor','admin'] },
  { id:'h2',  freq:'halfyearly',category:'health',    title:'Audiometry for Noise-Exposed Workers',      law:'Factories Act §14A',   dueMonths:[1,7],      dueDay:28, roles:['doctor'] },
  { id:'h3',  freq:'halfyearly',category:'safety',    title:'Mock Drill — Fire/Emergency Evacuation',    law:'Factories Act §41B',   dueMonths:[4,10],     dueDay:20, roles:['admin'] },
  { id:'h4',  freq:'halfyearly',category:'health',    title:'Spirometry for Chemical-Exposed Workers',   law:'Factories Act §41F',   dueMonths:[1,7],      dueDay:28, roles:['doctor'] },
  // Annual
  { id:'a1',  freq:'annual',   category:'statutory',  title:'Annual Return — Form 21',                   law:'Factories Act §88',    dueMonths:[1],        dueDay:31, roles:['admin'] },
  { id:'a2',  freq:'annual',   category:'statutory',  title:'Annual Health Report to Inspector',         law:'TN Factory Rules',     dueMonths:[2],        dueDay:15, roles:['doctor','admin'] },
  { id:'a3',  freq:'annual',   category:'statutory',  title:'Dangerous Occurrences Register — Form 21B', law:'Factories Act §89',   dueMonths:[1],        dueDay:31, roles:['admin'] },
  { id:'a4',  freq:'annual',   category:'health',     title:'PME — Annual Periodic Medical Examination',  law:'Factories Act §41C',  dueMonths:[1],        dueDay:31, roles:['doctor'] },
  { id:'a5',  freq:'annual',   category:'statutory',  title:'Factory License Renewal',                   law:'Factories Act §6',     dueMonths:[12],       dueDay:31, roles:['admin'] },
  { id:'a6',  freq:'annual',   category:'health',     title:'Annual IHI & Health Trend Report',          law:'Internal',             dueMonths:[1],        dueDay:15, roles:['doctor'] },
  { id:'a7',  freq:'annual',   category:'safety',     title:'Pressure Vessel Inspection Certificate',    law:'Factories Act §31',    dueMonths:[3],        dueDay:31, roles:['admin'] },
  { id:'a8',  freq:'annual',   category:'health',     title:'Vaccination Drive — Hepatitis B, Typhoid',  law:'Internal',             dueMonths:[9],        dueDay:30, roles:['doctor','nurse'] },
  // Weekly
  { id:'w1',  freq:'weekly',   category:'health',     title:'OPD Register Review (weekly)',              law:'Internal',             dueDay:null,          roles:['doctor'] },
  { id:'w2',  freq:'weekly',   category:'pharmacy',   title:'Controlled Drug Register Verification',    law:'Drugs & Cosmetics Act',dueDay:null,          roles:['doctor','pharmacy'] },
];

const FREQ_CFG = {
  weekly:     { label:'Weekly',      bg:'bg-purple-100', txt:'text-purple-700' },
  monthly:    { label:'Monthly',     bg:'bg-blue-100',   txt:'text-blue-700'   },
  quarterly:  { label:'Quarterly',   bg:'bg-cyan-100',   txt:'text-cyan-700'   },
  halfyearly: { label:'Half-Yearly', bg:'bg-teal-100',   txt:'text-teal-700'   },
  annual:     { label:'Annual',      bg:'bg-orange-100', txt:'text-orange-700' },
};
const CAT_CFG = {
  statutory: { label:'Statutory',  dot:'bg-red-400',    txt:'text-red-600'     },
  health:    { label:'Health',     dot:'bg-emerald-400',txt:'text-emerald-600' },
  safety:    { label:'Safety',     dot:'bg-amber-400',  txt:'text-amber-600'   },
  pharmacy:  { label:'Pharmacy',   dot:'bg-purple-400', txt:'text-purple-600'  },
};
const STATUS_CFG = {
  pending:   { label:'Pending',     bg:'bg-slate-100',   txt:'text-slate-600'   },
  inprogress:{ label:'In Progress', bg:'bg-blue-100',    txt:'text-blue-700'    },
  done:      { label:'Done ✓',      bg:'bg-emerald-100', txt:'text-emerald-700' },
  overdue:   { label:'Overdue !',   bg:'bg-red-100',     txt:'text-red-700'     },
  na:        { label:'N/A',         bg:'bg-gray-100',    txt:'text-gray-500'    },
};

function getItemsForMonth(month, year) {
  const items = [];
  const today = new Date();
  MASTER_ITEMS.forEach(item => {
    let applicable = false;
    let dueDate = null;
    if (item.freq === 'monthly') {
      applicable = true;
      if (item.dueDay) dueDate = `${year}-${String(month).padStart(2,'0')}-${String(item.dueDay).padStart(2,'0')}`;
    } else if (item.freq === 'weekly') {
      applicable = true;
    } else if (item.freq === 'quarterly' && item.dueMonths?.includes(month)) {
      applicable = true;
      if (item.dueDay) dueDate = `${year}-${String(month).padStart(2,'0')}-${String(item.dueDay).padStart(2,'0')}`;
    } else if (item.freq === 'halfyearly' && item.dueMonths?.includes(month)) {
      applicable = true;
      if (item.dueDay) dueDate = `${year}-${String(month).padStart(2,'0')}-${String(item.dueDay).padStart(2,'0')}`;
    } else if (item.freq === 'annual' && item.dueMonths?.includes(month)) {
      applicable = true;
      if (item.dueDay) dueDate = `${year}-${String(month).padStart(2,'0')}-${String(item.dueDay).padStart(2,'0')}`;
    }
    if (applicable) {
      const isOverdue = dueDate && new Date(dueDate) < today;
      items.push({ ...item, dueDate, defaultStatus: isOverdue ? 'overdue' : 'pending' });
    }
  });
  return items;
}

export default function ComplianceCalendar() {
  const { tenant, user } = useAuthStore();
  const tenantId = tenant?.id;
  const today = new Date();

  const [selMonth, setSelMonth] = useState(today.getMonth() + 1);
  const [selYear,  setSelYear]  = useState(today.getFullYear());
  const [records,  setRecords]  = useState({});   // key: `${year}-${month}-${itemId}` → {status, note, updatedBy, updatedAt}
  const [loading,  setLoading]  = useState(true);
  const [filterFreq, setFilterFreq] = useState('all');
  const [filterCat,  setFilterCat]  = useState('all');
  const [selItem,  setSelItem]  = useState(null); // drawer
  const [noteText, setNoteText] = useState('');
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, `merchants/${tenantId}/compliance_records`));
        const map = {};
        snap.docs.forEach(d => { map[d.id] = { ...d.data(), docId: d.id }; });
        setRecords(map);
      } catch(e) { toast.error('Failed to load'); }
      setLoading(false);
    };
    load();
  }, [tenantId]);

  const key = (itemId) => `${selYear}-${String(selMonth).padStart(2,'0')}-${itemId}`;

  const getStatus = (item) => records[key(item.id)]?.status || item.defaultStatus;
  const getNote   = (item) => records[key(item.id)]?.note || '';

  const updateStatus = async (item, status) => {
    if (!tenantId) return;
    const k = key(item.id);
    const payload = { status, itemId: item.id, month: selMonth, year: selYear, updatedBy: user?.name || 'staff', updatedAt: new Date().toISOString() };
    try {
      const existing = records[k];
      if (existing?.docId) {
        await updateDoc(doc(db, `merchants/${tenantId}/compliance_records`, existing.docId), payload);
      } else {
        const ref = await addDoc(collection(db, `merchants/${tenantId}/compliance_records`), { ...payload, tenantId, createdAt: serverTimestamp() });
        payload.docId = ref.id;
      }
      setRecords(prev => ({ ...prev, [k]: { ...prev[k], ...payload } }));
      toast.success('Status updated');
    } catch(e) { toast.error('Update failed'); }
  };

  const saveNote = async () => {
    if (!selItem || !tenantId) return;
    setSaving(true);
    const k = key(selItem.id);
    const payload = { note: noteText, itemId: selItem.id, month: selMonth, year: selYear, updatedBy: user?.name || 'staff', updatedAt: new Date().toISOString() };
    try {
      const existing = records[k];
      if (existing?.docId) {
        await updateDoc(doc(db, `merchants/${tenantId}/compliance_records`, existing.docId), payload);
      } else {
        const ref = await addDoc(collection(db, `merchants/${tenantId}/compliance_records`), { ...payload, tenantId, status: getStatus(selItem), createdAt: serverTimestamp() });
        payload.docId = ref.id;
      }
      setRecords(prev => ({ ...prev, [k]: { ...prev[k], ...payload } }));
      toast.success('Note saved');
      setSelItem(null);
    } catch(e) { toast.error('Save failed'); }
    setSaving(false);
  };

  const monthItems = getItemsForMonth(selMonth, selYear).filter(item => {
    if (filterFreq !== 'all' && item.freq !== filterFreq) return false;
    if (filterCat  !== 'all' && item.category !== filterCat) return false;
    return true;
  });

  const allMonth = getItemsForMonth(selMonth, selYear);
  const doneCount    = allMonth.filter(i => getStatus(i) === 'done').length;
  const overdueCount = allMonth.filter(i => getStatus(i) === 'overdue').length;
  const pendingCount = allMonth.filter(i => ['pending','inprogress'].includes(getStatus(i))).length;
  const compliance   = allMonth.length ? Math.round(doneCount / allMonth.length * 100) : 0;

  // Coming up in next 7 days
  const upcoming7 = allMonth.filter(i => {
    if (!i.dueDate) return false;
    const diff = (new Date(i.dueDate) - today) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7 && getStatus(i) !== 'done';
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">Compliance Calendar</h1>
          <p className="text-sm text-muted mt-0.5">Factory Act · OSHA · TN Rules — {MONTHS[selMonth-1]} {selYear}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))} className="input text-sm w-36">
            {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} className="input text-sm w-24">
            {[today.getFullYear()-1, today.getFullYear(), today.getFullYear()+1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-sage">{compliance}%</div>
              <div className="text-xs text-muted">Compliance Rate</div>
            </div>
            <div className="relative w-12 h-12">
              <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3"/>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#52b788" strokeWidth="3"
                  strokeDasharray={`${compliance} ${100 - compliance}`} strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 border border-border">
          <div className="text-2xl font-bold text-emerald-600">{doneCount}</div>
          <div className="text-xs text-muted">Completed</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-border">
          <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
          <div className="text-xs text-muted">Overdue</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 border border-border">
          <div className="text-2xl font-bold text-slate-600">{pendingCount}</div>
          <div className="text-xs text-muted">Pending</div>
        </div>
      </div>

      {/* Due this week */}
      {upcoming7.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-xs font-bold text-amber-700 mb-2">⏰ Due within 7 days</div>
          <div className="flex flex-wrap gap-2">
            {upcoming7.map(item => (
              <div key={item.id} className="bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs">
                <span className="font-medium text-text">{item.title}</span>
                <span className="text-amber-600 ml-2">{item.dueDate?.slice(8)} {MONTHS[selMonth-1].slice(0,3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select value={filterFreq} onChange={e => setFilterFreq(e.target.value)} className="input text-sm w-36">
          <option value="all">All Frequency</option>
          {Object.entries(FREQ_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="input text-sm w-36">
          <option value="all">All Categories</option>
          {Object.entries(CAT_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="text-xs text-muted self-center">{monthItems.length} items</div>
      </div>

      {/* Items table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface2 border-b border-border text-xs text-muted uppercase">
              <th className="text-left px-4 py-3 w-8">#</th>
              <th className="text-left px-4 py-3">Compliance Item</th>
              <th className="text-left px-4 py-3 w-24">Frequency</th>
              <th className="text-left px-4 py-3 w-20">Category</th>
              <th className="text-left px-4 py-3 w-24">Due Date</th>
              <th className="text-left px-4 py-3 w-32">Status</th>
              <th className="text-left px-4 py-3 w-16">Note</th>
            </tr>
          </thead>
          <tbody>
            {monthItems.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-muted py-10">
                <div className="text-2xl mb-1">✅</div>No items for this filter
              </td></tr>
            ) : monthItems.map((item, idx) => {
              const status = getStatus(item);
              const sc = STATUS_CFG[status] || STATUS_CFG.pending;
              const fc = FREQ_CFG[item.freq] || {};
              const cc = CAT_CFG[item.category] || {};
              const note = getNote(item);
              const isDone = status === 'done';
              return (
                <tr key={item.id} className={`border-b border-border hover:bg-surface2 transition-colors ${isDone ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 text-muted text-xs">{idx+1}</td>
                  <td className="px-4 py-3">
                    <div className={`font-medium text-text ${isDone ? 'line-through' : ''}`}>{item.title}</div>
                    <div className="text-xs text-muted mt-0.5">{item.law}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fc.bg} ${fc.txt}`}>{fc.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cc.txt}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cc.dot}`}/>
                      {cc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text font-mono">
                    {item.dueDate ? item.dueDate.slice(5) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <select value={status} onChange={e => updateStatus(item, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer ${sc.bg} ${sc.txt}`}
                      style={{ outline:'none' }}>
                      {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setSelItem(item); setNoteText(note); }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${note ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-surface2 text-muted hover:bg-border'}`}>
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M2 2h12v9l-4 3H2V2zm0 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                        <path d="M10 11v3l4-3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                        <path d="M5 5h6M5 7h6M5 9h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Note drawer */}
      {selItem && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelItem(null)}/>
          <div className="relative ml-auto w-full max-w-md bg-white h-full flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-border bg-sage text-white">
              <h2 className="font-display font-bold text-lg">Compliance Note</h2>
              <p className="text-xs text-white/70 mt-0.5 truncate">{selItem.title}</p>
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div className="bg-surface2 rounded-xl p-3 text-xs space-y-1">
                <div><span className="text-muted">Law:</span> <span className="font-medium">{selItem.law}</span></div>
                <div><span className="text-muted">Due:</span> <span className="font-medium">{selItem.dueDate || 'Recurring'}</span></div>
                <div><span className="text-muted">Category:</span> <span className="font-medium capitalize">{selItem.category}</span></div>
              </div>
              <div>
                <label className="label">Notes / Evidence / Remarks</label>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={6}
                  placeholder="Enter completion details, reference numbers, file names, or any remarks…"
                  className="input w-full resize-none"/>
              </div>
              <div>
                <label className="label">Mark Status</label>
                <select value={getStatus(selItem)} onChange={e => updateStatus(selItem, e.target.value)} className="input w-full">
                  {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-surface2">
              <button onClick={() => setSelItem(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveNote} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : '💾 Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
