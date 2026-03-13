import OnboardingWizard from './OnboardingWizard';
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import {
  collection, onSnapshot, doc, setDoc, updateDoc,
  serverTimestamp, query, orderBy
} from 'firebase/firestore';
import { fmtDate, fmtCurrency, statusBadge, initials } from '../../utils/formatters';

const PLANS = [
  { id: 'basic',      label: 'Basic',      price: 2999 },
  { id: 'standard',   label: 'Standard',   price: 4999 },
  { id: 'premium',    label: 'Premium',    price: 7999 },
  { id: 'enterprise', label: 'Enterprise', price: 14999 },
];

const STATUSES = ['active', 'trial', 'suspended', 'inactive'];

const EMPTY_FORM = {
  name: '', email: '', phone: '', address: '',
  city: '', state: '', pincode: '',
  plan: 'basic', status: 'trial',
  monthlyFee: 2999, gstNumber: '',
  contactPerson: '', notes: '',
};

// ── TENANT FORM MODAL ─────────────────────────────────────
function TenantModal({ tenant, onClose, onSave }) {
  const [form, setForm] = useState(tenant ? { ...EMPTY_FORM, ...tenant } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePlanChange = (planId) => {
    const plan = PLANS.find(p => p.id === planId);
    set('plan', planId);
    if (plan) set('monthlyFee', plan.price);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Company name is required.'); return; }
    if (!form.email.trim()) { setError('Email is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface">
          <div>
            <h2 className="font-serif text-xl text-text">
              {tenant ? 'Edit Tenant' : 'New Tenant'}
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {tenant ? `Editing ${tenant.name}` : 'Add a new OHC company to the platform'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface2 text-muted hover:text-text transition-colors">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-red/10 border border-red/30 text-red text-sm rounded-lg px-3 py-2">{error}</div>
          )}

          {/* Company Info */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Company Information</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="field-label">Company Name *</label>
                <input className="field-input" placeholder="e.g. Tata Steel OHC" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Contact Email *</label>
                <input type="email" className="field-input" placeholder="admin@company.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Phone</label>
                <input className="field-input" placeholder="+91 98765 43210" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Contact Person</label>
                <input className="field-input" placeholder="HR Manager name" value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} />
              </div>
              <div>
                <label className="field-label">GST Number</label>
                <input className="field-input" placeholder="27AAAAA0000A1Z5" value={form.gstNumber} onChange={e => set('gstNumber', e.target.value.toUpperCase())} />
              </div>
              <div className="col-span-2">
                <label className="field-label">Address</label>
                <input className="field-input" placeholder="Street address" value={form.address} onChange={e => set('address', e.target.value)} />
              </div>
              <div>
                <label className="field-label">City</label>
                <input className="field-input" placeholder="Mumbai" value={form.city} onChange={e => set('city', e.target.value)} />
              </div>
              <div>
                <label className="field-label">State</label>
                <input className="field-input" placeholder="Maharashtra" value={form.state} onChange={e => set('state', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Plan & Status */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Plan & Billing</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Plan</label>
                <select className="field-input" value={form.plan} onChange={e => handlePlanChange(e.target.value)}>
                  {PLANS.map(p => (
                    <option key={p.id} value={p.id}>{p.label} — ₹{p.price.toLocaleString('en-IN')}/mo</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Monthly Fee (₹)</label>
                <input type="number" className="field-input" value={form.monthlyFee} onChange={e => set('monthlyFee', Number(e.target.value))} />
              </div>
              <div>
                <label className="field-label">Status</label>
                <select className="field-input" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="field-label">Internal Notes</label>
            <textarea
              className="field-input resize-none"
              rows={3}
              placeholder="Any internal notes about this tenant…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : tenant ? 'Save Changes' : 'Create Tenant'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TENANT DETAIL PANEL ───────────────────────────────────
function TenantDetail({ tenant, onEdit, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green/30 to-green2/30 border border-green/20 flex items-center justify-center text-lg font-bold text-accent">
              {initials(tenant.name)}
            </div>
            <div>
              <h2 className="font-serif text-xl text-text">{tenant.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={statusBadge(tenant.status)}>{tenant.status}</span>
                <span className="text-xs text-muted">{tenant.plan}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface2 text-muted hover:text-text">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Email',          tenant.email],
              ['Phone',          tenant.phone || '—'],
              ['Contact Person', tenant.contactPerson || '—'],
              ['GST Number',     tenant.gstNumber || '—'],
              ['City',           tenant.city || '—'],
              ['State',          tenant.state || '—'],
              ['Monthly Fee',    fmtCurrency(tenant.monthlyFee || 0)],
              ['Created',        fmtDate(tenant.createdAt)],
            ].map(([k, v]) => (
              <div key={k} className="bg-bg rounded-lg p-3">
                <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">{k}</div>
                <div className="text-text font-medium truncate">{v}</div>
              </div>
            ))}
          </div>

          {tenant.notes && (
            <div className="bg-bg rounded-lg p-3">
              <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Notes</div>
              <div className="text-sm text-text">{tenant.notes}</div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={onEdit} className="btn-primary flex-1 justify-center">✏️ Edit</button>
            <button onClick={onClose} className="btn-ghost flex-1 justify-center">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN TENANTS PAGE ─────────────────────────────────────
export default function TenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editTenant, setEditTenant] = useState(null);
  const [viewTenant, setViewTenant] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'merchants'), orderBy('createdAt', 'desc')),
      (snap) => {
        setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const filtered = tenants.filter(t => {
    const matchSearch = !search ||
      t.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase()) ||
      t.city?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleSave = async (form) => {
    if (editTenant) {
      // Update existing
      await updateDoc(doc(db, 'merchants', editTenant.id), {
        ...form,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Create new — use slug of company name as ID
      const id = form.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 30) + '-' + Date.now().toString(36);
      await setDoc(doc(db, 'merchants', id), {
        ...form,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  const openCreate = () => { setEditTenant(null); setShowModal(true); };
  const openEdit   = (t) => { setEditTenant(t); setViewTenant(null); setShowModal(true); };

  return (
    <div className="p-6 max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-text">Tenants</h1>
          <p className="text-muted text-sm mt-0.5">{tenants.length} companies on the platform</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowWizard(true)} className="btn-secondary flex items-center gap-2">🧙 Onboarding Wizard</button>
          <button onClick={openCreate} className="btn-primary">🏢 New Tenant</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          className="field-input w-64"
          placeholder="🔍  Search tenants…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {['all', ...STATUSES].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize
                ${filterStatus === s
                  ? 'bg-green/20 text-accent border border-green/30'
                  : 'text-muted hover:text-text hover:bg-surface2 border border-transparent'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2.5 border-b border-border bg-surface2">
          {['Company', 'Contact', 'Plan', 'Fee/mo', 'Status', ''].map(h => (
            <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted">Loading tenants…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🏢</div>
            <div className="text-muted text-sm mb-4">
              {search ? 'No tenants match your search' : 'No tenants yet'}
            </div>
            {!search && (
              <button onClick={openCreate} className="btn-primary btn-sm">+ Add First Tenant</button>
            )}
          </div>
        ) : (
          filtered.map(t => (
            <div
              key={t.id}
              className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/40 transition-colors items-center"
            >
              {/* Company */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green/20 to-green2/20 border border-green/15 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                  {initials(t.name)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text truncate">{t.name}</div>
                  <div className="text-xs text-muted truncate">{t.city || t.id}</div>
                </div>
              </div>

              {/* Contact */}
              <div className="min-w-0">
                <div className="text-xs text-text truncate">{t.email}</div>
                <div className="text-xs text-muted truncate">{t.phone || '—'}</div>
              </div>

              {/* Plan */}
              <div className="text-xs text-text capitalize">{t.plan || 'basic'}</div>

              {/* Fee */}
              <div className="text-sm font-semibold text-gold">{fmtCurrency(t.monthlyFee || 0)}</div>

              {/* Status */}
              <div><span className={statusBadge(t.status)}>{t.status}</span></div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setViewTenant(t)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface2 text-muted hover:text-text transition-colors text-xs"
                  title="View"
                >👁️</button>
                <button
                  onClick={() => openEdit(t)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface2 text-muted hover:text-text transition-colors text-xs"
                  title="Edit"
                >✏️</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {showWizard && <OnboardingWizard onClose={() => setShowWizard(false)} onComplete={() => setShowWizard(false)} />}
      {showModal && (
        <TenantModal
          tenant={editTenant}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
      {viewTenant && !showModal && (
        <TenantDetail
          tenant={viewTenant}
          onEdit={() => openEdit(viewTenant)}
          onClose={() => setViewTenant(null)}
        />
      )}
    </div>
  );
}
