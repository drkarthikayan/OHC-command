import { useState, useEffect, useCallback } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

// ─── Alert Engine ─────────────────────────────────────────────────────────────
async function generateAlerts(tid) {
  const alerts = [];
  const now = Date.now();
  const DAY = 864e5;

  const safe = (fn) => fn.catch(() => ({ docs: [] }));

  const [
    empSnap, pharmSnap, vacSnap, hospSnap,
    certSnap, injSnap, permitSnap, opdSnap,
  ] = await Promise.all([
    safe(getDocs(collection(db, 'merchants', tid, 'employees'))),
    safe(getDocs(collection(db, 'merchants', tid, 'pharmacy'))),
    safe(getDocs(query(collection(db, 'merchants', tid, 'vaccinations'), orderBy('createdAt', 'desc'), limit(200)))),
    safe(getDocs(query(collection(db, 'merchants', tid, 'hospitalTracker'), where('status', 'in', ['Admitted', 'Critical', 'Stable', 'Improving'])))),
    safe(getDocs(query(collection(db, 'merchants', tid, 'certificates'), orderBy('createdAt', 'desc'), limit(200)))),
    safe(getDocs(query(collection(db, 'merchants', tid, 'injuries'), where('status', '!=', 'Closed'), limit(100)))),
    safe(getDocs(query(collection(db, 'merchants', tid, 'workPermits'), where('status', '==', 'Active'), limit(100)))),
    safe(getDocs(query(collection(db, 'merchants', tid, 'opd'), orderBy('createdAt', 'desc'), limit(100)))),
  ]);

  // ── 1. PHARMACY — low stock ───────────────────────────────────────────────
  const lowStock = pharmSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => p.quantity <= (p.minStock ?? 10));

  const criticalStock = lowStock.filter(p => p.quantity === 0);
  const warningStock  = lowStock.filter(p => p.quantity > 0);

  if (criticalStock.length > 0) {
    alerts.push({
      id: 'stock-critical',
      level: 'critical',
      icon: '💊',
      title: `${criticalStock.length} item${criticalStock.length > 1 ? 's' : ''} out of stock`,
      detail: criticalStock.slice(0, 3).map(p => p.name || p.medicineName).join(', '),
      link: '/portal/pharmacy',
      linkLabel: 'View Stock',
      category: 'Pharmacy',
    });
  }
  if (warningStock.length > 0) {
    alerts.push({
      id: 'stock-low',
      level: 'warning',
      icon: '📦',
      title: `${warningStock.length} item${warningStock.length > 1 ? 's' : ''} running low`,
      detail: warningStock.slice(0, 3).map(p => p.name || p.medicineName).join(', '),
      link: '/portal/pharmacy',
      linkLabel: 'View Stock',
      category: 'Pharmacy',
    });
  }

  // ── 2. HOSPITALISATIONS ───────────────────────────────────────────────────
  if (hospSnap.docs.length > 0) {
    const names = hospSnap.docs.slice(0, 3).map(d => d.data().employeeName || 'Employee').join(', ');
    alerts.push({
      id: 'hospitalised',
      level: 'critical',
      icon: '🏥',
      title: `${hospSnap.docs.length} employee${hospSnap.docs.length > 1 ? 's' : ''} currently hospitalised`,
      detail: names,
      link: '/portal/hospital',
      linkLabel: 'View Tracker',
      category: 'Clinical',
    });
  }

  // ── 3. VACCINATIONS — overdue / due soon ─────────────────────────────────
  const vacsDue    = [];
  const vacsOverdue = [];
  vacSnap.docs.forEach(d => {
    const v = d.data();
    if (!v.nextDueDate) return;
    const due = new Date(v.nextDueDate?.toDate ? v.nextDueDate.toDate() : v.nextDueDate).getTime();
    const diff = due - now;
    if (diff < 0)            vacsOverdue.push(v.employeeName || 'Employee');
    else if (diff < 30 * DAY) vacsDue.push(v.employeeName || 'Employee');
  });

  if (vacsOverdue.length > 0) {
    alerts.push({
      id: 'vac-overdue',
      level: 'critical',
      icon: '💉',
      title: `${vacsOverdue.length} vaccination${vacsOverdue.length > 1 ? 's' : ''} overdue`,
      detail: [...new Set(vacsOverdue)].slice(0, 3).join(', '),
      link: '/portal/vaccinations',
      linkLabel: 'View Register',
      category: 'Clinical',
    });
  }
  if (vacsDue.length > 0) {
    alerts.push({
      id: 'vac-due-soon',
      level: 'warning',
      icon: '📅',
      title: `${vacsDue.length} vaccination${vacsDue.length > 1 ? 's' : ''} due within 30 days`,
      detail: [...new Set(vacsDue)].slice(0, 3).join(', '),
      link: '/portal/vaccinations',
      linkLabel: 'View Register',
      category: 'Clinical',
    });
  }

  // ── 4. CERTIFICATES — expiring soon / expired ────────────────────────────
  const certExpired  = [];
  const certExpiring = [];
  certSnap.docs.forEach(d => {
    const c = d.data();
    if (!c.validUntil && !c.expiryDate) return;
    const expiry = new Date(c.validUntil || c.expiryDate).getTime();
    const diff = expiry - now;
    if (diff < 0)            certExpired.push(c.employeeName || 'Employee');
    else if (diff < 30 * DAY) certExpiring.push(c.employeeName || 'Employee');
  });

  if (certExpired.length > 0) {
    alerts.push({
      id: 'cert-expired',
      level: 'critical',
      icon: '📋',
      title: `${certExpired.length} fitness certificate${certExpired.length > 1 ? 's' : ''} expired`,
      detail: [...new Set(certExpired)].slice(0, 3).join(', '),
      link: '/portal/certificates',
      linkLabel: 'View Certificates',
      category: 'Clinical',
    });
  }
  if (certExpiring.length > 0) {
    alerts.push({
      id: 'cert-expiring',
      level: 'warning',
      icon: '⏰',
      title: `${certExpiring.length} certificate${certExpiring.length > 1 ? 's' : ''} expiring within 30 days`,
      detail: [...new Set(certExpiring)].slice(0, 3).join(', '),
      link: '/portal/certificates',
      linkLabel: 'View Certificates',
      category: 'Clinical',
    });
  }

  // ── 5. OPEN INJURIES ─────────────────────────────────────────────────────
  if (injSnap.docs.length > 0) {
    const names = injSnap.docs.slice(0, 3).map(d => d.data().employeeName || 'Employee').join(', ');
    alerts.push({
      id: 'injuries-open',
      level: 'warning',
      icon: '⚠️',
      title: `${injSnap.docs.length} injury case${injSnap.docs.length > 1 ? 's' : ''} open`,
      detail: names,
      link: '/portal/injuries',
      linkLabel: 'View Injuries',
      category: 'Safety',
    });
  }

  // ── 6. WORK PERMITS — expiring soon ──────────────────────────────────────
  const permitsExpiring = permitSnap.docs.filter(d => {
    const exp = d.data().expiryDate;
    if (!exp) return false;
    const diff = new Date(exp).getTime() - now;
    return diff > 0 && diff < 3 * DAY;
  });

  if (permitsExpiring.length > 0) {
    alerts.push({
      id: 'permits-expiring',
      level: 'critical',
      icon: '🔒',
      title: `${permitsExpiring.length} work permit${permitsExpiring.length > 1 ? 's' : ''} expiring within 3 days`,
      detail: permitsExpiring.slice(0, 3).map(d => d.data().permitNumber || d.data().workType || 'Permit').join(', '),
      link: '/portal/work-permits',
      linkLabel: 'View Permits',
      category: 'Safety',
    });
  }

  // ── 7. OPD — open visits (not closed after 48h) ──────────────────────────
  const staleOpd = opdSnap.docs.filter(d => {
    const o = d.data();
    if (o.status === 'Closed') return false;
    const created = o.createdAt?.toDate ? o.createdAt.toDate().getTime() : new Date(o.createdAt || 0).getTime();
    return (now - created) > 2 * DAY;
  });

  if (staleOpd.length > 0) {
    alerts.push({
      id: 'opd-open',
      level: 'info',
      icon: '🩺',
      title: `${staleOpd.length} OPD visit${staleOpd.length > 1 ? 's' : ''} still open after 48 hours`,
      detail: 'Please close completed cases',
      link: '/portal/opd',
      linkLabel: 'View OPD',
      category: 'Clinical',
    });
  }

  // ── 8. UNFIT EMPLOYEES ───────────────────────────────────────────────────
  const unfit = empSnap.docs.filter(d => d.data().fitnessStatus === 'Unfit');
  if (unfit.length > 0) {
    alerts.push({
      id: 'unfit-employees',
      level: 'warning',
      icon: '🚫',
      title: `${unfit.length} employee${unfit.length > 1 ? 's' : ''} marked Unfit for duty`,
      detail: unfit.slice(0, 3).map(d => d.data().name).join(', '),
      link: '/portal/employees',
      linkLabel: 'View Employees',
      category: 'Clinical',
    });
  }

  // Sort: critical first, then warning, then info
  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

