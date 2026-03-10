import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { initials, fmtCurrency } from '../../utils/formatters';

const SUBCOLLECTIONS = [
  { key: 'opd',         label: 'OPD Visits',      icon: '📋', color: 'text-accent' },
  { key: 'employees',   label: 'Employees',        icon: '👤', color: 'text-blue' },
  { key: 'pharmacy',    label: 'Pharmacy Items',   icon: '💊', color: 'text-gold' },
  { key: 'certificates',label: 'Certificates',     icon: '📜', color: 'text-purple' },
];

export default function AnalyticsPage() {
  const [tenants, setTenants] = useState([]);
  const [totals, setTotals] = useState({ opd: 0, employees: 0, pharmacy: 0, certificates: 0 });
  const [rows, setRows] = useState([]);
  const [planDist, setPlanDist] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load tenants first
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'merchants'), snap => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Load analytics when tenants change
  useEffect(() => {
    if (!tenants.length) { setLoading(false); return; }
    setLoading(true);

    const load = async () => {
      let t = { opd: 0, employees: 0, pharmacy: 0, certificates: 0 };
      const tableRows = [];

      await Promise.all(tenants.map(async tenant => {
        try {
          const [empSnap, opdSnap, phSnap, certSnap] = await Promise.all([
            getDocs(collection(db, 'merchants', tenant.id, 'employees')),
            getDocs(collection(db, 'merchants', tenant.id, 'opd')),
            getDocs(collection(db, 'merchants', tenant.id, 'pharmacy')),
            getDocs(collection(db, 'merchants', tenant.id, 'certificates')),
          ]);
          t.employees   += empSnap.size;
          t.opd         += opdSnap.size;
          t.pharmacy    += phSnap.size;
          t.certificates += certSnap.size;
          tableRows.push({
            id: tenant.id,
            name: tenant.name,
            plan: tenant.plan || '—',
            status: tenant.status,
            employees: empSnap.size,
            opd: opdSnap.size,
            pharmacy: phSnap.size,
            certificates: certSnap.size,
          });
        } catch (e) {
          tableRows.push({ id: tenant.id, name: tenant.name, plan: tenant.plan || '—', status: tenant.status, employees: 0, opd: 0, pharmacy: 0, certificates: 0 });
        }
      }));

      // Plan distribution
      const dist = {};
      tenants.forEach(t => { dist[t.plan || 'Unknown'] = (dist[t.plan || 'Unknown'] || 0) + 1; });
      const total = tenants.length || 1;
      const planColors = { Starter: '#74c69d', Pro: '#4a9eca', Enterprise: '#b06af0' };
      const distArr = Object.entries(dist).map(([name, count]) => ({
        name, count, pct: Math.round(count / total * 100),
        color: planColors[name] || '#74c69d',
      })).sort((a, b) => b.count - a.count);

      tableRows.sort((a, b) => b.opd - a.opd);
      setTotals(t);
      setRows(tableRows);
      setPlanDist(distArr);
      setLoading(false);
    };

    load();
  }, [tenants]);

  const statCards = [
    { ...SUBCOLLECTIONS[0], value: totals.opd },
    { ...SUBCOLLECTIONS[1], value: totals.employees },
    { ...SUBCOLLECTIONS[2], value: totals.pharmacy },
    { ...SUBCOLLECTIONS[3], value: totals.certificates },
  ];

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-text">Platform Analytics</h1>
          <p className="text-muted text-sm mt-0.5">Aggregated from all tenants' Firestore data</p>
        </div>
        <button onClick={() => window.location.reload()} className="btn-ghost btn-sm">↻ Refresh</button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.key} className="stat-card">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className={`font-serif text-3xl ${s.color} mb-0.5`}>
              {loading ? '—' : s.value.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-muted uppercase tracking-wider">{s.label}</div>
            <div className="text-xs text-muted mt-1">All tenants</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Per-tenant table */}
        <div className="card overflow-hidden md:col-span-2">
          <div className="card-header">
            <span>📊</span>
            <h3 className="text-sm font-semibold text-text">Usage by Tenant</h3>
            <span className="text-xs text-muted bg-surface2 px-2 py-0.5 rounded-full ml-1">{rows.length}</span>
          </div>
          <div className="grid grid-cols-[2fr_60px_60px_60px_60px] gap-2 px-4 py-2 border-b border-border bg-surface2">
            {['Tenant', 'Emp', 'OPD', 'Pharm', 'Cert'].map(h => (
              <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>
            ))}
          </div>
          {loading ? (
            <div className="text-center py-12 text-muted text-sm">Loading analytics…</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📊</div>
              <div className="text-muted text-sm">No tenant data yet</div>
            </div>
          ) : rows.map(r => (
            <div key={r.id} className="grid grid-cols-[2fr_60px_60px_60px_60px] gap-2 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors items-center">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green/20 to-green2/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                  {initials(r.name)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text truncate">{r.name}</div>
                  <div className="text-xs text-muted">{r.plan}</div>
                </div>
              </div>
              <div className="text-sm text-text font-medium">{r.employees}</div>
              <div className="text-sm text-text font-medium">{r.opd}</div>
              <div className="text-sm text-text font-medium">{r.pharmacy}</div>
              <div className="text-sm text-text font-medium">{r.certificates}</div>
            </div>
          ))}
        </div>

        {/* Plan distribution */}
        <div className="card p-4">
          <div className="font-serif text-base text-text mb-4">Plan Distribution</div>
          {loading ? (
            <div className="text-center py-8 text-muted text-sm">Loading…</div>
          ) : planDist.length === 0 ? (
            <div className="text-center py-8 text-muted text-sm">No tenants yet</div>
          ) : (
            <div className="space-y-4">
              {planDist.map(p => (
                <div key={p.name}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-text">{p.name}</span>
                    <span className="text-muted">{p.count} · {p.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${p.pct}%`, background: p.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {!loading && tenants.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border space-y-2">
              {[
                { label: 'Total Tenants', value: tenants.length },
                { label: 'Active', value: tenants.filter(t => t.status === 'active').length },
                { label: 'On Trial', value: tenants.filter(t => t.status === 'trial').length },
                { label: 'Suspended', value: tenants.filter(t => t.status === 'suspended').length },
              ].map(s => (
                <div key={s.label} className="flex justify-between text-sm">
                  <span className="text-muted">{s.label}</span>
                  <span className="text-text font-medium">{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
