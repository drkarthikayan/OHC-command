import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../config/firebase';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { fmtDate, greeting } from '../../utils/formatters';
import { calcIHI, gradeIHI, colorIHI } from '../../utils/ihi';
import { AlertsWidget } from './SmartAlerts';

// ─── OPD 7-Day Bar Chart ──────────────────────────────────────────────────────
function OpdTrendChart({ data }) {
  if (!data.length) return <div className="flex items-center justify-center h-20 text-muted text-xs">No data yet</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="text-[10px] text-muted font-medium">{d.count > 0 ? d.count : ''}</div>
          <div className="w-full rounded-t transition-all duration-700"
            style={{
              height: `${Math.max(3, (d.count / max) * 52)}px`,
              background: i === data.length - 1 ? '#74c69d' : '#2d6a4f',
              opacity: 0.55 + (i / data.length) * 0.45,
            }} />
          <div className="text-[9px] text-muted">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── SVG Donut Chart ─────────────────────────────────────────────────────────
function DonutChart({ segments }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (!total) return (
    <div className="flex items-center justify-center w-20 h-20">
      <span className="text-muted text-xs">No data</span>
    </div>
  );
  const r = 28, cx = 40, cy = 40, circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a2d1a" strokeWidth="12" />
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const pct = seg.value / total;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth="12"
            strokeDasharray={`${pct * circ} ${circ}`}
            strokeDashoffset={-(offset * circ - circ / 4)}
          />
        );
        offset += pct;
        return el;
      })}
      <text x={cx} y={cy - 3} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#e8f5e1">{total}</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize="7" fill="#8aad8a">staff</text>
    </svg>
  );
}

// ─── IHI Half-Gauge ───────────────────────────────────────────────────────────
function IHIGauge({ score }) {
  const color = colorIHI(score);
  const r = 30, cx = 44, cy = 44;
  const circ = Math.PI * r;
  const dash = (score / 100) * circ;
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <div className="flex flex-col items-center">
      <svg width="88" height="52" viewBox="0 0 88 52">
        <path d={d} fill="none" stroke="#1a2d1a" strokeWidth="11" strokeLinecap="round" />
        <path d={d} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 1.2s ease' }} />
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="15" fontWeight="bold" fill={color}>{score}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="7" fill="#8aad8a">/ 100</text>
      </svg>
      <div className="text-xs font-bold mt-0.5" style={{ color }}>{gradeIHI(score)}</div>
    </div>
  );
}

