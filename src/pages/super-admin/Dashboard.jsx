import { useState, useEffect } from 'react';
import { useNavigate, Link, Routes, Route, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { superAdminLogout } from '../../services/auth.service';
import { db } from '../../config/firebase';
import {
  collection, getDocs, query, orderBy, limit,
  onSnapshot, where, Timestamp
} from 'firebase/firestore';
import { greeting, fmtDate, fmtCurrency, timeAgo, statusBadge, initials } from '../../utils/formatters';
import TenantsPage from './Tenants';
import UsersPage from './Users';
import BillingPage from './Billing';
import AnalyticsPage from './Analytics';
import SettingsPage from './Settings';

// ── NAV ITEMS ─────────────────────────────────────────────
const NAV = [
  { id: 'dashboard',  label: 'Dashboard',    icon: '⚡', path: '/super-admin/dashboard' },
  { id: 'tenants',    label: 'Tenants',       icon: '🏢', path: '/super-admin/tenants' },
  { id: 'billing',    label: 'Billing',       icon: '💳', path: '/super-admin/billing' },
  { id: 'users',      label: 'Users',         icon: '👥', path: '/super-admin/users' },
  { id: 'analytics',  label: 'Analytics',     icon: '📊', path: '/super-admin/analytics' },
  { id: 'activity',   label: 'Activity Log',  icon: '🕐', path: '/super-admin/activity' },
  { id: 'settings',   label: 'Settings',      icon: '⚙️', path: '/super-admin/settings' },
];

// ── SIDEBAR ───────────────────────────────────────────────
function Sidebar({ onLogout, pendingCount = 0 }) {
  const location = useLocation();
  const active = NAV.find(n => location.pathname.startsWith(n.path))?.id || 'dashboard';

  return (
    <aside className="w-56 shrink-0 bg-surface border-r border-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green to-green2 flex items-center justify-center text-base">🏥</div>
        <div>
          <div className="font-serif text-sm text-text leading-none">OHC Command</div>
          <div className="text-[10px] text-muted uppercase tracking-widest mt-0.5">Super Admin</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(n => (
          <Link
            key={n.id}
            to={n.path}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 
              ${active === n.id
                ? 'bg-green/20 text-accent font-semibold border border-green/30'
                : 'text-muted hover:text-text hover:bg-surface2'}`}
          >
            <span className="text-base">{n.icon}</span>
            {n.label}
            {n.id === 'users' && pendingCount > 0 && (
              <span className="ml-auto bg-amber text-bg text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 border-t border-border space-y-0.5">
        <a
          href="https://ohc-portal-4f2f8.web.app"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted hover:text-text hover:bg-surface2 transition-all"
        >
          <span>🔗</span> Live Portal
        </a>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-red/70 hover:text-red hover:bg-red/10 transition-all"
        >
          <span>🚪</span> Sign Out
        </button>
      </div>
    </aside>
  );
}

// ── STAT CARD ─────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = 'accent' }) {
  const colorMap = {
    accent: 'text-accent bg-accent/10',
    gold:   'text-gold bg-gold/10',
    blue:   'text-blue bg-blue/10',
    purple: 'text-purple bg-purple/10',
    red:    'text-red bg-red/10',
    amber:  'text-amber bg-amber/10',
  };
  return (
    <div className="stat-card">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg mb-3 ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="text-2xl font-serif text-text mb-0.5">{value}</div>
      <div className="text-xs font-semibold text-muted uppercase tracking-wider">{label}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

// ── TENANT ROW ────────────────────────────────────────────
function TenantRow({ t }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0 hover:bg-surface2/50 px-1 rounded transition-colors">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green/30 to-green2/30 border border-green/20 flex items-center justify-center text-xs font-bold text-accent">
        {initials(t.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text truncate">{t.name}</div>
        <div className="text-xs text-muted">{t.id}</div>
      </div>
      <div className="text-right">
        <span className={statusBadge(t.status)}>{t.status}</span>
        <div className="text-xs text-muted mt-0.5">{t.plan || 'basic'}</div>
      </div>
    </div>
  );
}

// ── ACTIVITY ITEM ─────────────────────────────────────────
function ActivityItem({ a }) {
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-border/40 last:border-0">
      <div className="w-6 h-6 rounded-full bg-surface2 border border-border flex items-center justify-center text-xs shrink-0 mt-0.5">
        {a.icon || '📋'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text leading-snug">{a.message}</div>
        <div className="text-[10px] text-muted mt-0.5">{a.tenant} · {timeAgo(a.createdAt?.toDate?.() || a.createdAt)}</div>
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD VIEW ───────────────────────────────────
function DashboardView({ stats, tenants, activity, loading }) {
  const { superAdmin } = useAuthStore();

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-text">
          {greeting()}, {superAdmin?.name?.split(' ')[0] || 'Admin'} 👋
        </h1>
        <p className="text-muted text-sm mt-1">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="🏢" label="Total Tenants"   value={loading ? '…' : stats.total}    sub={`${stats.active} active`}          color="accent"  />
        <StatCard icon="🟢" label="Active Now"      value={loading ? '…' : stats.active}   sub={`${stats.trial} on trial`}         color="blue"    />
        <StatCard icon="💰" label="Monthly Revenue" value={loading ? '…' : fmtCurrency(stats.mrr)} sub="est. MRR"              color="gold"    />
        <StatCard icon="⚠️" label="Needs Attention" value={loading ? '…' : stats.suspended} sub="suspended tenants"               color="red"     />
      </div>

      {/* Two column */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tenants */}
        <div className="card">
          <div className="card-header justify-between">
            <div className="flex items-center gap-2">
              <span>🏢</span>
              <span className="text-sm font-semibold text-text">Recent Tenants</span>
            </div>
            <Link to="/super-admin/tenants" className="text-xs text-accent hover:underline">View all →</Link>
          </div>
          <div className="px-4 py-2">
            {loading ? (
              <div className="text-center text-muted text-sm py-8">Loading…</div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">🏢</div>
                <div className="text-muted text-sm">No tenants yet</div>
                <Link to="/super-admin/tenants" className="btn-primary btn-sm mt-3 inline-flex">
                  + Add First Tenant
                </Link>
              </div>
            ) : (
              tenants.slice(0, 6).map(t => <TenantRow key={t.id} t={t} />)
            )}
          </div>
        </div>

        {/* Activity */}
        <div className="card">
          <div className="card-header">
            <span>📋</span>
            <span className="text-sm font-semibold text-text">Recent Activity</span>
          </div>
          <div className="px-4 py-2">
            {loading ? (
              <div className="text-center text-muted text-sm py-8">Loading…</div>
            ) : activity.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">📋</div>
                <div className="text-muted text-sm">No activity yet</div>
              </div>
            ) : (
              activity.map((a, i) => <ActivityItem key={i} a={a} />)
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card p-4">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Quick Actions</div>
        <div className="flex flex-wrap gap-2">
          <Link to="/super-admin/tenants" className="btn-primary btn-sm">🏢 New Tenant</Link>
          <Link to="/super-admin/billing" className="btn-ghost btn-sm">💳 Billing</Link>
          <Link to="/super-admin/users"   className="btn-ghost btn-sm">👥 Users</Link>
          <a href="https://console.firebase.google.com/project/ohc-portal-4f2f8" target="_blank" rel="noreferrer" className="btn-ghost btn-sm">🔥 Firebase Console</a>
        </div>
      </div>
    </div>
  );
}

// ── ACTIVITY LOG VIEW ─────────────────────────────────────
function ActivityLogView({ activity }) {
  if (!activity.length) return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-text">Activity Log</h1>
        <p className="text-muted text-sm mt-0.5">Actions taken in this session</p>
      </div>
      <div className="card p-12 text-center">
        <div className="text-4xl mb-3">🕐</div>
        <div className="text-muted text-sm">No activity yet — actions you take will appear here</div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-text">Activity Log</h1>
        <p className="text-muted text-sm mt-0.5">{activity.length} recent actions</p>
      </div>
      <div className="card overflow-hidden">
        {activity.map((a, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5"
              style={{ background: (a.color || 'var(--accent)') + '20' }}>
              {a.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-text">{a.text}</div>
              <div className="text-xs text-muted mt-0.5">{timeAgo(a.time)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PLACEHOLDER VIEWS ─────────────────────────────────────
const PlaceholderView = ({ title, icon }) => (
  <div className="p-6 flex items-center justify-center min-h-96">
    <div className="text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h2 className="font-serif text-2xl text-text mb-2">{title}</h2>
      <p className="text-muted text-sm">Coming up next — being built now</p>
    </div>
  </div>
);

// ── LAYOUT + DATA ─────────────────────────────────────────
export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const { superAdmin, clearAll } = useAuthStore();

  const [tenants, setTenants]   = useState([]);
  const [activity, setActivity] = useState([]);
  const [stats, setStats]       = useState({ total: 0, active: 0, trial: 0, suspended: 0, mrr: 0 });
  const [loading, setLoading]   = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!superAdmin) { navigate('/super-admin/login'); return; }

    // Load tenants
    const unsub = onSnapshot(collection(db, 'merchants'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTenants(data);

      const active    = data.filter(t => t.status === 'active').length;
      const trial     = data.filter(t => t.status === 'trial').length;
      const suspended = data.filter(t => t.status === 'suspended').length;
      const mrr       = data.filter(t => t.status === 'active')
                            .reduce((s, t) => s + (t.monthlyFee || 0), 0);
      setStats({ total: data.length, active, trial, suspended, mrr });
      setLoading(false);
    });

    // Load pending users count across all tenants for badge
    getDocs(collection(db, 'merchants')).then(async tSnap => {
      let pending = 0;
      await Promise.all(tSnap.docs.map(async td => {
        const uSnap = await getDocs(
          query(collection(db, 'merchants', td.id, 'users'), where('status', '==', 'Pending'))
        );
        pending += uSnap.size;
      }));
      setPendingCount(pending);
    }).catch(() => {});

    // Load recent activity from Firestore (falls back to empty)
    getDocs(
      query(collection(db, 'activity'), orderBy('createdAt', 'desc'), limit(50))
    ).then(snap => {
      if (snap.docs.length) {
        setActivity(snap.docs.map(d => ({ id: d.id, ...d.data(), time: d.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString() })));
      }
    }).catch(() => setActivity([]));

    return () => unsub();
  }, [superAdmin]);

  const handleLogout = async () => {
    await superAdminLogout();
    clearAll();
    navigate('/super-admin/login');
  };

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar onLogout={handleLogout} pendingCount={pendingCount} />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="dashboard"  element={<DashboardView stats={stats} tenants={tenants} activity={activity} loading={loading} />} />
          <Route path="tenants"    element={<TenantsPage />} />
          <Route path="billing"    element={<BillingPage />} />
          <Route path="users"      element={<UsersPage />} />
          <Route path="analytics"  element={<AnalyticsPage />} />
          <Route path="activity"   element={<ActivityLogView activity={activity} />} />
          <Route path="settings"   element={<SettingsPage />} />
          <Route path="*"          element={<DashboardView stats={stats} tenants={tenants} activity={activity} loading={loading} />} />
        </Routes>
      </main>
    </div>
  );
}
