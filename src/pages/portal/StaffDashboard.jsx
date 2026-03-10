import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../config/firebase';
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate, greeting, timeAgo } from '../../utils/formatters';

export default function StaffDashboard() {
  const { staffUser, tenant } = useAuthStore();
  const [stats, setStats] = useState({ employees: 0, opdToday: 0, pharmacy: 0, pending: 0 });
  const [recentOpd, setRecentOpd] = useState([]);
  const [loading, setLoading] = useState(true);

  const tid = tenant?.id;
  const role = staffUser?.role || 'staff';

  useEffect(() => {
    if (!tid) return;
    const load = async () => {
      try {
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);

        const [empSnap, opdSnap, phSnap, recentSnap] = await Promise.all([
          getDocs(collection(db, 'merchants', tid, 'employees')),
          getDocs(query(collection(db, 'merchants', tid, 'opd'), where('visitDate', '>=', Timestamp.fromDate(todayStart)))),
          getDocs(collection(db, 'merchants', tid, 'pharmacy')),
          getDocs(query(collection(db, 'merchants', tid, 'opd'), orderBy('visitDate', 'desc'), limit(5))),
        ]);

        const pendingSnap = await getDocs(query(collection(db, 'merchants', tid, 'employees'), where('status', '==', 'Pending')));

        setStats({
          employees: empSnap.size,
          opdToday: opdSnap.size,
          pharmacy: phSnap.size,
          pending: pendingSnap.size,
        });
        setRecentOpd(recentSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tid]);

  const STAT_CARDS = [
    { label: 'Total Employees', value: stats.employees, icon: '👤', color: 'text-accent',  link: '/portal/employees' },
    { label: 'OPD Today',       value: stats.opdToday,  icon: '📋', color: 'text-blue',    link: '/portal/opd' },
    { label: 'Pharmacy Items',  value: stats.pharmacy,  icon: '💊', color: 'text-gold',    link: '/portal/pharmacy' },
    { label: 'Pending',         value: stats.pending,   icon: '⏳', color: 'text-amber',   link: '/portal/employees' },
  ];

  const QUICK_ACTIONS = [
    { label: 'New OPD Visit',    icon: '📋', link: '/portal/opd',          roles: ['doctor','nurse','admin'] },
    { label: 'Add Employee',     icon: '👤', link: '/portal/employees',    roles: ['admin','staff'] },
    { label: 'Dispense Medicine',icon: '💊', link: '/portal/pharmacy',     roles: ['pharmacy','doctor','admin'] },
    { label: 'Certificate',      icon: '📜', link: '/portal/certificates', roles: ['doctor','admin'] },
  ].filter(a => a.roles.includes(role));

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-text">{greeting()}, {staffUser?.name?.split(' ')[0]}!</h1>
        <p className="text-muted text-sm mt-0.5">{tenant?.name} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_CARDS.map(s => (
          <Link to={s.link} key={s.label} className="stat-card hover:no-underline block">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className={`font-serif text-3xl ${s.color} mb-0.5`}>
              {loading ? '—' : s.value}
            </div>
            <div className="text-xs text-muted uppercase tracking-wider">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Recent OPD */}
        <div className="card overflow-hidden md:col-span-2">
          <div className="card-header">
            <span>📋</span>
            <h3 className="text-sm font-semibold text-text">Recent OPD Visits</h3>
            <Link to="/portal/opd" className="ml-auto text-xs text-accent hover:underline">View all →</Link>
          </div>
          {loading ? (
            <div className="py-8 text-center text-muted text-sm">Loading…</div>
          ) : recentOpd.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-3xl mb-2">📋</div>
              <div className="text-muted text-sm">No OPD visits yet</div>
            </div>
          ) : recentOpd.map(v => (
            <div key={v.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors">
              <div className="w-8 h-8 rounded-full bg-green/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                {(v.employeeName || 'V')[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text truncate">{v.employeeName || 'Unknown'}</div>
                <div className="text-xs text-muted truncate">{v.complaint || 'No complaint noted'}</div>
              </div>
              <div className="text-xs text-muted shrink-0">{v.visitDate ? timeAgo(v.visitDate.toDate?.() || v.visitDate) : '—'}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="card overflow-hidden">
          <div className="card-header">
            <span>⚡</span>
            <h3 className="text-sm font-semibold text-text">Quick Actions</h3>
          </div>
          <div className="p-3 space-y-2">
            {QUICK_ACTIONS.map(a => (
              <Link
                key={a.label}
                to={a.link}
                className="flex items-center gap-3 p-3 rounded-lg bg-surface2 hover:bg-surface2/60 text-sm text-text transition-colors hover:no-underline"
              >
                <span className="text-base">{a.icon}</span>
                <span>{a.label}</span>
              </Link>
            ))}
            {QUICK_ACTIONS.length === 0 && (
              <div className="text-muted text-xs text-center py-4">No quick actions for your role</div>
            )}
          </div>

          {/* Tenant info */}
          <div className="border-t border-border p-4 space-y-2">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Tenant Info</div>
            {[
              { label: 'OHC Name', value: tenant?.name },
              { label: 'Plan',     value: tenant?.plan || '—' },
              { label: 'Status',   value: tenant?.status || '—' },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-xs">
                <span className="text-muted">{r.label}</span>
                <span className="text-text font-medium capitalize">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
