import { useState, useEffect, useRef } from 'react';
import { db } from '../../config/firebase';
import {
  collection, onSnapshot, doc, updateDoc,
  serverTimestamp, getDoc, setDoc
} from 'firebase/firestore';
import { fmtCurrency, fmtDate, statusBadge, initials } from '../../utils/formatters';

const DEFAULT_PLANS = [
  { id: 'starter',    name: 'Starter',    price: 2999,  color: '#74c69d', features: ['Up to 3 users', 'OPD management', 'Basic reports', 'Email support'] },
  { id: 'pro',        name: 'Pro',        price: 6999,  color: '#4a9eca', features: ['Up to 10 users', 'Full OPD + Pharmacy', 'Medical exams', 'Priority support'] },
  { id: 'enterprise', name: 'Enterprise', price: 14999, color: '#b06af0', features: ['Unlimited users', 'All Pro features', 'Custom subdomain', 'Dedicated SLA'] },
];

const fmt = v => '₹' + (Number(v) || 0).toLocaleString('en-IN');
const fmtD = iso => { try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return iso || ''; } };

// ── PLAN EDITOR MODAL ─────────────────────────────────────
function PlanEditorModal({ plans, onClose, onSave }) {
  const [rows, setRows] = useState(plans.map(p => ({ ...p, featuresText: (p.features || []).join('\n') })));
  const [saving, setSaving] = useState(false);

  const updateRow = (i, k, v) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  const addRow = () => setRows(r => [...r, { id: 'p' + Date.now(), name: '', price: 0, color: '#74c69d', features: [], featuresText: '' }]);
  const removeRow = (i) => { if (rows.length <= 1) return; setRows(r => r.filter((_, idx) => idx !== i)); };

  const handleSave = async () => {
    for (const r of rows) { if (!r.name.trim()) return; }
    setSaving(true);
    const updated = rows.map(r => ({
      id: r.id, name: r.name.trim(), price: Number(r.price) || 0,
      color: r.color, features: r.featuresText.split('\n').map(l => l.trim()).filter(Boolean),
    }));
    await onSave(updated);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface">
          <div>
            <h2 className="font-serif text-xl text-text">✏️ Edit Plans & Pricing</h2>
            <p className="text-xs text-muted mt-0.5">Saved to Firestore /config/superAdmin</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface2 text-muted hover:text-text">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {rows.map((row, i) => (
            <div key={row.id} className="bg-surface2 border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Plan {i + 1}</span>
                <button onClick={() => removeRow(i)} className="btn-danger btn-sm text-xs">Remove</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Plan Name</label>
                  <input className="field-input" placeholder="Pro" value={row.name} onChange={e => updateRow(i, 'name', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Monthly Price (₹)</label>
                  <input type="number" className="field-input" value={row.price} onChange={e => updateRow(i, 'price', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Accent Colour</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={row.color} onChange={e => updateRow(i, 'color', e.target.value)}
                      className="w-9 h-9 rounded-lg border border-border cursor-pointer bg-transparent p-0.5" />
                    <span className="text-xs text-muted">Used on plan card & invoice</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="field-label">Features (one per line)</label>
                  <textarea className="field-input resize-none" rows={4} value={row.featuresText}
                    onChange={e => updateRow(i, 'featuresText', e.target.value)} placeholder="Up to 10 users&#10;Full OPD + Pharmacy&#10;Priority support" />
                </div>
              </div>
            </div>
          ))}
          <button onClick={addRow} className="btn-ghost w-full justify-center border-dashed">+ Add Plan</button>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : '💾 Save All Plans'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── INVOICE WIZARD ────────────────────────────────────────
function InvoiceWizard({ tenants, plans, gcfg, initialTenantId, onClose }) {
  const [tenantId, setTenantId] = useState(initialTenantId || '');
  const [invoiceNo, setInvoiceNo] = useState('OHC-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 900) + 100));
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10));
  const [items, setItems] = useState([{ id: 1, desc: 'OHC Portal Subscription', unit: 'Monthly', qty: 1, rate: 0 }]);
  const [discount, setDiscount] = useState(0);
  const [gst, setGst] = useState(gcfg?.gstPct || 18);
  const [notes, setNotes] = useState('Payment via NEFT/UPI/Cheque within due date.\nGSTIN: 29AABCX1234Z1ZX\nSupport: ' + (gcfg?.supportEmail || 'support@ohcportal.in'));
  const [showPreview, setShowPreview] = useState(false);
  const [itemCounter, setItemCounter] = useState(2);

  const gpp = (planName) => (plans.find(p => p.name === planName || p.id === planName)?.price || 0);
  const planColor = (planName) => (plans.find(p => p.name === planName || p.id === planName)?.color || '#2d6a4f');

  const handleTenantChange = (id) => {
    setTenantId(id);
    const t = tenants.find(x => x.id === id);
    if (!t) return;
    setItems(prev => prev.map((item, i) => i === 0
      ? { ...item, desc: `${t.name} — ${t.plan || 'Basic'} Plan (Monthly Subscription)`, rate: gpp(t.plan) }
      : item
    ));
    setDiscount(t.discount || 0);
  };

  // set initial tenant
  useEffect(() => {
    if (initialTenantId) handleTenantChange(initialTenantId);
  }, []);

  const addItem = () => {
    setItems(prev => [...prev, { id: itemCounter, desc: '', unit: 'Monthly', qty: 1, rate: 0 }]);
    setItemCounter(c => c + 1);
  };
  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));
  const updateItem = (id, k, v) => setItems(prev => prev.map(i => i.id === id ? { ...i, [k]: v } : i));

  const sub = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);
  const da = Math.round(sub * discount / 100);
  const ga = Math.round((sub - da) * gst / 100);
  const total = sub - da + ga;

  const tenant = tenants.find(t => t.id === tenantId);
  const pc = planColor(tenant?.plan);

  const handlePrint = () => {
    const area = document.getElementById('invoice-preview-area');
    if (!area) return;
    const w = window.open('', '_blank', 'width=860,height=1100');
    w.document.write(`<!DOCTYPE html><html><head>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#fff}@media print{@page{size:A4;margin:13mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
    </head><body>${area.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-serif text-xl text-text">🧾 Generate Invoice</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface2 text-muted hover:text-text">✕</button>
        </div>

        {!showPreview ? (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Tenant + Invoice No */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Tenant *</label>
                  <select className="field-input" value={tenantId} onChange={e => handleTenantChange(e.target.value)}>
                    <option value="">— Select Tenant —</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Invoice Number</label>
                  <input className="field-input" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Invoice Date</label>
                  <input type="date" className="field-input" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Due Date</label>
                  <input type="date" className="field-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-accent mb-2">Line Items</div>
                <div className="grid grid-cols-[3fr_65px_55px_85px_28px] gap-1.5 mb-1 px-1">
                  {['Description', 'Unit', 'Qty', 'Rate (₹)', ''].map(h => (
                    <div key={h} className="text-[9px] font-bold uppercase tracking-wider text-muted">{h}</div>
                  ))}
                </div>
                {items.map(item => (
                  <div key={item.id} className="grid grid-cols-[3fr_65px_55px_85px_28px] gap-1.5 mb-1.5 items-center">
                    <input className="field-input text-xs py-1.5" placeholder="Description" value={item.desc} onChange={e => updateItem(item.id, 'desc', e.target.value)} />
                    <input className="field-input text-xs py-1.5 text-center" placeholder="Monthly" value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)} />
                    <input type="number" className="field-input text-xs py-1.5 text-center" min="1" value={item.qty} onChange={e => updateItem(item.id, 'qty', e.target.value)} />
                    <input type="number" className="field-input text-xs py-1.5 text-right" min="0" value={item.rate} onChange={e => updateItem(item.id, 'rate', e.target.value)} />
                    <button onClick={() => removeItem(item.id)} className="w-6 h-6 flex items-center justify-center rounded text-red/60 hover:text-red hover:bg-red/10 text-xs">✕</button>
                  </div>
                ))}
                <button onClick={addItem} className="btn-ghost btn-sm w-full justify-center border-dashed mt-1">+ Add Item</button>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Discount %</label>
                  <input type="number" className="field-input" min="0" max="100" value={discount} onChange={e => setDiscount(Number(e.target.value))} />
                </div>
                <div>
                  <label className="field-label">GST %</label>
                  <input type="number" className="field-input" min="0" max="28" value={gst} onChange={e => setGst(Number(e.target.value))} />
                </div>
              </div>
              <div className="bg-surface2 border border-border rounded-xl p-4 space-y-2">
                {[
                  ['Subtotal', fmt(sub), 'text-text'],
                  ['Discount (' + discount + '%)', '−' + fmt(da), 'text-red'],
                  ['GST (' + gst + '%)', '+' + fmt(ga), 'text-text'],
                ].map(([l, v, c]) => (
                  <div key={l} className="flex justify-between text-sm">
                    <span className="text-muted">{l}</span><span className={c}>{v}</span>
                  </div>
                ))}
                <div className="flex justify-between text-base font-bold border-t border-border pt-2 mt-1">
                  <span className="text-accent">Total Due</span>
                  <span className="text-gold">{fmt(total)}</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="field-label">Notes / Payment Instructions</label>
                <textarea className="field-input resize-none" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={onClose} className="btn-ghost">Cancel</button>
              <button
                onClick={() => { if (!tenantId) return; setShowPreview(true); }}
                disabled={!tenantId || items.length === 0}
                className="btn-primary disabled:opacity-50"
              >👁 Preview & Print</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              {/* A4 Invoice Preview */}
              <div id="invoice-preview-area" style={{ background: '#fff', color: '#1a1a1a', fontFamily: "'DM Sans', sans-serif", padding: '38px 46px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26, paddingBottom: 18, borderBottom: `3px solid ${pc}` }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ width: 40, height: 40, background: pc, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>🏥</div>
                      <div>
                        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18 }}>OHC Portal</div>
                        <div style={{ fontSize: 9.5, color: '#666', letterSpacing: '.08em', textTransform: 'uppercase' }}>Occupational Health Centre</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 10.5, color: '#555', lineHeight: 1.9 }}>ohcportal.in &nbsp;|&nbsp; {gcfg?.supportEmail || 'support@ohcportal.in'}<br />GSTIN: 29AABCX1234Z1ZX</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: pc }}>INVOICE</div>
                    <div style={{ fontSize: 11.5, color: '#555', marginTop: 2 }}># {invoiceNo}</div>
                    <div style={{ marginTop: 9, fontSize: 10.5, color: '#555' }}>
                      <div><strong>Date:</strong> {fmtD(invoiceDate)}</div>
                      <div style={{ marginTop: 2 }}><strong>Due:</strong> {fmtD(dueDate)}</div>
                    </div>
                  </div>
                </div>

                {/* Bill To */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 22 }}>
                  <div>
                    <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: 4 }}>Bill To</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{tenant?.name}</div>
                    <div style={{ fontSize: 11.5, color: '#555', lineHeight: 1.9, marginTop: 3 }}>
                      {tenant?.email}{tenant?.phone ? '\n' + tenant.phone : ''}{tenant?.address ? '\n' + tenant.address : ''}
                    </div>
                  </div>
                  <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '12px 15px', textAlign: 'right', minWidth: 140 }}>
                    <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: 4 }}>Subscription</div>
                    <div style={{ display: 'inline-block', background: pc + '20', color: pc, borderRadius: 20, padding: '3px 11px', fontSize: 10.5, fontWeight: 700 }}>{tenant?.plan || '—'} Plan</div>
                    <div style={{ fontSize: 10.5, color: '#555', marginTop: 6 }}>{tenant?.subdomain || tenant?.id}.ohcportal.in</div>
                  </div>
                </div>

                {/* Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginBottom: 18 }}>
                  <thead>
                    <tr style={{ background: pc, color: '#fff' }}>
                      {['#', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'].map((h, i) => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: i >= 3 ? 'center' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e8e8e8' }}>
                        <td style={{ padding: '8px 12px', color: '#aaa' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 500 }}>{item.desc}</td>
                        <td style={{ padding: '8px 12px', color: '#555' }}>{item.unit}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(item.rate)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(item.qty * item.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 22 }}>
                  <div style={{ minWidth: 250 }}>
                    {[['Subtotal', fmt(sub), '#555', ''], ['Discount (' + discount + '%)', '−' + fmt(da), '#d44', da > 0 ? '' : 'none'], ['GST (' + gst + '%)', '+' + fmt(ga), '#555', '']].map(([l, v, c, display]) => (
                      display !== 'none' && (
                        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #eee', fontSize: 11.5 }}>
                          <span style={{ color: c }}>{l}</span><span style={{ color: c }}>{v}</span>
                        </div>
                      )
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0 0', fontSize: 15, fontWeight: 800 }}>
                      <span>Total Due</span><span style={{ color: pc }}>{fmt(total)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {notes && (
                  <div style={{ background: '#f0f9f4', borderLeft: `3px solid ${pc}`, borderRadius: '0 6px 6px 0', padding: '11px 14px', fontSize: 10.5, color: '#444', lineHeight: 1.9, marginBottom: 18, whiteSpace: 'pre-wrap' }}>
                    {notes}
                  </div>
                )}

                <div style={{ borderTop: '2px solid #eee', paddingTop: 11, textAlign: 'center', fontSize: 9.5, color: '#bbb' }}>
                  Computer-generated invoice &nbsp;|&nbsp; OHC Portal · ILO C161 Compliant &nbsp;|&nbsp; ohcportal.in
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowPreview(false)} className="btn-ghost">← Edit</button>
              <div className="flex gap-2">
                <button onClick={onClose} className="btn-ghost">Close</button>
                <button onClick={handlePrint} className="btn-primary">🖨 Print / PDF</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── MAIN BILLING PAGE ─────────────────────────────────────
export default function BillingPage() {
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [gcfg, setGcfg] = useState({ trialDays: 14, supportEmail: 'support@ohcportal.in', gstPct: 18 });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [invoiceTenantId, setInvoiceTenantId] = useState(null); // null=closed, ''=open with no tenant, 'id'=open for tenant

  // Load tenants
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'merchants'), snap => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Load config & plans
  useEffect(() => {
    getDoc(doc(db, 'config', 'superAdmin')).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.plans?.length) setPlans(d.plans);
        setGcfg(g => ({ ...g, ...d }));
      }
    }).catch(() => {});
  }, []);

  const gpp = (planName) => plans.find(p => p.name === planName || p.id === planName)?.price || 0;

  const filtered = filterStatus ? tenants.filter(t => t.status === filterStatus) : tenants;

  const mrr = tenants.filter(t => t.status === 'active').reduce((s, t) => s + gpp(t.plan), 0);
  const paid = tenants.filter(t => t.status === 'active').length;
  const trial = tenants.filter(t => t.status === 'trial').length;
  const suspended = tenants.filter(t => t.status === 'suspended').length;

  const updatePlan = async (id, plan) => {
    await updateDoc(doc(db, 'merchants', id), { plan, updatedAt: serverTimestamp() });
    setTenants(prev => prev.map(t => t.id === id ? { ...t, plan } : t));
  };

  const updateDiscount = async (id, val) => {
    const discount = Math.min(100, Math.max(0, parseInt(val) || 0));
    await updateDoc(doc(db, 'merchants', id), { discount, updatedAt: serverTimestamp() });
    setTenants(prev => prev.map(t => t.id === id ? { ...t, discount } : t));
  };

  const markPaid = async (id) => {
    const nd = new Date(Date.now() + 30 * 864e5).toISOString();
    await updateDoc(doc(db, 'merchants', id), { status: 'active', nextDue: nd, updatedAt: serverTimestamp() });
    setTenants(prev => prev.map(t => t.id === id ? { ...t, status: 'active', nextDue: nd } : t));
  };

  const savePlans = async (updated) => {
    await setDoc(doc(db, 'config', 'superAdmin'), { plans: updated, updatedAt: serverTimestamp() }, { merge: true });
    setPlans(updated);
  };

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-text">Billing & Subscriptions</h1>
          <p className="text-muted text-sm mt-0.5">Manage plans, discounts and invoices</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPlanEditor(true)} className="btn-ghost">✏️ Edit Plans</button>
          <button onClick={() => setInvoiceTenantId('')} className="btn-primary">🧾 New Invoice</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: '💰', label: 'MRR', value: fmtCurrency(mrr), sub: 'Monthly Recurring', color: 'text-gold' },
          { icon: '✅', label: 'Active Paid', value: paid, sub: tenants.length ? Math.round(paid / tenants.length * 100) + '% paid' : '0%', color: 'text-accent' },
          { icon: '🔄', label: 'On Trial', value: trial, sub: 'Convert to paid', color: 'text-amber' },
          { icon: '⚠️', label: 'Suspended', value: suspended, sub: 'Revenue risk', color: 'text-red' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="text-xl mb-2">{s.icon}</div>
            <div className={`font-serif text-2xl ${s.color} mb-0.5`}>{s.value}</div>
            <div className="text-xs text-muted uppercase tracking-wider">{s.label}</div>
            <div className="text-xs text-muted mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Pricing Plans */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="font-serif text-lg text-text">Pricing Plans</div>
          <button onClick={() => setShowPlanEditor(true)} className="text-xs text-accent hover:underline">Edit Plans →</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map(p => (
            <div key={p.id} className="card p-4 relative overflow-hidden hover:border-green2 transition-colors">
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: p.color }} />
              <div className="flex items-center justify-between mb-1">
                <div className="font-serif text-base" style={{ color: p.color }}>{p.name}</div>
              </div>
              <div className="text-2xl font-bold mb-2" style={{ color: p.color }}>
                {fmtCurrency(p.price)}<span className="text-xs text-muted font-normal">/mo</span>
              </div>
              <div className="text-xs text-muted space-y-0.5">
                {(p.features || []).map((f, i) => <div key={i}>✓ {f}</div>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Billing Table */}
      <div className="card overflow-hidden">
        <div className="card-header justify-between">
          <div className="flex items-center gap-2">
            <span>📋</span>
            <span className="text-sm font-semibold text-text">Billing by Tenant</span>
            <span className="text-xs text-muted bg-surface2 px-2 py-0.5 rounded-full">{filtered.length}</span>
          </div>
          <select className="field-input w-36 text-xs" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[2fr_1fr_80px_80px_90px_1fr_auto] gap-3 px-4 py-2 border-b border-border bg-surface2">
          {['Tenant', 'Plan', 'Base', 'Disc %', 'Final/mo', 'Status', ''].map(h => (
            <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💳</div>
            <div className="text-muted text-sm">No tenants yet</div>
          </div>
        ) : (
          filtered.map(t => {
            const base = gpp(t.plan);
            const disc = t.discount || 0;
            const final = Math.round(base * (1 - disc / 100));
            return (
              <div key={t.id} className="grid grid-cols-[2fr_1fr_80px_80px_90px_1fr_auto] gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors items-center">
                {/* Tenant */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green/20 to-green2/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                    {initials(t.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text truncate">{t.name}</div>
                    <div className="text-xs text-muted truncate">{t.email}</div>
                  </div>
                </div>

                {/* Plan selector */}
                <select
                  className="bg-bg border border-border rounded-lg px-2 py-1 text-xs text-text outline-none focus:border-green2"
                  value={t.plan || ''}
                  onChange={e => updatePlan(t.id, e.target.value)}
                >
                  {plans.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>

                {/* Base price */}
                <div className="text-xs text-muted">{fmtCurrency(base)}</div>

                {/* Discount */}
                <div className="flex items-center gap-1">
                  <input
                    type="number" min="0" max="100"
                    defaultValue={disc}
                    onBlur={e => updateDiscount(t.id, e.target.value)}
                    className="w-10 bg-bg border border-border rounded text-xs text-center text-text py-1 outline-none focus:border-green2"
                  />
                  <span className="text-xs text-muted">%</span>
                </div>

                {/* Final amount */}
                <div className="text-sm font-bold text-gold">{fmtCurrency(final)}</div>

                {/* Status */}
                <div><span className={statusBadge(t.status)}>{t.status}</span></div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setInvoiceTenantId(t.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface2 text-muted hover:text-text text-xs"
                    title="Generate Invoice"
                  >🧾</button>
                  <button
                    onClick={() => markPaid(t.id)}
                    className="px-2 py-1 rounded-lg text-xs font-semibold text-accent bg-accent/10 hover:bg-accent/20 transition-colors"
                    title="Mark as Paid"
                  >✓ Paid</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals */}
      {showPlanEditor && (
        <PlanEditorModal plans={plans} onClose={() => setShowPlanEditor(false)} onSave={savePlans} />
      )}
      {invoiceTenantId !== null && (
        <InvoiceWizard
          tenants={tenants}
          plans={plans}
          gcfg={gcfg}
          initialTenantId={invoiceTenantId}
          onClose={() => setInvoiceTenantId(null)}
        />
      )}
    </div>
  );
}