// ─── IHI Score Bar ────────────────────────────────────────────────────────────
function IHIBar({ score }) {
  const color = colorIHI(score);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface2 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-bold w-6 text-right shrink-0" style={{ color }}>{score}</span>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function StaffDashboard() {
  const { staffUser, tenant } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ employees: 0, opdToday: 0, lowStock: 0, campaigns: 0, fit: 0, unfit: 0, restricted: 0, pending: 0 });
  const [opdTrend, setOpdTrend] = useState([]);
  const [recentOpd, setRecentOpd] = useState([]);
  const [hospitalised, setHospitalised] = useState([]);
  const [ihiAvg, setIhiAvg] = useState(0);
  const [ihiDist, setIhiDist] = useState([]);
  const [ihiEmployees, setIhiEmployees] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [shiftBreakdown, setShiftBreakdown] = useState({General:0,Morning:0,Afternoon:0,Night:0});

  const tid = tenant?.id;
  const role = staffUser?.role || 'staff';

  const load = useCallback(async () => {
    if (!tid) return;
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 6);
      const sevenAgoStr = sevenAgo.toISOString().slice(0, 10);

      const [empSnap, opdTodaySnap, phSnap, recentSnap, hospSnap, campSnap] = await Promise.all([
        getDocs(collection(db, 'merchants', tid, 'employees')),
        getDocs(query(collection(db, 'merchants', tid, 'opd'), where('visitDate', '>=', todayStr))),
        getDocs(collection(db, 'merchants', tid, 'pharmacy')),
        getDocs(query(collection(db, 'merchants', tid, 'opd'), orderBy('createdAt', 'desc'), limit(6))),
        getDocs(query(collection(db, 'merchants', tid, 'hospitalTracker'), where('status', 'in', ['Admitted', 'Critical', 'Stable', 'Improving']))),
        getDocs(query(collection(db, 'merchants', tid, 'campaigns'), where('status', '==', 'Active'))),
      ]);

      const employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const lowStock = phSnap.docs.filter(d => {
        const { quantity = 0, minStock = 10 } = d.data();
        return quantity <= minStock;
      }).length;

      const fit       = employees.filter(e => e.fitnessStatus === 'Fit').length;
      const unfit     = employees.filter(e => e.fitnessStatus === 'Unfit').length;
      const restricted= employees.filter(e => e.fitnessStatus === 'Fit with Restriction').length;
      const pending   = employees.length - fit - unfit - restricted;

      setStats({ employees: employees.length, opdToday: opdTodaySnap.size, lowStock, campaigns: campSnap.size, fit, unfit, restricted, pending: Math.max(0, pending) });
      const shiftMap = {General:0,Morning:0,Afternoon:0,Night:0};
      opdTodaySnap.docs.forEach(d=>{ const s=d.data().shift||'General'; shiftMap[s]!==undefined?shiftMap[s]++:shiftMap.General++; });
      setShiftBreakdown(shiftMap);
      setRecentOpd(recentSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setHospitalised(hospSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // ── OPD 7-day trend ─────────────────────────────
      const opdWeekSnap = await getDocs(query(
        collection(db, 'merchants', tid, 'opd'),
        where('visitDate', '>=', sevenAgoStr),
        orderBy('visitDate', 'asc')
      ));
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return { date: d.toISOString().slice(0, 10), label: ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()], count: 0 };
      });
      opdWeekSnap.docs.forEach(doc => {
        const day = days.find(d => d.date === doc.data().visitDate);
        if (day) day.count++;
      });
      setOpdTrend(days);

      // ── IHI calculation (up to 50 employees) ────────
      const empSample = employees.slice(0, 50);
      const examResults = await Promise.all(empSample.map(emp =>
        getDocs(query(
          collection(db, 'merchants', tid, 'annualChecks'),
          where('employeeId', '==', emp.empId || emp.id),
          orderBy('examDate', 'desc'),
          limit(1)
        )).catch(() => ({ docs: [] }))
      ));

      const withIHI = empSample.map((emp, i) => {
        const exam = examResults[i]?.docs?.[0]?.data() || {};
        const { score } = calcIHI(emp, exam, {});
        return { ...emp, ihiScore: score };
      });

      const scored = withIHI.filter(e => e.ihiScore > 0);
      const avg = scored.length ? Math.round(scored.reduce((s, e) => s + e.ihiScore, 0) / scored.length) : 0;

      setIhiAvg(avg);
      setIhiDist([
        { label: 'Excellent (85+)', color: '#74c69d', value: withIHI.filter(e => e.ihiScore >= 85).length },
        { label: 'Good (70–84)',    color: '#4a9eca', value: withIHI.filter(e => e.ihiScore >= 70 && e.ihiScore < 85).length },
        { label: 'Average (50–69)',  color: '#f0a500', value: withIHI.filter(e => e.ihiScore >= 50 && e.ihiScore < 70).length },
        { label: 'Below Avg',       color: '#f97316', value: withIHI.filter(e => e.ihiScore > 0 && e.ihiScore < 50).length },
      ]);
      setIhiEmployees(withIHI.sort((a, b) => b.ihiScore - a.ihiScore));

      // ── Alerts ───────────────────────────────────────
      const alertList = [];
      if (lowStock > 0)       alertList.push({ icon: '💊', text: `${lowStock} pharmacy item${lowStock > 1 ? 's' : ''} low on stock`, color: '#f0a500' });
      if (hospSnap.size > 0)  alertList.push({ icon: '🏨', text: `${hospSnap.size} employee${hospSnap.size > 1 ? 's' : ''} hospitalised`, color: '#ef4444' });
      if (unfit > 0)          alertList.push({ icon: '⚠️', text: `${unfit} employee${unfit > 1 ? 's' : ''} marked Unfit for duty`, color: '#f97316' });
      setAlerts(alertList);

    } catch (e) {
      console.error('Dashboard error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tid]);

  useEffect(() => { load(); }, [load]);
  const refresh = () => { setRefreshing(true); load(); };

  const STAT_CARDS = [
    { label: 'Total Employees', value: stats.employees, icon: '👥', sub: `${stats.fit} fit for work`,    link: '/portal/employees' },
    { label: 'OPD Today',       value: stats.opdToday,  icon: '📝', sub: 'patient visits',               link: '/portal/opd' },
    { label: 'Low Stock',       value: stats.lowStock,  icon: '💊', sub: 'pharmacy items',               link: '/portal/pharmacy' },
    { label: 'Active Campaigns',value: stats.campaigns, icon: '🏥', sub: 'health programs',              link: '/portal/employees' },
  ];

  const healthDist = [
    { label: 'Fit',          value: stats.fit,        color: '#74c69d' },
    { label: 'Restricted',   value: stats.restricted, color: '#f0a500' },
    { label: 'Unfit',        value: stats.unfit,      color: '#ef4444' },
    { label: 'Pending',      value: stats.pending,    color: '#4b5563' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-text">{greeting()}, {staffUser?.name?.split(' ')[0]}!</h1>
          <p className="text-muted text-sm mt-0.5">
            {tenant?.name} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={refresh} disabled={refreshing}
          className="btn-ghost gap-1.5 text-sm disabled:opacity-50">
          <span style={{ display: 'inline-block' }} className={refreshing ? 'animate-spin' : ''}>↻</span> Refresh
        </button>
      </div>

      {/* ── Alerts banner ── */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border"
              style={{ background: a.color + '18', borderColor: a.color + '40', color: a.color }}>
              {a.icon} {a.text}
            </div>
          ))}
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(s => (
          <Link to={s.link} key={s.label} className="stat-card block hover:no-underline">
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="font-serif text-3xl text-accent mb-0.5">{loading ? '—' : s.value}</div>
            <div className="text-xs text-muted uppercase tracking-wider">{s.label}</div>
            <div className="text-xs text-muted mt-0.5 opacity-70">{s.sub}</div>
          </Link>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* OPD 7-day trend */}
        <div className="card overflow-hidden">
          <div className="card-header"><span>📈</span><h3 className="text-sm font-semibold text-text">OPD 7-Day Trend</h3></div>
          <div className="p-4">
            {loading ? <div className="h-20 flex items-center justify-center text-muted text-xs">Loading…</div>
              : <OpdTrendChart data={opdTrend} />}
            <div className="text-xs text-muted mt-2 text-center">
              {opdTrend.reduce((s, d) => s + d.count, 0)} visits this week
            </div>
          </div>
        </div>

        {/* Org Health Index */}
        <div className="card overflow-hidden">
          <div className="card-header"><span>❤️</span><h3 className="text-sm font-semibold text-text">Org Health Index</h3></div>
          <div className="p-4 flex flex-col items-center">
            {loading
              ? <div className="h-20 flex items-center justify-center text-muted text-xs">Calculating…</div>
              : <>
                  <IHIGauge score={ihiAvg} />
                  <div className="text-xs text-muted mt-2 mb-3 text-center">Avg across {stats.employees} employees</div>
                  <div className="w-full space-y-1.5">
                    {ihiDist.map(d => (
                      <div key={d.label} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-muted flex-1 truncate">{d.label}</span>
                        <span className="text-text font-semibold">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
            }
          </div>
        </div>

        {/* Health Status Donut */}
        <div className="card overflow-hidden">
          <div className="card-header"><span>🥧</span><h3 className="text-sm font-semibold text-text">Health Status</h3></div>
          <div className="p-4">
            {loading
              ? <div className="h-20 flex items-center justify-center text-muted text-xs">Loading…</div>
              : <div className="flex flex-col items-center gap-3">
                  <DonutChart segments={healthDist} />
                  <div className="w-full space-y-1.5">
                    {healthDist.map(d => (
                      <div key={d.label} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-muted flex-1">{d.label}</span>
                        <span className="text-text font-semibold">{d.value}</span>
                        <span className="text-muted w-7 text-right">
                          {stats.employees ? Math.round(d.value / stats.employees * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
            }
          </div>
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Recent OPD */}
        <div className="md:col-span-2 card overflow-hidden">
          <div className="card-header">
            <span>📋</span>
            <h3 className="text-sm font-semibold text-text">Today's OPD</h3>
            <Link to="/portal/opd" className="ml-auto text-xs text-accent hover:underline">New Entry →</Link>
          </div>
          {loading
            ? <div className="py-10 text-center text-muted text-sm">Loading…</div>
            : recentOpd.length === 0
              ? <div className="py-10 text-center"><div className="text-3xl mb-2">📋</div><div className="text-muted text-sm">No OPD visits yet today</div></div>
              : recentOpd.map(v => (
                <div key={v.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-green/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                    {(v.employeeName || 'V')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text truncate">{v.employeeName || 'Unknown'}</div>
                    <div className="text-xs text-muted truncate">{v.complaint || 'No complaint noted'}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted">{v.visitDate ? fmtDate(v.visitDate) : '—'}</div>
                    {v.diagnosis && <div className="text-[10px] text-accent/70 mt-0.5 max-w-[100px] truncate">{v.diagnosis}</div>}
                  </div>
                </div>
              ))
          }
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Shift Breakdown */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <span>🔄</span>
              <h3 className="text-sm font-semibold text-text">Today by Shift</h3>
              <span className="ml-auto text-xs bg-surface2 px-2 py-0.5 rounded-full text-muted">{stats.opdToday} total</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {[
                { label:'Morning',   icon:'🌅', key:'Morning',   bg:'bg-amber-400/10',  txt:'text-amber-400'  },
                { label:'Afternoon', icon:'🌤️', key:'Afternoon', bg:'bg-orange-400/10', txt:'text-orange-400' },
                { label:'Night',     icon:'🌙', key:'Night',     bg:'bg-indigo-400/10', txt:'text-indigo-400' },
                { label:'General',   icon:'☀️', key:'General',   bg:'bg-blue-400/10',   txt:'text-blue-400'   },
              ].map(s => {
                const n = shiftBreakdown[s.key] || 0;
                return (
                  <div key={s.key} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg ${n > 0 ? s.bg : 'bg-surface2'}`}>
                    <span className="text-sm">{s.icon}</span>
                    <div className="min-w-0">
                      <div className={`text-sm font-bold ${n > 0 ? s.txt : 'text-muted'}`}>{n}</div>
                      <div className="text-[10px] text-muted">{s.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hospital Tracker */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <span>🏨</span>
              <h3 className="text-sm font-semibold text-text">Hospital Tracker</h3>
              <span className="ml-auto text-xs bg-surface2 px-2 py-0.5 rounded-full text-muted">
                {hospitalised.length} admitted
              </span>
            </div>
            {hospitalised.length === 0
              ? <div className="px-4 py-4 text-xs text-muted text-center">No hospitalised employees</div>
              : hospitalised.slice(0, 3).map(h => (
                <div key={h.id} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/50 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center text-[10px] font-bold text-red-400 shrink-0">
                    {(h.employeeName || 'H')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text truncate">{h.employeeName}</div>
                    <div className="text-[10px] text-muted truncate">{h.hospital || '—'}</div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 shrink-0">{h.status}</span>
                </div>
              ))
            }
          </div>

          {/* Smart Alerts */}
          <AlertsWidget />

          {/* Quick Actions */}
          <div className="card overflow-hidden">
            <div className="card-header"><span>⚡</span><h3 className="text-sm font-semibold text-text">Quick Actions</h3></div>
            <div className="p-2 space-y-0.5">
              {[
                { label: 'New OPD Visit',     icon: '📋', link: '/portal/opd',          roles: ['doctor','nurse','admin'] },
                { label: 'Add Employee',      icon: '👤', link: '/portal/employees',    roles: ['admin'] },
                { label: 'Dispense Medicine', icon: '💊', link: '/portal/pharmacy',     roles: ['pharmacy','doctor','admin'] },
                { label: 'Issue Certificate', icon: '📜', link: '/portal/certificates', roles: ['doctor','admin'] },
              ].filter(a => a.roles.includes(role)).map(a => (
                <Link key={a.label} to={a.link}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-surface2 text-sm text-text transition-colors hover:no-underline">
                  <span>{a.icon}</span><span>{a.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── IHI Intelligence Board ── */}
      {!loading && ihiEmployees.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <span>📊</span>
            <h3 className="text-sm font-semibold text-text">Health Intelligence Board</h3>
            <span className="text-xs text-muted ml-2">Individual Health Index · all employees</span>
            <Link to="/portal/employees" className="ml-auto text-xs text-accent hover:underline">Full roster →</Link>
          </div>
          <div className="grid grid-cols-[2fr_1fr_80px_1fr_80px] gap-2 px-4 py-2.5 bg-surface2 border-b border-border">
            {['Employee', 'Department', 'Blood Grp', 'IHI Score', 'Status'].map(h => (
              <div key={h} className="text-[10px] font-bold uppercase tracking-wider text-muted">{h}</div>
            ))}
          </div>
          {ihiEmployees.slice(0, 10).map(emp => (
            <div key={emp.id}
              className="grid grid-cols-[2fr_1fr_80px_1fr_80px] gap-2 px-4 py-2.5 border-b border-border/50 last:border-0 hover:bg-surface2/30 transition-colors items-center">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-green/20 flex items-center justify-center text-[11px] font-bold text-accent shrink-0">
                  {(emp.name || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-text truncate">{emp.name}</div>
                  <div className="text-xs text-muted">{emp.empId}</div>
                </div>
              </div>
              <div className="text-xs text-muted truncate">{emp.department || '—'}</div>
              <div className="text-xs text-muted">{emp.bloodGroup || '—'}</div>
              <IHIBar score={emp.ihiScore} />
              <div>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  emp.fitnessStatus === 'Fit'                  ? 'bg-accent/10 text-accent' :
                  emp.fitnessStatus === 'Unfit'                ? 'bg-red-500/10 text-red-400' :
                  emp.fitnessStatus === 'Fit with Restriction' ? 'bg-amber-400/10 text-amber-400' :
                  'bg-surface2 text-muted'
                }`}>{emp.fitnessStatus || 'Pending'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
