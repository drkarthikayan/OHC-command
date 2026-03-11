import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import {
  collection, onSnapshot, doc, addDoc, updateDoc,
  deleteDoc, getDocs, serverTimestamp, query, orderBy
} from 'firebase/firestore';
import { fmtDate, initials, statusBadge, roleBadge, roleIcon } from '../../utils/formatters';

const ROLES = ['doctor', 'nurse', 'admin', 'pharmacy', 'staff'];
const STATUSES = ['Approved', 'Pending', 'suspended'];

const EMPTY_FORM = {
  name: '', email: '', mobile: '',
  role: 'doctor', status: 'Approved',
  staffId: '', password: '',
  tenantId: '',
};

function genStaffId(role) {
  const prefix = { doctor: 'DR', nurse: 'NR', admin: 'AD', pharmacy: 'PH', staff: 'ST' };
  return (prefix[role] || 'US') + String(Math.floor(Math.random() * 900) + 100);
}

function genPassword() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

// ── USER MODAL ────────────────────────────────────────────
function UserModal({ user, tenants, onClose, onSave }) {
  const [form, setForm] = useState(user
    ? { ...EMPTY_FORM, ...user, tenantId: user.tId || '' }
    : { ...EMPTY_FORM, staffId: genStaffId('doctor'), password: genPassword() }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleRoleChange = (role) => {
    set('role', role);
    if (!user) set('staffId', genStaffId(role));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.email.trim()) { setError('Email is required.'); return; }
    if (!form.tenantId) { setError('Select a tenant.'); return; }
    if (!form.staffId.trim()) { setError('Staff ID is required.'); return; }
    if (!form.password.trim()) { setError('Password is required.'); return; }
    setSaving(true); setError('');
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
      <div className="bg-surface border border-border rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface">
          <div>
            <h2 className="font-serif text-xl text-text">{user ? 'Edit User' : 'Add User'}</h2>
            <p className="text-xs text-muted mt-0.5">{user ? `Editing ${user.name}` : 'Create a new staff member'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface2 text-muted hover:text-text">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="bg-red/10 border border-red/30 text-red text-sm rounded-lg px-3 py-2">{error}</div>}

          {/* Basic info */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Personal Info</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="field-label">Full Name *</label>
                <input className="field-input" placeholder="Dr. Karthikayan" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Email *</label>
                <input type="email" className="field-input" placeholder="user@company.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Mobile</label>
                <input className="field-input" placeholder="9876543210" value={form.mobile} onChange={e => set('mobile', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Role & Tenant */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Role & Assignment</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Role *</label>
                <select className="field-input" value={form.role} onChange={e => handleRoleChange(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{roleIcon[r]} {r}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Tenant *</label>
                <select
                  className="field-input"
                  value={form.tenantId}
                  onChange={e => set('tenantId', e.target.value)}
                  disabled={!!user}
                >
                  <option value="">— Select OHC —</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Status</label>
                <select className="field-input" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Credentials */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Login Credentials</div>
            <div className="bg-bg border border-border rounded-xl p-4 space-y-3">
              <p className="text-xs text-muted">Staff use these to log into the portal. Share securely.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Staff ID *</label>
                  <div className="flex gap-2">
                    <input className="field-input flex-1" placeholder="DR001" value={form.staffId} onChange={e => set('staffId', e.target.value.toUpperCase())} />
                    <button type="button" onClick={() => set('staffId', genStaffId(form.role))} className="btn-ghost btn-sm px-2" title="Regenerate">🔄</button>
                  </div>
                </div>
                <div>
                  <label className="field-label">Password *</label>
                  <div className="flex gap-2">
                    <input className="field-input flex-1" placeholder="Password" value={form.password} onChange={e => set('password', e.target.value)} />
                    <button type="button" onClick={() => set('password', genPassword())} className="btn-ghost btn-sm px-2" title="Regenerate">🔄</button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-amber/10 border border-amber/20 rounded-lg p-2">
                <span className="text-amber text-sm">⚠️</span>
                <span className="text-xs text-amber">Share Staff ID + Password with the staff member. They use this to login.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : user ? 'Save Changes' : 'Add User'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CONFIRM DIALOG ────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-xs p-6 text-center">
        <div className="text-3xl mb-3">⚠️</div>
        <h3 className="font-serif text-lg text-text mb-2">{title}</h3>
        <p className="text-muted text-sm mb-5">{message}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={onCancel} className="btn-ghost flex-1">Cancel</button>
          <button onClick={onConfirm} className="btn-danger flex-1">Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN USERS PAGE ───────────────────────────────────────
export default function UsersPage() {
  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);     // [{...userData, tId, tName}]
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [confirm, setConfirm] = useState(null); // {title, message, onConfirm}

  // Load tenants
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'merchants'), snap => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Load all users from all tenants
  useEffect(() => {
    if (!tenants.length) { setLoading(false); return; }
    setLoading(true);

    let allUsers = [];
    let loaded = 0;

    tenants.forEach(tenant => {
      getDocs(query(
        collection(db, 'merchants', tenant.id, 'users'),
        orderBy('createdAt', 'desc')
      )).then(snap => {
        const tenantUsers = snap.docs.map(d => ({
          id: d.id,
          tId: tenant.id,
          tName: tenant.name || tenant.id,
          ...d.data(),
        }));
        allUsers = [...allUsers.filter(u => u.tId !== tenant.id), ...tenantUsers];
        loaded++;
        if (loaded === tenants.length) {
          setUsers(allUsers);
          setLoading(false);
        }
      }).catch(() => {
        loaded++;
        if (loaded === tenants.length) setLoading(false);
      });
    });
  }, [tenants]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.staffId || '').toLowerCase().includes(q) ||
      (u.tName || '').toLowerCase().includes(q);
    const matchRole = !filterRole || u.role === filterRole;
    const matchStatus = !filterStatus || u.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const pendingCount = users.filter(u => u.status === 'Pending').length;

  const handleSave = async (form) => {
    const data = {
      name: form.name,
      email: form.email,
      mobile: form.mobile,
      role: form.role,
      status: form.status,
      staffId: form.staffId.toLowerCase(),
      password: form.password,
      updatedAt: serverTimestamp(),
    };

    if (editUser) {
      await updateDoc(doc(db, 'merchants', editUser.tId, 'users', editUser.id), data);
      setUsers(prev => prev.map(u =>
        u.id === editUser.id && u.tId === editUser.tId
          ? { ...u, ...data, staffId: form.staffId.toLowerCase() }
          : u
      ));
    } else {
      const ref = await addDoc(collection(db, 'merchants', form.tenantId, 'users'), {
        ...data,
        createdAt: serverTimestamp(),
      });
      const tenant = tenants.find(t => t.id === form.tenantId);
      setUsers(prev => [{
        id: ref.id,
        tId: form.tenantId,
        tName: tenant?.name || form.tenantId,
        ...data,
        staffId: form.staffId.toLowerCase(),
      }, ...prev]);
    }
  };

  const handleApprove = async (user) => {
    await updateDoc(doc(db, 'merchants', user.tId, 'users', user.id), {
      status: 'Approved',
      updatedAt: serverTimestamp(),
    });
    setUsers(prev => prev.map(u =>
      u.id === user.id && u.tId === user.tId ? { ...u, status: 'Approved' } : u
    ));
  };

  const handleDelete = (user) => {
    setConfirm({
      title: `Delete "${user.name}"?`,
      message: 'This removes the user from Firestore. They will no longer be able to login.',
      onConfirm: async () => {
        await deleteDoc(doc(db, 'merchants', user.tId, 'users', user.id));
        setUsers(prev => prev.filter(u => !(u.id === user.id && u.tId === user.tId)));
        setConfirm(null);
      },
    });
  };

  const openCreate = () => { setEditUser(null); setShowModal(true); };
  const openEdit = (u) => { setEditUser(u); setShowModal(true); };

  return (
    <div className="p-6 max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-text">Users</h1>
          <p className="text-muted text-sm mt-0.5">
            {users.length} users across {tenants.length} tenants
            {pendingCount > 0 && (
              <span className="ml-2 bg-amber/15 text-amber text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">👤 Add User</button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          className="field-input w-64"
          placeholder="🔍  Search name, email, staff ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="field-input w-36" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{roleIcon[r]} {r}</option>)}
        </select>
        <select className="field-input w-36" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2.5 border-b border-border bg-surface2">
          {['Staff Member', 'Tenant', 'Role', 'Staff ID', 'Status', ''].map(h => (
            <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted text-sm">Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">👥</div>
            <div className="text-muted text-sm mb-4">
              {search || filterRole || filterStatus ? 'No users match your filters' : 'No users yet'}
            </div>
            {!search && !filterRole && !filterStatus && (
              <button onClick={openCreate} className="btn-primary btn-sm">+ Add First User</button>
            )}
          </div>
        ) : (
          filtered.map(u => (
            <div
              key={`${u.tId}-${u.id}`}
              className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/40 transition-colors items-center"
            >
              {/* Name */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green/30 to-green2/30 border border-green/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                  {initials(u.name)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text truncate">{u.name || '—'}</div>
                  <div className="text-xs text-muted truncate">{u.email || '—'}</div>
                </div>
              </div>

              {/* Tenant */}
              <div className="text-xs text-muted truncate">{u.tName}</div>

              {/* Role */}
              <div>
                <span className={`${roleBadge(u.role)} badge`}>
                  {roleIcon[u.role]} {u.role}
                </span>
              </div>

              {/* Staff ID */}
              <div className="font-mono text-xs text-accent bg-accent/10 px-2 py-0.5 rounded w-fit">
                {u.staffId?.toUpperCase() || '—'}
              </div>

              {/* Status */}
              <div className="flex items-center gap-1.5">
                <span className={statusBadge(u.status)}>{u.status || 'Approved'}</span>
                {u.status === 'Pending' && (
                  <button
                    onClick={() => handleApprove(u)}
                    className="w-5 h-5 rounded-full bg-accent/20 text-accent hover:bg-accent/30 flex items-center justify-center text-xs transition-colors"
                    title="Approve"
                  >✓</button>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(u)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface2 text-muted hover:text-text text-xs" title="Edit">✏️</button>
                <button onClick={() => handleDelete(u)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red/10 text-muted hover:text-red text-xs" title="Delete">🗑️</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <UserModal
          user={editUser}
          tenants={tenants}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
