import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate } from '../../utils/formatters';

const CATEGORIES = [
  { id: 'yellow',  label: '🟡 Yellow — Infectious / Anatomical',    color: '#f0a500', bg: '#f0a50015' },
  { id: 'red',     label: '🔴 Red — Recyclable Contaminated',        color: '#ef4444', bg: '#ef444415' },
  { id: 'blue',    label: '🔵 Blue/White — Glass / Metal',           color: '#4a9eca', bg: '#4a9eca15' },
  { id: 'black',   label: '⬛ Black — General (Non-BMW)',             color: '#6b7280', bg: '#6b728015' },
  { id: 'sharp',   label: '🔶 Sharp Container',                      color: '#f97316', bg: '#f9731615' },
  { id: 'purple',  label: '🟣 Purple — Cytotoxic / Chemotherapy',    color: '#a855f7', bg: '#a855f715' },
];
const CAT_SHORT = { yellow:'Yellow',red:'Red',blue:'Blue/White',black:'Black',sharp:'Sharp',purple:'Purple' };
const UNITS    = ['kg','litres','bags','containers','pieces'];
const DISPOSALS= ['Incineration (CBWTF)','Autoclave / Hydroclave','Chemical Disinfection','Landfill (Non-BMW)','Recycling'];

const EMPTY = {
  date: new Date().toISOString().slice(0,10),
  category: 'yellow', quantity: '', unit: 'kg',
  disposalMethod: 'Incineration (CBWTF)',
  collectedBy: '', remarks: '',
};

