import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate } from '../../utils/formatters';

const CATEGORIES = ['Analgesic','Antibiotic','Antacid','Antihistamine','Antiseptic','Vitamin','ORS','First Aid','Injection','Syrup','Ointment','Other'];
const UNITS = ['Tablets','Capsules','Syrup (ml)','Injection (vials)','Sachets','Tubes','Strips','Bottles'];
const EMPTY = { name: '', category: '', unit: 'Tablets', quantity: '', minStock: '10', batchNo: '', expiry: '', manufacturer: '', location: '' };

export default function PharmacyPage() {
  const { tenant, staffUser } = useAuthStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDispense, setShowDispense] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dispensing, setDispensing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [dispenseQty, setDispenseQty] = useState('1');
  const [dispenseNote, setDispenseNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tid = tenant?.id;
  const role = staffUser?.role || 'staff';
  const canEdit = ['admin', 'doctor', 'pharmacy'].includes(role);

  useEffect(() => {
    if (!tid) return;
    const unsub = onSnapshot(
      query(collection(db, 'merchants', tid, 'pharmacy'), orderBy('name')),
      snap => { setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, [tid]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const openAdd = () => { setEditing(null); setForm(EMPTY); setError(''); setShowModal(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...EMPTY, ...item }); setError(''); setShowModal(true); };
  const openDispense = (item) => { setDispensing(item); setDispenseQty('1'); setDispenseNote(''); setShowDispense(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Item name is required.'); return; }
    if (!form.quantity) { setError('Quantity is required.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, quantity: parseInt(form.quantity) || 0, minStock: parseInt(form.minStock) || 10, updatedAt: serverTimestamp() };
      if (editing) {
        await updateDoc(doc(db, 'merchants', tid, 'pharmacy', editing.id), payload);
      } else {
        await addDoc(collection(db, 'merchants', tid, 'pharmacy'), { ...payload, createdAt: serverTimestamp() });
      }
      toast.success(editing ? 'Item updated.' : 'Added to inventory.'); setShowModal(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDispense = async () => {
    const qty = parseInt(dispenseQty) || 0;
    if (qty <= 0) { return; }
    if (qty > dispensing.quantity) { toast.error('Insufficient stock.'); return; return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'merchants', tid, 'pharmacy', dispensing.id), {
        quantity: dispensing.quantity - qty,
        updatedAt: serverTimestamp(),
      });
      toast.success('Dispensed successfully.'); setShowDispense(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    const ok = await new Promise(r => { r(window.confirm(`Remove ${item.name} from inventory?`)); }); if (!ok) return;
    await deleteDoc(doc(db, 'merchants', tid, 'pharmacy', item.id)); toast.success('Item removed.');
  };

  const isExpired = (exp) => exp && new Date(exp) < new Date();
  const isExpiringSoon = (exp) => {
    if (!exp) return false;
    const d = new Date(exp); const now = new Date();
    return d > now && (d - now) / (1000*60*60*24) <= 30;
  };
  const isLowStock = (item) => item.quantity <= (item.minStock || 10);

  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    const matchQ = !q || i.name?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q) || i.batchNo?.toLowerCase().includes(q);
    const matchC = !filterCat || i.category === filterCat;
    const matchL = !showLowStock || isLowStock(i);
    return matchQ && matchC && matchL;
  });

  const lowCount = items.filter(isLowStock).length;

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-text">Pharmacy</h1>
          <p className="text-muted text-sm mt-0.5">{filtered.length} items · {lowCount > 0 && <span className="text-amber-400">{lowCount} low stock</span>}</p>
        </div>
        {canEdit && (
          <button onClick={openAdd} className="btn-primary">+ Add Item</button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input className="field-input w-64" placeholder="Search item, category, batch…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="field-input w-44" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setShowLowStock(s => !s)}
          className={`btn-sm px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${showLowStock ? 'bg-amber-400/15 border-amber-400/40 text-amber-400' : 'border-border text-muted hover:text-text'}`}
        >
          ⚠️ Low Stock {lowCount > 0 && `(${lowCount})`}
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_80px_80px_100px_100px_80px] gap-2 px-4 py-2.5 bg-surface2 border-b border-border">
          {['Item','Category','Qty','Min','Batch','Expiry',''].map(h => (
            <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>
          ))}
        </div>
        {loading ? (
          <div className="py-12 text-center text-muted text-sm">Loading inventory…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">💊</div>
            <div className="text-muted text-sm">{items.length === 0 ? 'No items in inventory.' : 'No items match your filters.'}</div>
          </div>
        ) : filtered.map(item => {
          const expired = isExpired(item.expiry);
          const expiring = isExpiringSoon(item.expiry);
          const low = isLowStock(item);
          return (
            <div key={item.id} className={`grid grid-cols-[2fr_1fr_80px_80px_100px_100px_80px] gap-2 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors items-center ${expired ? 'opacity-60' : ''}`}>
              <div>
                <div className="text-sm font-medium text-text flex items-center gap-1.5">
                  {item.name}
                  {expired && <span className="text-[10px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full">Expired</span>}
                  {expiring && !expired && <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full">Expiring</span>}
                </div>
                <div className="text-xs text-muted">{item.unit || 'Tablets'} {item.manufacturer && `· ${item.manufacturer}`}</div>
              </div>
              <div className="text-sm text-muted">{item.category || '—'}</div>
              <div className={`text-sm font-semibold ${low ? 'text-amber-400' : 'text-text'}`}>{item.quantity ?? '—'}</div>
              <div className="text-xs text-muted">{item.minStock || 10}</div>
              <div className="text-xs text-muted">{item.batchNo || '—'}</div>
              <div className={`text-xs ${expired ? 'text-red-400' : expiring ? 'text-amber-400' : 'text-muted'}`}>{item.expiry ? fmtDate(item.expiry) : '—'}</div>
              <div className="flex gap-1">
                {canEdit && (
                  <>
                    <button onClick={() => openDispense(item)} className="text-muted hover:text-accent text-sm p-1" title="Dispense">💊</button>
                    <button onClick={() => openEdit(item)} className="text-muted hover:text-accent text-sm p-1" title="Edit">✏️</button>
                    {role === 'admin' && <button onClick={() => handleDelete(item)} className="text-muted hover:text-red-400 text-sm p-1" title="Delete">🗑️</button>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">{editing ? 'Edit Item' : 'Add Item'}</h2>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-text text-xl">×</button>
            </div>
            <div className="modal-body space-y-3">
              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-3 py-2">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="field-label">Item Name *</label>
                  <input className="field-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Paracetamol 500mg" />
                </div>
                <div>
                  <label className="field-label">Category</label>
                  <select className="field-input" value={form.category} onChange={e => set('category', e.target.value)}>
                    <option value="">Select…</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Unit</label>
                  <select className="field-input" value={form.unit} onChange={e => set('unit', e.target.value)}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Current Quantity</label>
                  <input type="number" className="field-input" value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="0" min="0" />
                </div>
                <div>
                  <label className="field-label">Min Stock Alert</label>
                  <input type="number" className="field-input" value={form.minStock} onChange={e => set('minStock', e.target.value)} placeholder="10" min="0" />
                </div>
                <div>
                  <label className="field-label">Batch No.</label>
                  <input className="field-input" value={form.batchNo} onChange={e => set('batchNo', e.target.value)} placeholder="B2024001" />
                </div>
                <div>
                  <label className="field-label">Expiry Date</label>
                  <input type="date" className="field-input" value={form.expiry} onChange={e => set('expiry', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Manufacturer</label>
                  <input className="field-input" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} placeholder="Sun Pharma" />
                </div>
                <div>
                  <label className="field-label">Storage Location</label>
                  <input className="field-input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Shelf A-3" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add to Inventory'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispense Modal */}
      {showDispense && dispensing && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowDispense(false)}>
          <div className="modal-box w-full max-w-sm">
            <div className="modal-header">
              <h2 className="font-serif text-xl text-text">Dispense Medicine</h2>
              <button onClick={() => setShowDispense(false)} className="text-muted hover:text-text text-xl">×</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="bg-surface2 rounded-lg p-3">
                <div className="font-medium text-text">{dispensing.name}</div>
                <div className="text-sm text-muted mt-0.5">Available: <span className="text-accent font-semibold">{dispensing.quantity} {dispensing.unit || 'units'}</span></div>
              </div>
              <div>
                <label className="field-label">Quantity to Dispense</label>
                <input type="number" className="field-input" value={dispenseQty} onChange={e => setDispenseQty(e.target.value)} min="1" max={dispensing.quantity} />
              </div>
              <div>
                <label className="field-label">Note (optional)</label>
                <input className="field-input" value={dispenseNote} onChange={e => setDispenseNote(e.target.value)} placeholder="Patient name / emp ID…" />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDispense(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleDispense} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? 'Dispensing…' : '💊 Dispense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
