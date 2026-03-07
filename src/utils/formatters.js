// ── DATE & TIME ───────────────────────────────────────────
export const fmtDate = (val) => {
  if (!val) return '—';
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

export const fmtDateTime = (val) => {
  if (!val) return '—';
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
};

export const timeAgo = (val) => {
  const s = Math.floor((Date.now() - new Date(val).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

// ── CURRENCY ──────────────────────────────────────────────
export const fmtCurrency = (v) =>
  '₹' + (Number(v) || 0).toLocaleString('en-IN');

// ── STRINGS ───────────────────────────────────────────────
export const initials = (name = '') =>
  name.split(' ').map((w) => w[0] || '').join('').slice(0, 2).toUpperCase() || '?';

export const esc = (s) => {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
};

// ── ROLES ─────────────────────────────────────────────────
export const ROLES = ['doctor', 'nurse', 'admin', 'pharmacy', 'staff'];

export const roleIcon = {
  doctor:   '👨‍⚕️',
  nurse:    '💉',
  admin:    '🔐',
  pharmacy: '💊',
  staff:    '👤',
  super_admin: '⚡',
};

export const roleBadge = (role) => {
  const map = {
    doctor:   'badge-blue',
    nurse:    'badge-purple',
    admin:    'badge-active',
    pharmacy: 'badge-trial',
    staff:    'badge-blue',
  };
  return map[role] || 'badge-blue';
};

// ── STATUS ────────────────────────────────────────────────
export const statusBadge = (status) => {
  const map = {
    active:    'badge-active',
    trial:     'badge-trial',
    suspended: 'badge-suspended',
    Approved:  'badge-active',
    Pending:   'badge-pending',
    pending:   'badge-pending',
  };
  return map[status] || 'badge-blue';
};

// ── GREETING ──────────────────────────────────────────────
export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};