function CatBadge({ category }) {
  const cat = CATEGORIES.find(c => c.id === category);
  if (!cat) return null;
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
      style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.color}30` }}>
      {CAT_SHORT[category]}
    </span>
  );
}

export default function BiomedicalWaste() {
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
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCat,   setFilterCat]   = useState('');

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(() => {
    if (!tid) return;
    const unsub = onSnapshot(
      query(collection(db,'merchants',tid,'waste'), orderBy('createdAt','desc')),
      snap => { setRecords(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, [tid]);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (rec) => { setEditing(rec); setForm({...EMPTY,...rec}); setShowForm(true); };

  const handleSave = async () => {
    if (!form.quantity) { toast.error('Quantity is required.'); return; }
    setSaving(true);
    try {
      const payload = {...form, updatedAt: serverTimestamp()};
      if (editing) {
        await updateDoc(doc(db,'merchants',tid,'waste',editing.id), payload);
        toast.success('Entry updated.');
      } else {
        await addDoc(collection(db,'merchants',tid,'waste'), {...payload, createdAt: serverTimestamp()});
        toast.success('Waste entry recorded.');
      }
      setShowForm(false);
    } catch(e) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db,'merchants',tid,'waste',deleteTarget.id));
      toast.success('Entry deleted.');
    } catch(e) { toast.error(e.message); } finally { setDeleteTarget(null); }
  };

  const filtered = records.filter(r =>
    (!filterMonth || r.date?.startsWith(filterMonth)) &&
    (!filterCat   || r.category === filterCat)
  );

  // monthly summary by category
  const thisMonth = new Date().toISOString().slice(0,7);
  const monthRecords = records.filter(r => r.date?.startsWith(filterMonth || thisMonth));
  const catSummary = CATEGORIES.map(cat => ({
    ...cat,
    total: monthRecords.filter(r => r.category === cat.id).reduce((s,r) => s + (parseFloat(r.quantity)||0), 0),
    unit: monthRecords.filter(r => r.category === cat.id)[0]?.unit || 'kg',
    count: monthRecords.filter(r => r.category === cat.id).length,
  }));

  const months = [...new Set(records.map(r => r.date?.slice(0,7)).filter(Boolean))].sort().reverse();

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-text">Biomedical Waste Register</h1>
          <p className="text-muted text-sm mt-0.5">BMW Rules — category-wise waste tracking and disposal</p>
        </div>
        {canEdit && <button onClick={openAdd} className="btn-primary">+ Record Entry</button>}
      </div>

      {/* Monthly summary */}
      <div className="card overflow-hidden mb-5">
        <div className="card-header">
          <span>📊</span>
          <h3 className="text-sm font-semibold text-text">Monthly Summary</h3>
          <select className="ml-auto field-input w-36 text-xs py-1"
            value={filterMonth || thisMonth} onChange={e => setFilterMonth(e.target.value === thisMonth ? '' : e.target.value)}>
            {[thisMonth, ...months.filter(m => m !== thisMonth)].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {catSummary.map(cat => (
            <div key={cat.id} className="rounded-lg p-3 border" style={{ background: cat.bg, borderColor: cat.color + '30' }}>
              <div className="text-xs font-medium mb-1" style={{ color: cat.color }}>{cat.label.split('—')[0].trim()}</div>
              <div className="font-serif text-xl" style={{ color: cat.color }}>{cat.total > 0 ? `${cat.total} ${cat.unit}` : '—'}</div>
              <div className="text-[10px] text-muted mt-0.5">{cat.count} entr{cat.count === 1 ? 'y' : 'ies'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select className="field-input w-40" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          <option value="">All Months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="field-input w-52" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{CAT_SHORT[c.id]}</option>)}
        </select>
        {(filterMonth || filterCat) && <button onClick={() => { setFilterMonth(''); setFilterCat(''); }} className="btn-ghost text-sm">Clear</button>}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[90px_1fr_80px_60px_1fr_100px_60px] gap-2 px-4 py-2.5 bg-surface2 border-b border-border">
          {['Date','Category','Qty','Unit','Disposal Method','Collected By',''].map(h => (
            <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>
          ))}
        </div>
        {loading
          ? <div className="py-12 text-center text-muted text-sm">Loading…</div>
          : filtered.length === 0
            ? <div className="py-14 text-center"><div className="text-4xl mb-3">♻️</div><div className="text-muted text-sm">{records.length === 0 ? 'No entries yet.' : 'No records match filters.'}</div></div>
            : filtered.map(rec => (
              <div key={rec.id} className="grid grid-cols-[90px_1fr_80px_60px_1fr_100px_60px] gap-2 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors items-center">
                <div className="text-xs text-muted">{rec.date ? fmtDate(rec.date) : '—'}</div>
                <CatBadge category={rec.category} />
                <div className="text-sm font-medium text-text">{rec.quantity}</div>
                <div className="text-xs text-muted">{rec.unit}</div>
                <div className="text-xs text-muted truncate">{rec.disposalMethod}</div>
                <div className="text-xs text-muted truncate">{rec.collectedBy || '—'}</div>
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
          <div className="modal-box w-full max-w-lg">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">{editing ? 'Edit Entry' : 'Record Waste Entry'}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-text text-xl leading-none">×</button>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <label className="field-label">Waste Category (BMW Rules) *</label>
                <div className="space-y-2">
                  {CATEGORIES.map(cat => (
                    <label key={cat.id} className="flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors"
                      style={{ borderColor: form.category === cat.id ? cat.color : 'var(--border)', background: form.category === cat.id ? cat.bg : 'transparent' }}>
                      <input type="radio" name="category" value={cat.id} checked={form.category === cat.id} onChange={() => set('category', cat.id)} className="shrink-0" />
                      <span className="text-sm text-text">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="field-label">Date</label><input type="date" className="field-input" value={form.date} onChange={e => set('date', e.target.value)} /></div>
                <div><label className="field-label">Quantity *</label><input type="number" step="0.1" className="field-input" placeholder="0.0" value={form.quantity} onChange={e => set('quantity', e.target.value)} /></div>
                <div><label className="field-label">Unit</label><select className="field-input" value={form.unit} onChange={e => set('unit', e.target.value)}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
                <div><label className="field-label">Disposal Method</label><select className="field-input" value={form.disposalMethod} onChange={e => set('disposalMethod', e.target.value)}>{DISPOSALS.map(d => <option key={d}>{d}</option>)}</select></div>
                <div className="col-span-2"><label className="field-label">Collected By</label><input className="field-input" placeholder="Staff name" value={form.collectedBy} onChange={e => set('collectedBy', e.target.value)} /></div>
                <div className="col-span-2"><label className="field-label">Remarks</label><textarea className="field-input h-14 resize-none w-full" value={form.remarks} onChange={e => set('remarks', e.target.value)} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Record Entry'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-box w-full max-w-sm">
            <div className="modal-header"><h2 className="font-serif text-lg text-text">Delete Entry</h2></div>
            <div className="modal-body"><p className="text-sm text-muted">Delete this waste entry from {fmtDate(deleteTarget.date)}?</p></div>
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