// ─── Level config ─────────────────────────────────────────────────────────────
const LEVEL = {
  critical: { bg: 'bg-red-500/8',    border: 'border-red-400/30',  text: 'text-red-500',    dot: 'bg-red-500',    badge: 'bg-red-500/15 text-red-500' },
  warning:  { bg: 'bg-amber-500/8',  border: 'border-amber-400/30',text: 'text-amber-500',  dot: 'bg-amber-500',  badge: 'bg-amber-500/15 text-amber-500' },
  info:     { bg: 'bg-blue-500/8',   border: 'border-blue-400/30', text: 'text-blue-400',   dot: 'bg-blue-400',   badge: 'bg-blue-400/15 text-blue-400' },
};

// ─── Dashboard widget ─────────────────────────────────────────────────────────
export function AlertsWidget() {
  const { tenant } = useAuthStore();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('ohc_dismissed_alerts') || '[]'); } catch { return []; }
  });
  const navigate = useNavigate();

  const tid = tenant?.id;

  const load = useCallback(async () => {
    if (!tid) return;
    setLoading(true);
    try {
      const list = await generateAlerts(tid);
      setAlerts(list);
    } catch (e) {
      console.error('Alerts error', e);
    } finally {
      setLoading(false);
    }
  }, [tid]);

  useEffect(() => { load(); }, [load]);

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    sessionStorage.setItem('ohc_dismissed_alerts', JSON.stringify(next));
  };

  const visible = alerts.filter(a => !dismissed.includes(a.id));
  const critCount = visible.filter(a => a.level === 'critical').length;

  if (loading) return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold text-muted uppercase tracking-wider">Smart Alerts</div>
      </div>
      <div className="flex items-center gap-2 text-muted text-sm py-2">
        <div className="w-4 h-4 border-2 border-border border-t-sage rounded-full animate-spin" />
        Checking all modules…
      </div>
    </div>
  );

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-xs font-bold text-muted uppercase tracking-wider">Smart Alerts</div>
          {critCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
              {critCount}
            </span>
          )}
        </div>
        <button onClick={load} className="text-xs text-muted hover:text-accent transition-colors">↺ Refresh</button>
      </div>

      {visible.length === 0 ? (
        <div className="flex items-center gap-3 py-3">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-sm flex-shrink-0">✅</div>
          <div>
            <div className="text-sm font-medium text-text">All clear</div>
            <div className="text-xs text-muted">No action items right now</div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.slice(0, 6).map(alert => {
            const lv = LEVEL[alert.level];
            return (
              <div key={alert.id} className={`rounded-xl border p-3 ${lv.bg} ${lv.border} flex items-start gap-3`}>
                <div className="text-base flex-shrink-0 mt-0.5">{alert.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${lv.text}`}>{alert.title}</div>
                  {alert.detail && <div className="text-xs text-muted truncate mt-0.5">{alert.detail}</div>}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${lv.badge}`}>{alert.category}</span>
                    <button
                      onClick={() => navigate(alert.link)}
                      className="text-[11px] text-accent hover:underline font-medium"
                    >{alert.linkLabel} →</button>
                  </div>
                </div>
                <button
                  onClick={() => dismiss(alert.id)}
                  className="text-muted hover:text-text text-xs flex-shrink-0 p-0.5 rounded hover:bg-white/20"
                  title="Dismiss"
                >×</button>
              </div>
            );
          })}
          {visible.length > 6 && (
            <div className="text-xs text-center text-muted pt-1">+{visible.length - 6} more alerts</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Bell icon for top nav (shows count badge) ────────────────────────────────
export function AlertsBell() {
  const { tenant } = useAuthStore();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('ohc_dismissed_alerts') || '[]'); } catch { return []; }
  });
  const navigate = useNavigate();

  const tid = tenant?.id;

  useEffect(() => {
    if (!tid) return;
    generateAlerts(tid).then(list => {
      const visible = list.filter(a => !dismissed.includes(a.id));
      setAlerts(visible);
      setCount(visible.filter(a => a.level === 'critical').length);
    }).catch(() => {});
  }, [tid]);

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    sessionStorage.setItem('ohc_dismissed_alerts', JSON.stringify(next));
    setAlerts(prev => prev.filter(a => a.id !== id));
    setCount(prev => Math.max(0, prev - 1));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface2 transition-colors text-muted hover:text-text"
        title="Alerts"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 w-80 bg-surface border border-border rounded-2xl shadow-2xl z-50 overflow-hidden"
            style={{animation: 'slideDown 0.2s ease'}}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface2">
              <div className="text-sm font-bold text-text">Smart Alerts</div>
              <div className="flex items-center gap-2">
                {count > 0 && <span className="text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full">{count} critical</span>}
                <button onClick={() => setOpen(false)} className="text-muted hover:text-text">×</button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto p-3 space-y-2">
              {alerts.length === 0 ? (
                <div className="text-center py-6 text-muted text-sm">
                  <div className="text-2xl mb-1">✅</div>All clear!
                </div>
              ) : alerts.map(alert => {
                const lv = LEVEL[alert.level];
                return (
                  <div key={alert.id} className={`rounded-xl border p-3 ${lv.bg} ${lv.border} flex items-start gap-2`}>
                    <div className="text-sm flex-shrink-0">{alert.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-semibold ${lv.text}`}>{alert.title}</div>
                      {alert.detail && <div className="text-[11px] text-muted truncate">{alert.detail}</div>}
                      <button
                        onClick={() => { navigate(alert.link); setOpen(false); }}
                        className="text-[10px] text-accent hover:underline mt-1 block"
                      >{alert.linkLabel} →</button>
                    </div>
                    <button onClick={() => dismiss(alert.id)} className="text-muted hover:text-text text-xs">×</button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  );
}
